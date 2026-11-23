# Backend | AlimentaVES

Stack: Python 3.11+, FastAPI, Pydantic 2, SQLite.

```bash
cd back
python -m venv .venv
# Activar entorno según sistema operativo
pip install -r requirements.txt
# opcional: copiar .env.example a .env para sembrar datos ficticios
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/api/health
- Datos: `back/alimenta_ves.db` (ignorado por Git).
- Tests: `python -m pytest -q`

Archivo `.env.example` para copia local. No se requiere conexión externa ni credenciales. Sin autenticación ni controles sanitarios: no apto para operar donaciones reales en producción.
