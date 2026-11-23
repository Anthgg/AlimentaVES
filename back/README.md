# Backend de AlimentaVES

**Responsable:** Jesus Anthony Garamendi Gonzales

En esta carpeta desarrollamos los endpoints que permiten registrar donaciones, reservar alimentos, confirmar entregas y consultar estadísticas. Los datos se almacenan en PostgreSQL.

## Tecnologías

- Python 3.12
- FastAPI y Pydantic
- PostgreSQL 16
- Psycopg 3
- Docker Compose
- Pytest

## Estructura

```text
back/
├── app/
│   ├── config.py
│   ├── database.py
│   ├── community_kitchen_schemas.py
│   ├── community_kitchen_stats_schemas.py
│   ├── import_community_kitchens.py
│   ├── main.py
│   ├── schemas.py
│   ├── seed.py
│   └── routes/
│       ├── donations.py
│       ├── community_kitchens.py
│       ├── community_kitchen_stats.py
│       └── stats.py
├── scripts/
│   └── download_community_kitchens.ps1
├── data/raw/              Descargas saneadas de fuentes públicas
├── tests/
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Cómo ejecutarlo

Desde la raíz del repositorio:

```bash
docker compose up --build -d
docker compose ps
```

El backend estará en http://localhost:8000 y Swagger en http://localhost:8000/docs.

Si necesitamos ejecutar Python directamente, podemos instalar las dependencias con `pip install -r requirements.txt`, copiar `.env.example` a `.env` y ejecutar `uvicorn app.main:app --reload --port 8000`. En ese caso PostgreSQL debe estar levantado en el puerto local 5433.

## Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /api/health | Revisar el estado de la API |
| GET | /api/donations | Listar donaciones |
| GET | /api/donations/{id} | Ver una donación |
| POST | /api/donations | Registrar una donación |
| PATCH | /api/donations/{id}/reserve | Reservar una donación |
| PATCH | /api/donations/{id}/deliver | Confirmar una entrega |
| GET | /api/stats | Consultar estadísticas |
| GET | /api/community-kitchens | Listar comedores públicos |
| GET | /api/community-kitchens/{id} | Ver un comedor |
| GET | /api/community-kitchens/stats | Consultar métricas de comedores |

Los estados permitidos son `available`, `reserved` y `delivered`. El contrato detallado está en [API_CONTRACT.md](../docs/API_CONTRACT.md).

La lista de comedores admite `name`, `district`, `limit` y `offset`. Los datos importados provienen de la capa pública de comedores del IDEP. La importación conserva el código publicado como identificador estable y actualiza los registros existentes sin borrar filas. Se excluyen los nombres de responsables y las direcciones específicas de la fuente. El estado se presenta tal como lo publica la fuente; no confirma que el comedor opere actualmente.

Para volver a descargar e importar la fuente desde PowerShell, en la raíz del repositorio:

```powershell
.\back\scripts\download_community_kitchens.ps1
docker compose exec back python -m app.import_community_kitchens
```

El archivo descargado contiene solo una lista permitida de campos y geometrías en WGS84. El importador selecciona Villa El Salvador con UBIGEO `150142` y distrito `VILLA EL SALVADOR`.

## Pruebas

```bash
docker compose exec back python -m pytest -q
```

Las pruebas utilizan la base independiente `alimentaves_test`, para no modificar las donaciones de demostración guardadas en `alimentaves`.

## Fases asignadas

- [x] Crear la estructura y los endpoints iniciales.
- [x] Configurar conexión y tablas de PostgreSQL.
- [ ] Validar arranque con Docker.
- [ ] Probar registros, reservas, entregas y errores.
- [ ] Comprobar persistencia y métricas.
- [ ] Realizar la demostración junto con el frontend.

Las actividades por horario se encuentran en [FASES.md](../docs/FASES.md).
