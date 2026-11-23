"""Import a privacy-filtered IDEP ArcGIS export into PostgreSQL."""

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from . import database as db

SOURCE_URL = (
    "https://www.idep.gob.pe/geoportal/rest/services/"
    "DATOS_ESPACIALES/ANTORCHA_INSTEG/MapServer/59"
)
TARGET_UBIGEO = "150142"
TARGET_DISTRICT = "VILLA EL SALVADOR"
ALLOWED_SOURCE_FIELDS = frozenset({
    "OBJECTID_1", "ubigeo_dis", "departamen", "provincia", "distrito",
    "centro_pob", "nombre_del", "modalidad", "estado_del", "codigo_de",
    "n_usuari",
})
DEFAULT_RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


def newest_export(raw_dir: Path = DEFAULT_RAW_DIR) -> Path:
    candidates = sorted(raw_dir.glob("comedores_idep_*.json"))
    if not candidates:
        raise FileNotFoundError(
            f"No hay una descarga en {raw_dir}. Ejecute primero "
            "scripts/download_community_kitchens.ps1."
        )
    return candidates[-1]


def _text(value: object) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _number(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _user_count(value: object) -> int | None:
    number = _number(value)
    if number is None or number < 0 or not number.is_integer():
        return None
    return int(number)


def _target_record(feature: dict) -> bool:
    attributes = feature.get("attributes") or {}
    ubigeo = _text(attributes.get("ubigeo_dis"))
    district = _text(attributes.get("distrito"))
    return (
        ubigeo == TARGET_UBIGEO
        and district is not None
        and district.casefold() == TARGET_DISTRICT.casefold()
    )


def normalize_feature(
    feature: dict, downloaded_at: datetime
) -> tuple[dict | None, str | None]:
    """Return a safe database row or a rejection reason for a target feature."""
    attributes = feature.get("attributes") or {}
    source_oid_value = attributes.get("OBJECTID_1")
    try:
        source_oid = int(source_oid_value) if source_oid_value is not None else None
    except (TypeError, ValueError):
        source_oid = None

    source_code = _text(attributes.get("codigo_de"))
    if source_code is None and source_oid is not None:
        source_code = f"IDEP59:{source_oid}"
    name = _text(attributes.get("nombre_del"))
    district = _text(attributes.get("distrito"))
    ubigeo = _text(attributes.get("ubigeo_dis"))
    if not source_code:
        return None, "missing_source_code"
    if not name:
        return None, "missing_name"
    if district is None or district.casefold() != TARGET_DISTRICT.casefold():
        return None, "district_mismatch"
    if ubigeo != TARGET_UBIGEO:
        return None, "ubigeo_mismatch"

    geometry = feature.get("geometry") or {}
    longitude = _number(geometry.get("x"))
    latitude = _number(geometry.get("y"))
    if longitude is not None and not -180 <= longitude <= 180:
        longitude = None
    if latitude is not None and not -90 <= latitude <= 90:
        latitude = None

    users_count = _user_count(attributes.get("n_usuari"))
    return {
        "source_object_id": source_oid,
        "source_code": source_code,
        "name": name,
        "district": district,
        "ubigeo": ubigeo,
        # The source's `direccion` can contain specific addresses, so it is
        # deliberately excluded from the downloaded allowlist and stored as NULL.
        "address": None,
        "latitude": latitude,
        "longitude": longitude,
        "modality": _text(attributes.get("modalidad")),
        "source_status": _text(attributes.get("estado_del")),
        "users_count": users_count,
        "source_url": SOURCE_URL,
        "downloaded_at": downloaded_at,
    }, None


UPSERT_SQL = """
    INSERT INTO community_kitchens (
        source_object_id, source_code, name, district, ubigeo, address,
        latitude, longitude, modality, source_status, users_count,
        source_url, downloaded_at
    ) VALUES (
        %(source_object_id)s, %(source_code)s, %(name)s, %(district)s,
        %(ubigeo)s, %(address)s, %(latitude)s, %(longitude)s, %(modality)s,
        %(source_status)s, %(users_count)s, %(source_url)s, %(downloaded_at)s
    )
    ON CONFLICT (source_code) DO UPDATE SET
        source_object_id = COALESCE(EXCLUDED.source_object_id,
                                    community_kitchens.source_object_id),
        name = EXCLUDED.name,
        district = EXCLUDED.district,
        ubigeo = EXCLUDED.ubigeo,
        address = COALESCE(EXCLUDED.address, community_kitchens.address),
        latitude = COALESCE(EXCLUDED.latitude, community_kitchens.latitude),
        longitude = COALESCE(EXCLUDED.longitude, community_kitchens.longitude),
        modality = COALESCE(EXCLUDED.modality, community_kitchens.modality),
        source_status = COALESCE(EXCLUDED.source_status,
                                 community_kitchens.source_status),
        users_count = COALESCE(EXCLUDED.users_count,
                               community_kitchens.users_count),
        source_url = EXCLUDED.source_url,
        downloaded_at = EXCLUDED.downloaded_at,
        updated_at = NOW()
"""


def import_export(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    metadata = payload.get("metadata") or {}
    features = payload.get("features")
    if not isinstance(features, list):
        raise ValueError("La descarga no contiene una lista 'features'.")
    if metadata.get("source_url") != SOURCE_URL:
        raise ValueError("El archivo no corresponde a la capa IDEP esperada.")
    if metadata.get("source_count") != len(features):
        raise ValueError("La descarga no coincide con el conteo publicado.")
    if metadata.get("output_spatial_reference_wkid") != 4326:
        raise ValueError("La descarga debe usar coordenadas WGS84 (WKID 4326).")

    for feature in features:
        attributes = feature.get("attributes") or {}
        if set(attributes) - ALLOWED_SOURCE_FIELDS:
            raise ValueError("La descarga contiene atributos fuera de la lista permitida.")

    downloaded_at_value = metadata.get("downloaded_at")
    downloaded_at = (
        datetime.fromisoformat(downloaded_at_value.replace("Z", "+00:00"))
        if downloaded_at_value
        else datetime.now(timezone.utc)
    )
    if downloaded_at.tzinfo is None:
        downloaded_at = downloaded_at.replace(tzinfo=timezone.utc)

    targets = [feature for feature in features if _target_record(feature)]
    valid_rows: list[dict] = []
    rejected = 0
    duplicates = 0
    seen_codes: set[str] = set()
    for feature in targets:
        row, error = normalize_feature(feature, downloaded_at)
        if error:
            rejected += 1
            continue
        assert row is not None
        if row["source_code"] in seen_codes:
            duplicates += 1
            continue
        seen_codes.add(row["source_code"])
        valid_rows.append(row)

    codes = [row["source_code"] for row in valid_rows]
    with db.connect() as conn:
        existing_codes = set()
        if codes:
            existing_codes = {
                row["source_code"]
                for row in conn.execute(
                    "SELECT source_code FROM community_kitchens "
                    "WHERE source_code = ANY(%s)",
                    (codes,),
                ).fetchall()
            }
            with conn.cursor() as cursor:
                cursor.executemany(UPSERT_SQL, valid_rows)

    inserted = len(valid_rows) - len(existing_codes)
    result = {
        "downloaded": len(features),
        "filtered_villa_el_salvador": len(targets),
        "valid_unique": len(valid_rows),
        "imported_or_updated": len(valid_rows),
        "inserted": inserted,
        "updated": len(existing_codes),
        "duplicates": duplicates,
        "rejected": rejected,
        "source_url": SOURCE_URL,
        "raw_file": str(path),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("Ejemplos:")
    for row in valid_rows[:5]:
        print(f"- {row['name']}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa comedores públicos de IDEP.")
    parser.add_argument(
        "--file",
        type=Path,
        help="Archivo JSON saneado; por defecto utiliza la descarga más reciente.",
    )
    args = parser.parse_args()
    path = args.file or newest_export()
    db.init_db()
    import_export(path)


if __name__ == "__main__":
    main()
