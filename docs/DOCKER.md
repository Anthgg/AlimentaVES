# Cómo usamos Docker en AlimentaVES

Estamos usando Docker Compose para no perder tiempo instalando dos proyectos distintos en cada computadora.

## Qué levanta

| Servicio | Tecnología | Puerto local | Qué hace |
| --- | --- | --- | --- |
| `back` | Python 3.12 + FastAPI | 8000 | API para donaciones y estadísticas |
| `front` | Node 22 + Vite + React | 5173 | Página que consume la API |
| `alimentaves_db` | Volumen Docker | Sin puerto | Guarda el archivo SQLite fuera del contenedor |
| `alimentaves_node_modules` | Volumen Docker | Sin puerto | Guarda dependencias Node |

Los dos servicios están en el archivo [compose.yaml](../compose.yaml). Por ahora **no tenemos un contenedor PostgreSQL**: SQLite es suficiente para este MVP y evita reescribir el backend a mitad de la hackatón.

## Preparación

1. Tener Docker Desktop encendido o Docker Engine + Compose funcionando.
2. Clonar el repositorio.
3. Abrir una terminal en la raíz del proyecto.

```bash
git clone https://github.com/Anthgg/AlimentaVES.git
cd AlimentaVES
docker compose up --build -d
docker compose ps
```

Abrir:
- http://localhost:5173 → interfaz
- http://localhost:8000/docs → Swagger para probar las API
- http://localhost:8000/api/health → debe responder `{"status":"ok"}`

## Comandos útiles

```bash
# Logs de todos los servicios
docker compose logs -f

# Logs de solo backend o frontend
docker compose logs -f back
docker compose logs -f front

# Ejecutar tests del backend
docker compose exec back python -m pytest -q

# Comprobar compilación del frontend
docker compose exec front npm run build

# Reiniciar un servicio
docker compose restart back

# Detener sin borrar la base
docker compose down

# Reconstruir después de agregar dependencias
docker compose up --build -d
```

⚠️ **No ejecutar `docker compose down -v`** salvo que queramos borrar a propósito la base de datos y las dependencias guardadas.

## Cómo funciona la conexión

```text
Navegador en nuestra laptop
  ├── http://localhost:5173 ──> front (Vite/React)
  └── http://localhost:8000/api ──> back (FastAPI)
                                      └── /data/alimenta_ves.db (volumen)
```

**Importante:** desde el navegador se usa `localhost:8000`. El nombre `back` solo se resuelve entre contenedores y no en el navegador.

Los archivos de `./back` y `./front` están montados en los contenedores, por eso vemos nuestros cambios sin reconstruir en cada edición. Si cambiamos las dependencias, sí toca ejecutar `up --build`.

## Si trabajamos en computadoras distintas

Lo más sencillo es que cada uno clone el repositorio y ejecute **el mismo Compose** en su laptop. Así nadie depende de que la otra persona tenga la computadora encendida.

Cada base de datos es local y de prueba, por lo que no se sincroniza automáticamente entre las laptops. Si queremos usar un solo backend por red local, habrá que cambiar la URL de `VITE_API_URL`, configurar `FRONTEND_ORIGINS` y la publicación del puerto; para el MVP no hace falta.

## Si algo falla

- `docker compose ps`: revisar que `back` esté `healthy` y que `front` esté ejecutándose.
- `docker compose logs back`: revisar errores de Python.
- `docker compose logs front`: revisar errores de Vite/Node.
- Error de CORS: comprobar `FRONTEND_ORIGINS` y que el navegador usa localhost:5173.
- No aparecen cambios: reconstruir imágenes cuando se hayan cambiado dependencias.
- No llegan datos: entrar a Swagger y probar `GET /api/donations`.

Todo es **desarrollo local**. No hay autenticación ni HTTPS de producción, y no debemos exponer esta API como una plataforma pública de donaciones reales.
