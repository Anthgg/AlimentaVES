# Cloud Run para AlimentaVES

La configuración conserva los endpoints FastAPI y la autenticación JWT actual. El cliente React sigue llamando la API por `VITE_API_URL`; este trabajo no modifica archivos del frontend.

## Proyecto y región

- Proyecto: `alimentaves-demo-2026-anthg`
- Región: `us-east1`, cercana a Supabase `us-east-1`
- Servicio: `alimentaves-api`
- Bucket privado: `alimentaves-demo-2026-anthg-media`

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

`deploy/cloudrun.env.yaml` restringe CORS a los orígenes locales de Vite para la demostración actual. Si React se publica en otro dominio, reemplazar esos orígenes por el dominio exacto autorizado antes de desplegar. No se ha cambiado `front/`.

## Despliegue verificado

- Cloud Run: `https://alimentaves-api-qdaiunhqva-ue.a.run.app`
- Revisión activa: `alimentaves-api-00001-6cj`
- Health y consultas de comedores, filtros, estadísticas y donaciones comprobados desde la URL pública.
- Suite de backend: 28 pruebas pasan en un contenedor PostgreSQL aislado; el contenedor temporal ya se eliminó.
- El usuario de prueba no existía; el login devolvió `401` y no creó datos.
- CORS comprobado para `http://localhost:5173`, origen de Vite en el repositorio.
- El bucket tiene acceso uniforme y prevención de acceso público; no se migraron fotografías locales.
- La búsqueda en 48 entradas recientes de Cloud Run no encontró URI PostgreSQL, verificador SCRAM, `JWT_SECRET` ni asignaciones `password=`.

El servicio usa 1 vCPU, 1 GiB, concurrencia 20, timeout de 60 segundos, escalamiento de cero a dos instancias y hasta cuatro conexiones PostgreSQL por instancia. No se calculó una factura real: Cloud Run escala a cero, mientras que Cloud Build, Artifact Registry, GCS y Supabase pueden generar cargos según uso y plan.

Las pruebas de escritura corrieron solo contra el contenedor PostgreSQL aislado. No se crearon usuarios, donaciones, reservas, solicitudes, notificaciones ni fotografías en la base de demostración. React mantiene su contrato; para llamar al backend, el build local usa `VITE_API_URL=https://alimentaves-api-qdaiunhqva-ue.a.run.app/api` sin cambios en `front/`.
