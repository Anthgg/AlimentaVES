# Arquitectura del MVP AlimentaVES

## Objetivo
Conectar donantes de excedentes aptos con comedores populares de Villa El Salvador, demostrando un ciclo completo y métricas de impacto **simuladas**. Evitar almacenamiento de datos personales sensibles en el prototipo.

## Componentes
```text
Navegador (React/Vite, :5173)
        | HTTP JSON, /api/*
        v
    FastAPI (:8000)
        | transacciones SQL
        v
  SQLite (back/alimenta_ves.db)
```
SQLite se usa para que ambos integrantes puedan levantar el MVP inmediatamente sin aprovisionar nube. La base local es persistente, no se sube a GitHub. Migrar a PostgreSQL solo si el tiempo lo permite.

## Entidades
- **Donation:** id, donor_name, food_name, quantity_kg, pickup_address, expires_at, notes, status, reserved_by, created_at, delivered_at.
- **Status:** `available` → `reserved` → `delivered`. No hay cambios inversos en el MVP.
- **Stats:** donaciones por estado, kg entregados y raciones aproximadas (supuesto de prototipo: 0.35 kg/ración).

## Decisiones del hackatón
- Backend: FastAPI + Pydantic + sqlite3 (sin ORM para evitar tiempo de migraciones).
- Frontend: React + TypeScript + Vite y fetch nativo.
- Backend escucha :8000; frontend :5173. CORS restringido a orígenes locales de desarrollo.
- Respuestas HTTP 404 cuando no existe una donación; 409 si ya fue reservada/entregada o está vencida.
- API sin autenticación: **apta únicamente para una demo local**, no para exponer públicamente con datos reales.
- Semillas de datos ficticios se activan con `DEMO_SEED=1` y solo se insertan cuando la tabla está vacía.

## Fuera del alcance del MVP
Inicio de sesión, geolocalización exacta, SMS/WhatsApp, mapas, pagos, verificación de donantes/comedor, gestión de riesgos sanitarios y despliegue productivo. Son trabajo posterior, no promesas de la demo.
