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
│   ├── main.py
│   ├── schemas.py
│   ├── seed.py
│   └── routes/
│       ├── donations.py
│       └── stats.py
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

Los estados permitidos son `available`, `reserved` y `delivered`. El contrato detallado está en [API_CONTRACT.md](../docs/API_CONTRACT.md).

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
