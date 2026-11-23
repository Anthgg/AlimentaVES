# AlimentaVES | HackODS UA 2026

Plataforma prototipo de rescate de alimentos para conectar donantes y comedores populares de Villa El Salvador. ODS 2 (Hambre Cero) y ODS 12 (Consumo y Producción Responsables).

> **Estado:** MVP para hackatón. Los nombres, donaciones y ubicaciones de ejemplo son **simulados**. No usar como servicio de donaciones reales sin implementar autenticación, verificación de comedores, seguridad y protocolos de inocuidad alimentaria.

## Equipo (2 integrantes)
- **Integrante 1 — Backend:** Jesus Anthony Garamendi Gonzales (carpeta `back/`).
- **Integrante 2 — Frontend:** Diego Manuel Pizango Chanchari (carpeta `front/`).

## Estructura
```text
AlimentaVES/
├── back/                   # FastAPI + SQLite (API REST persistente)
│   ├── app/
│   │   ├── routes/         # Donaciones y métricas
│   │   ├── main.py         # Aplicación / CORS / startup
│   │   ├── database.py     # Persistencia SQLite
│   │   ├── schemas.py      # Modelos de request/response
│   │   └── seed.py         # Registros 100% ficticios
│   └── tests/
├── front/                  # React + Vite + TypeScript
│   └── src/
│       ├── lib/api.ts      # Cliente HTTP tipado
│       ├── App.tsx         # MVP inicial modificable
│       └── styles.css
└── docs/
    ├── ARCHITECTURE.md
    ├── API_CONTRACT.md
    └── WORKFLOW.md
```

## Inicio rápido
**Requisitos:** Python 3.11+ y Node.js 20.19+ (recomendado Node 22).

Terminal 1 (backend):
```bash
cd back
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Copiar .env.example a .env (opcional; habilita datos de demostración)
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd front
npm install
npm run dev
```

Abrir `http://localhost:5173`. API: `http://localhost:8000/docs`. Con `DEMO_SEED=1` en `back/.env`, la base SQLite se puebla con ejemplos ficticios **solo si está vacía**. Si no se copia ese archivo, se inicia sin donaciones.

## Flujo de demostración
Publicar alimento → visualizarlo → reservar para un comedor → confirmar entrega → observar métricas actualizadas.

## Colaboración
No trabajar directamente ambos sobre `main`. Cada integrante usa una rama y PR. El frontend usa solamente el contrato de `docs/API_CONTRACT.md`; ver `docs/WORKFLOW.md`.

## Comprobaciones
```bash
cd back && python -m pytest -q
cd front && npm run build
```

## Entregables HackODS
Repositorio + README, demo funcional y pitch de 3 minutos (máximo 5 diapositivas).
