import json
import os
from urllib.parse import urlparse
from uuid import uuid4

from app import database as db
from app.import_community_kitchens import SOURCE_URL, import_export


def test_import_is_idempotent_on_test_database(monkeypatch, tmp_path):
    test_url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    if not test_url or urlparse(test_url).path != "/alimentaves_test":
        raise RuntimeError(
            "La prueba de importación requiere exclusivamente alimentaves_test"
        )
    monkeypatch.setenv("DATABASE_URL", test_url)
    db.init_db()

    batch = uuid4().hex
    codes = [f"TEST-IDEMPOTENCY-{batch}-{index}" for index in range(2)]
    features = [
        {
            "attributes": {
                "OBJECTID_1": index + 1,
                "ubigeo_dis": "150142",
                "departamen": "LIMA",
                "provincia": "LIMA",
                "distrito": "VILLA EL SALVADOR",
                "centro_pob": None,
                "nombre_del": f"Comedor de prueba {index + 1}",
                "modalidad": "COMEDORES",
                "estado_del": "ACTIVO",
                "codigo_de": codes[index],
                "n_usuari": 12,
            },
            "geometry": {"x": -76.95, "y": -12.20},
        }
        for index in range(2)
    ]
    path = tmp_path / "comedores_saneados.json"
    path.write_text(
        json.dumps(
            {
                "metadata": {
                    "source_url": SOURCE_URL,
                    "source_count": len(features),
                    "downloaded_at": "2026-11-23T00:00:00Z",
                    "output_spatial_reference_wkid": 4326,
                },
                "features": features,
            }
        ),
        encoding="utf-8",
    )

    try:
        first = import_export(path)
        second = import_export(path)

        assert first["inserted"] == 2
        assert first["updated"] == 0
        assert first["duplicates"] == 0
        assert first["rejected"] == 0
        assert second["inserted"] == 0
        assert second["updated"] == 2

        with db.connect() as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS total FROM community_kitchens "
                "WHERE source_code = ANY(%s)",
                (codes,),
            ).fetchone()["total"]
        assert count == 2
    finally:
        with db.connect() as conn:
            conn.execute(
                "DELETE FROM community_kitchens WHERE source_code = ANY(%s)",
                (codes,),
            )
