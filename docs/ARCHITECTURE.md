# Arquitectura de AlimentaVES

El proyecto se divide en frontend, backend y base de datos. Los tres servicios se ejecutan con Docker Compose.

```text
Navegador
   |
   +--- React + Vite (localhost:5173)
              |
              | HTTP / JSON
              v
          FastAPI (localhost:8000)
              |
              | Psycopg 3
              v
       PostgreSQL 16 (db:5432)
              |
       Volumen postgres_data
```

## Componentes

- `front/`: React, TypeScript, formularios, estadísticas y cliente de API.
- `back/`: FastAPI, validaciones, rutas y consultas SQL.
- `auth_users` y `auth_revoked_tokens`: cuentas con roles persistidos y revocaciones de JWT.
- `db`: PostgreSQL 16 con almacenamiento persistente.
- `docker/postgres/init/`: creación de la base `alimentaves_test` para las pruebas.
- `compose.yaml`: configuración conjunta de los tres servicios.

La tabla `community_kitchens` conserva comedores publicados por IDEP para Villa El Salvador. La importación es idempotente y usa el código de la fuente; las solicitudes de la API leen desde PostgreSQL. La descarga conserva únicamente campos públicos permitidos y geometría WGS84.

El backend registra cuentas donantes y emite tokens Bearer firmados con HS256. Los roles `donor`, `kitchen` y `admin` se guardan en PostgreSQL; no hay una ruta pública para asignarlos. El cierre de sesión conserva el `jti` revocado hasta que vence el token. Las rutas de donaciones todavía no aplican autenticación ni permisos, para mantener el flujo actual hasta integrar esa protección con el cliente.

Las métricas de comedores se consultan en `GET /api/community-kitchens/stats`. Se mantienen separadas de `GET /api/stats`, cuyo contrato de estadísticas de donaciones permanece igual.

## Modelo de donaciones

La tabla `donations` guarda el identificador UUID, nombre del donante, alimento, cantidad en kilogramos, punto de entrega, vencimiento, notas, estado, comedor que reservó y fechas de creación y entrega.

Los estados siguen el flujo `available` → `reserved` → `delivered`. La reserva utiliza una actualización condicional para evitar reservas duplicadas.

## Información del panel

Se calculan donaciones disponibles, reservadas, entregadas y kilogramos entregados. Las raciones se estiman utilizando 0,35 kg por ración como supuesto del prototipo.

Los datos mostrados en la demostración son ficticios. La autenticación del prototipo no incorpora verificación de identidad, restablecimiento de contraseña ni controles sanitarios necesarios para una operación real.

## Documentación relacionada

- [FASES.md](FASES.md)
- [API_CONTRACT.md](API_CONTRACT.md)
- [DOCKER.md](DOCKER.md)
