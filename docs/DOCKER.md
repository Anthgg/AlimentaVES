# Entorno Docker de AlimentaVES

Usamos Docker Compose para ejecutar el frontend, el backend y PostgreSQL en ambas computadoras.

## Servicios

| Servicio | Tecnología | Puerto en la laptop | Uso |
| --- | --- | --- | --- |
| db | PostgreSQL 16 | 5433 | Base de datos |
| back | Python 3.12 + FastAPI | 8000 | API REST |
| front | Node 22 + React/Vite | 5173 | Aplicación web |

Los servicios se conectan entre sí mediante la red de Docker. El backend usa `db:5432` y el navegador accede a la API por `localhost:8000`.

## Inicio

```bash
git clone https://github.com/Anthgg/AlimentaVES.git
cd AlimentaVES
docker compose up --build -d
docker compose ps
```

## Comandos

```bash
docker compose logs -f
docker compose logs -f db
docker compose logs -f back
docker compose logs -f front
docker compose exec back python -m pytest -q
docker compose exec front npm run build
docker compose exec db psql -U alimentaves -d alimentaves -c "SELECT COUNT(*) FROM donations;"
docker compose down
```

## Bases de datos

- `alimentaves`: conserva las donaciones utilizadas por la aplicación.
- `alimentaves_test`: base separada para pruebas automáticas.

Las dos bases se alojan en PostgreSQL. El volumen `postgres_data` mantiene los datos cuando se detienen o recrean los contenedores.

El comando `docker compose down -v` borra los volúmenes y, por tanto, también las bases de datos. Para detener el trabajo normalmente utilizamos `docker compose down`.

## Ejecución fuera de Docker

Se puede ejecutar FastAPI desde la laptop usando `back/.env.example` como plantilla de variables de entorno. Para conectarlo a PostgreSQL de Docker se utiliza `localhost:5433`. El archivo `.env` no se publica en GitHub.

`JWT_SECRET` es opcional para la demostración: cuando no se define, cada proceso genera una clave aleatoria y los tokens dejan de servir al reiniciar FastAPI. Para conservar sesiones entre reinicios, varios workers o un entorno real, define `JWT_SECRET` con una clave aleatoria de al menos 32 bytes. Compose la lee del entorno o de un `.env` en la raíz del repositorio; nunca la escribas en `compose.yaml`. `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` configura la vigencia del token (60 minutos por defecto).

La contraseña de PostgreSQL incluida en Compose es exclusivamente para desarrollo local. El API incorpora registro e inicio de sesión, pero las operaciones de donación aún no exigen token ni autorización por rol. No publiques el prototipo con datos reales ni sin completar esa integración y configurar transporte seguro.

## Importante al actualizar desde una versión anterior

Las versiones iniciales del prototipo usaban SQLite. Esta versión utiliza únicamente PostgreSQL y **no migra datos de SQLite**. Si se requiere recuperar registros de una instalación anterior, debe realizarse una exportación y una importación controladas.

Si el volumen PostgreSQL ya existía sin la base `alimentaves_test`, la creación automática no vuelve a ejecutarse. En ese caso se puede crear manualmente:

```bash
docker compose exec db psql -U alimentaves -d postgres -c "CREATE DATABASE alimentaves_test;"
```
