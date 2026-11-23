# Arquitectura que acordamos para AlimentaVES

La idea es sencilla: Diego hace el frontend y Anthony prepara las API y la base de datos. Así avanzamos en paralelo y juntamos ambas partes para la demostración.

```text
                 NAVEGADOR
                     |
             React + Vite (:5173)
                     |
               fetch() / JSON
                     |
                 FastAPI (:8000)
                     |
              SQLite en /data
              (volumen Docker)
```

- `front/`: React + TypeScript, estilos y `src/lib/api.ts`.
- `back/`: FastAPI + Pydantic + SQLite, validaciones y rutas.
- `compose.yaml`: levanta ambos, con recarga automática durante el desarrollo.
- `docs/API_CONTRACT.md`: es nuestro acuerdo para no romper la integración.
- `docs/FASES.md`: lo que cada uno tiene que terminar por horario.

### Datos que guardamos

Cada donación tiene: `id`, `donor_name`, `food_name`, `quantity_kg`, `pickup_address`, `expires_at`, `notes`, `status`, `reserved_by`, `created_at` y `delivered_at`.

El estado sigue este orden: `available` → `reserved` → `delivered`.

Las estadísticas muestran disponibles, reservadas, entregadas, kilos entregados y **raciones estimadas**. Para la demo usamos el supuesto de **0.35 kg por ración**; esto no significa que hayamos medido beneficiarios reales.

### Lo que decidimos no hacer ahora

Login, pasarelas de pago, WhatsApp, mapas, geolocalización, servicios externos y administración de múltiples roles. Son ideas que podríamos trabajar después del hackatón. Primero queremos que el recorrido básico funcione.

Usamos datos ficticios; si más adelante trabajamos con personas y alimentos reales, necesitamos autenticación, privacidad, verificación de comedores y protocolos sanitarios.

Ver [DOCKER.md](DOCKER.md) para levantar servicios y conservar la base de datos.
