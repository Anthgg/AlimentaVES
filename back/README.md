# Backend de AlimentaVES

**Responsable: Jesus Anthony Garamendi Gonzales**

Esta es mi parte del proyecto. Aquí voy a trabajar las rutas, las validaciones, la base de datos y las estadísticas para que Diego pueda consumir todo desde las pantallas.

## Tecnologías

- Python 3.12 en Docker (el código también se puede ejecutar con Python 3.11+).
- FastAPI, para crear las API.
- Pydantic, para validar los datos.
- SQLite, para guardar las donaciones del prototipo.

Por el tiempo del hackatón vamos a usar SQLite. **Docker guarda la base en un volumen**, así que no se borra cuando detenemos los contenedores normalmente. No necesitamos configurar PostgreSQL para esta demo.

## Cómo iniciar mi parte

Lo más fácil es ir a la carpeta principal del repo y ejecutar:
```bash
docker compose up --build -d
docker compose logs -f back
```

Luego abrir: http://localhost:8000/docs

Si quiero correr los tests desde Docker:
```bash
docker compose exec back python -m pytest -q
```

### Si no uso Docker

Desde la carpeta `back/`:
```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Opcional: copiar .env.example a .env para activar datos ficticios
uvicorn app.main:app --reload --port 8000
```

## API que tiene que funcionar

La dirección base es `http://localhost:8000/api`.

| Método | Ruta | Para qué sirve |
| --- | --- | --- |
| GET | `/health` | Comprobar que se levantó el backend |
| GET | `/donations` | Mostrar donaciones; admite `?status=available` |
| GET | `/donations/{id}` | Consultar una donación |
| POST | `/donations` | Publicar una nueva donación |
| PATCH | `/donations/{id}/reserve` | Reservar para un comedor |
| PATCH | `/donations/{id}/deliver` | Confirmar la entrega |
| GET | `/stats` | Obtener las cifras del panel |

**Estados:** `available` → `reserved` → `delivered`. No vamos a inventar otros estados sin coordinar con el frontend.

El JSON exacto, los ejemplos y los errores están en [docs/API_CONTRACT.md](../docs/API_CONTRACT.md).

## Fases que me corresponden

- [x] **Base inicial:** estructura FastAPI, rutas y modelos creados.
- [ ] **Fase 0:** comprobar que el backend arranca con Docker y que responde `/api/health`.
- [ ] **Fase 1:** probar crear, listar, consultar y reservar donaciones.
- [ ] **Fase 2:** comprobar entrega, estadísticas y fechas vencidas.
- [ ] **Fase 3:** ejecutar pruebas y revisar que nada falle con el frontend.
- [ ] **Fase 4:** dejar el README, la documentación y la demo preparados.

El calendario compartido está en [docs/FASES.md](../docs/FASES.md).

## Datos de prueba

En Docker, `DEMO_SEED=1` agrega registros ficticios **solo si la tabla está vacía**. No se van a borrar al reiniciar. Si algo falla, reviso los logs antes de tocar la base.

El prototipo no tiene inicio de sesión ni validación sanitaria. No debemos usar datos reales de personas o comedores en esta etapa.
