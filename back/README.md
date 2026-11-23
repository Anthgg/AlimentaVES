# Backend de AlimentaVES

**Responsable:** Jesus Anthony Garamendi Gonzales

En esta carpeta desarrollamos los endpoints que permiten registrar donaciones, reservar alimentos, confirmar entregas y consultar estadísticas. Los datos se almacenan en PostgreSQL.

## Tecnologías

- Python 3.12
- FastAPI y Pydantic
- PostgreSQL 16
- Psycopg 3
- Docker Compose
- Pytest

## Estructura

```text
back/
├── app/
│   ├── config.py
│   ├── database.py
│   ├── auth.py
│   ├── auth_schemas.py
│   ├── community_kitchen_profile_schemas.py
│   ├── community_kitchen_schemas.py
│   ├── community_kitchen_stats_schemas.py
│   ├── import_community_kitchens.py
│   ├── main.py
│   ├── schemas.py
│   ├── seed.py
│   └── routes/
│       ├── auth.py
│       ├── community_kitchen_profiles.py
│       ├── donations.py
│       ├── community_kitchens.py
│       ├── community_kitchen_stats.py
│       └── stats.py
├── scripts/
│   └── download_community_kitchens.ps1
├── data/raw/              Descargas saneadas de fuentes públicas
├── tests/
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Cómo ejecutarlo

Desde la raíz del repositorio:

```bash
docker compose up --build -d
docker compose ps
```

El backend estará en http://localhost:8000 y Swagger en http://localhost:8000/docs.

Si necesitamos ejecutar Python directamente, podemos instalar las dependencias con `pip install -r requirements.txt`, copiar `.env.example` a `.env` y ejecutar `uvicorn app.main:app --reload --port 8000`. En ese caso PostgreSQL debe estar levantado en el puerto local 5433.

## Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /api/health | Revisar el estado de la API |
| GET | /api/donations | Listar donaciones |
| GET | /api/donations/{id} | Ver una donación |
| POST | /api/donations | Registrar una donación |
| PATCH | /api/donations/{id}/reserve | Reservar una donación |
| PATCH | /api/donations/{id}/deliver | Confirmar una entrega |
| GET | /api/stats | Consultar estadísticas |
| GET | /api/community-kitchens | Listar comedores públicos |
| GET | /api/community-kitchens/{id} | Ver un comedor |
| GET | /api/community-kitchens/stats | Consultar métricas de comedores |
| POST | /api/community-kitchens/{id}/claims | Solicitar administración de un comedor |
| GET | /api/community-kitchens/{id}/profile | Consultar perfil publicado |
| PUT | /api/community-kitchens/{id}/profile | Enviar una versión de perfil a revisión |
| GET | /api/admin/community-kitchen-claims | Listar solicitudes (admin) |
| PATCH | /api/admin/community-kitchen-claims/{id}/decision | Aprobar o rechazar solicitud (admin) |
| GET | /api/admin/community-kitchen-profiles | Listar perfiles para revisión (admin) |
| PATCH | /api/admin/community-kitchen-profiles/{id}/decision | Publicar o rechazar perfil (admin) |
| GET | /api/admin/users | Listar cuentas sin hashes (admin) |
| GET | /api/admin/community-kitchens | Consultar catálogo de comedores (admin) |
| GET | /api/admin/donations | Consultar donaciones (admin) |
| GET | /api/notifications | Listar notificaciones propias y no leídas |
| PATCH | /api/notifications/{id}/read | Marcar una notificación propia como leída |
| PATCH | /api/notifications/read-all | Marcar todas las notificaciones propias como leídas |
| POST | /api/auth/register | Crear una cuenta donante |
| POST | /api/auth/login | Iniciar sesión y recibir un token Bearer |
| POST | /api/auth/logout | Revocar el token actual |
| GET | /api/auth/me | Consultar la cuenta autenticada |

Los estados permitidos son `available`, `reserved` y `delivered`. El contrato detallado está en [API_CONTRACT.md](../docs/API_CONTRACT.md).

## Autenticación

El registro acepta correo y contraseña de 12 a 128 caracteres y siempre crea el rol `donor`. Enviar un campo `role` se rechaza; no hay una ruta pública para asignar los roles `kitchen` o `admin`. Las contraseñas se guardan como hashes Argon2id. El acceso devuelve un JWT Bearer firmado con HS256, con vencimiento configurable.

Envía el token en `Authorization: Bearer <token>` para consultar `/api/auth/me` o cerrar sesión. El cierre de sesión registra el identificador del token en PostgreSQL y lo invalida antes de su vencimiento.

La autenticación introduce cuentas y sesiones; conserva sin cambios el flujo actual de donaciones. Las rutas de donaciones todavía no exigen sesión ni aplican permisos por rol. El frontend actual no envía tokens, así que cualquier integración de permisos en esas rutas requiere coordinar después el cliente.

`JWT_SECRET` no es obligatorio para una demostración local: si falta, cada proceso genera una clave aleatoria y sus sesiones dejan de ser válidas al reiniciarse. Para mantener sesiones estables, Docker multi-worker o un entorno real, define `JWT_SECRET` con un valor aleatorio de al menos 32 bytes. Para Compose, define la variable en el entorno o en un `.env` en la raíz del repositorio; ese archivo está excluido de Git. `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` configura la vigencia (por defecto, 60 minutos).

No existe auto-registro de administradores. Para iniciar la moderación de comedores, un operador autorizado debe verificar la identidad de la cuenta y asignar el primer rol `admin` manualmente, usando el correo exacto y comprobando que la consulta afecte una sola fila.

**Paso 1:** en la base de datos de destino, ejecuta solo el inicio de transacción y la actualización:

```sql
BEGIN;
UPDATE auth_users
SET role = 'admin'
WHERE email = 'admin-verificado@example.org'
  AND role = 'donor'
RETURNING id, email, role;
```

**Paso 2:** inspecciona el resultado. Solo si `RETURNING` muestra exactamente una cuenta y el correo coincide con la identidad verificada, ejecuta `COMMIT;`. Si no, ejecuta `ROLLBACK;`. Este paso no se ejecuta durante el arranque ni desde la API pública.

La lista de comedores admite `name`, `district`, `limit` y `offset`. Los datos importados provienen de la capa pública de comedores del IDEP. La importación conserva el código publicado como identificador estable y actualiza los registros existentes sin borrar filas. Se excluyen los nombres de responsables y las direcciones específicas de la fuente. El estado se presenta tal como lo publica la fuente; no confirma que el comedor opere actualmente.

Los comedores pueden solicitar que una cuenta autenticada administre su perfil. La identidad se toma del token, nunca de un `account_id` enviado en el cuerpo. El claim no admite texto libre. Solo un administrador aprueba o rechaza claims después de verificar la representación; aprobar crea una membresía `kitchen` activa. Los miembros aprobados pueden enviar versiones de descripción, horarios, ubicación institucional y necesidades. No se deben incluir nombres ni contactos de responsables, ni datos que permitan identificar beneficiarios. La validación rechaza patrones evidentes de correo, teléfono peruano y DNI etiquetado de ocho dígitos; no intenta detectar nombres. El administrador debe revisar cada versión y rechazar información identificable. Mientras se revisa una actualización, la última versión aprobada sigue visible. Los datos de perfil se almacenan por separado de los campos importados del IDEP.

Los endpoints `/api/admin/users`, `/api/admin/community-kitchens` y `/api/admin/donations` requieren rol `admin`; las respuestas de usuarios omiten hashes de contraseña.

Las notificaciones son privadas para la cuenta autenticada, se guardan en PostgreSQL y se pueden listar o marcar como leídas. La API no envía correo ni SMS. Los eventos de solicitudes deben llamar al helper `app.notifications.create_notification` o `notify_admins` desde sus rutas para generar los avisos correspondientes.

Para volver a descargar e importar la fuente desde PowerShell, en la raíz del repositorio:

```powershell
.\back\scripts\download_community_kitchens.ps1
docker compose exec back python -m app.import_community_kitchens
```

El archivo descargado contiene solo una lista permitida de campos y geometrías en WGS84. El importador selecciona Villa El Salvador con UBIGEO `150142` y distrito `VILLA EL SALVADOR`.

## Pruebas

```bash
docker compose exec back python -m pytest -q
```

Las pruebas utilizan la base independiente `alimentaves_test`, para no modificar las donaciones de demostración guardadas en `alimentaves`.

## Fases asignadas

- [x] Crear la estructura y los endpoints iniciales.
- [x] Configurar conexión y tablas de PostgreSQL.
- [ ] Validar arranque con Docker.
- [ ] Probar registros, reservas, entregas y errores.
- [ ] Comprobar persistencia y métricas.
- [ ] Realizar la demostración junto con el frontend.

Las actividades por horario se encuentran en [FASES.md](../docs/FASES.md).
