# Cloud Run para AlimentaVES

La configuración conserva los endpoints FastAPI y la autenticación JWT actual. El cliente React sigue llamando la API por `VITE_API_URL`; este trabajo no modifica archivos del frontend.

## Proyecto y región

- Proyecto: `alimentaves-demo-2026-anthg`
- Región: `us-east1`, cercana a Supabase `us-east-1`
- Servicio: `alimentaves-api`
- Bucket privado: `alimentaves-demo-2026-anthg-media`
- Frontend público: `alimentaves-web`

## Preparación de secretos

Guardar `alimentaves-database-url` y `alimentaves-jwt-secret` en Secret Manager. El despliegue fija `DATABASE_URL` en la versión `2` (pooler corregido del panel) y `JWT_SECRET` en la versión `1`. No guardar sus valores en Git ni en el Dockerfile.

`alimentaves-database-url` debe contener la URI PostgreSQL del proyecto Supabase con la contraseña codificada por porcentaje si tiene caracteres especiales y `sslmode=require`. No usar una clave `service_role` en el navegador; la aplicación continúa validando su propio JWT.

La aplicación usa el rol PostgreSQL dedicado `alimentaves_api`, limitado a `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre las diez tablas activas. Sus políticas RLS solo permiten el acceso a ese rol de servidor; `anon` y `authenticated` siguen sin permisos. La URL usa Supavisor en modo sesión en `aws-1-us-east-1.pooler.supabase.com`, puerto `5432` y usuario `alimentaves_api.dbmcjkelxhqgngucblib`.

El servicio requiere un `JWT_SECRET` estable de al menos 32 bytes. La clave debe generarse y guardarse directamente en Secret Manager.

## Persistencia de fotografías

F08 conserva revisión y publicación en PostgreSQL. En Cloud Run, los bytes se guardan en el bucket GCS privado usando la cuenta de servicio del backend. El bucket usa acceso uniforme y prevención de acceso público; el cliente descarga fotografías por los endpoints FastAPI existentes, que siguen comprobando el estado publicado o el permiso de administrador.

No se copian fotografías locales de prueba.

## Despliegue

Cuando el proyecto tenga facturación habilitada y existan ambos secretos con la versión `1`, ejecutar desde la raíz del repositorio:

```powershell
./deploy/deploy-cloud-run.ps1
```

El servicio escala de cero a un máximo de dos instancias, con 1 vCPU, 1 GiB, concurrencia 20 y un pool de hasta cuatro conexiones por instancia (ocho conexiones como máximo). El endpoint de health es `/api/health`.

`deploy/cloudrun.env.yaml` mantiene CORS limitado a orígenes explícitos. Para publicar React desde una versión o worktree concreto, ejecutar `./deploy/deploy-frontend.ps1 -FrontendPath "C:\ruta\al\worktree\front"`: copia el contenido actual de esa carpeta, excluye secretos locales y dependencias, construye una imagen estática con Nginx sin editar el frontend y fija `VITE_API_URL` a la URL HTTPS del API. El script agrega el origen del sitio a CORS solo si aún no está autorizado. El servicio público `alimentaves-web` usa 1 vCPU, 512 MiB, concurrencia 80 y escala de cero a dos instancias.

## Despliegue verificado

- Cloud Run: `https://alimentaves-api-qdaiunhqva-ue.a.run.app`
- Frontend: `https://alimentaves-web-qdaiunhqva-ue.a.run.app`
- Revisión del backend: `alimentaves-api-00003-c52`, basada en F12 `b774b6c` y los cambios de producción de esta rama.
- Revisión del frontend: `alimentaves-web-00002-mns`, construida desde `codex/alimentaves-visual-map-fixes` (`19e361e`) con los cambios locales de frontend presentes al desplegar.
- Health y consultas de comedores, filtros, estadísticas y donaciones comprobados desde la URL pública.
- Suite de backend: 28 pruebas pasan en un contenedor PostgreSQL aislado; el contenedor temporal ya se eliminó.
- CORS comprobado para el frontend publicado; los orígenes externos de prueba se rechazan.
- Frontend Cloud Run servido por HTTPS; el bundle apunta al API Cloud Run y el preflight CORS admite el frontend publicado.
- El bucket tiene acceso uniforme y prevención de acceso público; no se migraron fotografías locales.
- La búsqueda en 48 entradas recientes de Cloud Run no encontró URI PostgreSQL, verificador SCRAM, `JWT_SECRET` ni asignaciones `password=`.

El servicio usa 1 vCPU, 1 GiB, concurrencia 20, timeout de 60 segundos, escalamiento de cero a dos instancias y hasta cuatro conexiones PostgreSQL por instancia. No se calculó una factura real: Cloud Run escala a cero, mientras que Cloud Build, Artifact Registry, GCS y Supabase pueden generar cargos según uso y plan.

Las pruebas de escritura de la suite corrieron solo contra el contenedor PostgreSQL aislado. En una verificación posterior, `GET /api/donations` devolvió dos registros; el despliegue y sus verificaciones solo hicieron solicitudes de lectura/preflight y no los modificaron. React mantiene su contrato; el bundle publicado usa `VITE_API_URL=https://alimentaves-api-qdaiunhqva-ue.a.run.app/api` sin cambiar archivos de `front/`.
