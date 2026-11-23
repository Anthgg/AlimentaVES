# Contrato API v1 (congelado para trabajo en paralelo)

Base URL local: `http://localhost:8000/api` · documentación interactiva: `http://localhost:8000/docs`.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/health` | `{"status":"ok"}` |
| GET | `/donations` | Lista, opcional `?status=available|reserved|delivered` |
| GET | `/donations/{id}` | Detalle o 404 |
| POST | `/donations` | Nueva donación, 201 |
| PATCH | `/donations/{id}/reserve` | Reserva, 200 o 409 |
| PATCH | `/donations/{id}/deliver` | Confirmar entrega, 200 o 409 |
| GET | `/stats` | Resumen agregado |
| GET | `/community-kitchens` | Listado paginado de comedores públicos |
| GET | `/community-kitchens/{id}` | Comedor por identificador o 404 |
| GET | `/community-kitchens/stats` | Métricas agregadas de comedores |
| POST | `/community-kitchens/{id}/claims` | Solicitud de administración autenticada, 201 o 409 |
| GET | `/community-kitchens/{id}/profile` | Última versión pública o 404 |
| PUT | `/community-kitchens/{id}/profile` | Enviar versión de perfil a revisión, 202 o 409 |
| GET | `/admin/community-kitchen-claims` | Solicitudes para moderación, solo admin |
| PATCH | `/admin/community-kitchen-claims/{id}/decision` | Aprobar/rechazar solicitud, solo admin |
| GET | `/admin/community-kitchen-profiles` | Versiones para moderación, solo admin |
| PATCH | `/admin/community-kitchen-profiles/{id}/decision` | Publicar/rechazar versión, solo admin |
| POST | `/auth/register` | Crear cuenta con rol `donor`, 201 |
| POST | `/auth/login` | Iniciar sesión y recibir JWT Bearer |
| POST | `/auth/logout` | Revocar token Bearer actual, 204 |
| GET | `/auth/me` | Consultar usuario autenticado |

## Autenticación

Registro y acceso reciben JSON con correo y contraseña:
```json
{
  "email": "donante@example.org",
  "password": "Contraseña segura de prueba"
}
```
La contraseña debe tener entre 12 y 128 caracteres. Los correos se normalizan a minúsculas. El registro crea únicamente el rol `donor`; un campo `role` u otro atributo adicional se rechaza con 422. Los roles persistidos son `donor`, `kitchen` y `admin`; no existe una ruta pública para asignar roles.

`POST /auth/register` devuelve 201 con `id`, `email`, `role` y `created_at`. Un correo ya registrado devuelve 409. `POST /auth/login` devuelve:
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600
}
```
Envía el token como `Authorization: Bearer <access_token>`. `/auth/me` requiere un token válido y devuelve la identidad y el rol actuales. `/auth/logout` requiere el token actual, responde 204 y lo revoca en PostgreSQL. Un token ausente, inválido, vencido o revocado devuelve 401.

Este alcance agrega registro, inicio y cierre de sesión, pero conserva el comportamiento actual de las rutas de donaciones: todavía no requieren autenticación ni aplican autorización por rol. La integración de permisos con el frontend se coordinará aparte.

## Crear donación
```json
{
  "donor_name": "Donante de prueba",
  "food_name": "Arroz sellado",
  "quantity_kg": 6.5,
  "pickup_address": "Punto de entrega de prueba, Villa El Salvador",
  "expires_at": "2026-12-31T23:00:00-05:00",
  "notes": "Conservar cerrado"
}
```
`expires_at` requiere fecha futura con zona horaria (ISO 8601). Cantidad en kg mayor que 0. No enviar teléfonos ni domicilios reales en el MVP.

## Respuesta Donation
```json
{
  "id": "uuid",
  "donor_name": "Donante de prueba",
  "food_name": "Arroz sellado",
  "quantity_kg": 6.5,
  "pickup_address": "Punto de entrega de prueba, Villa El Salvador",
  "expires_at": "2026-12-31T23:00:00-05:00",
  "notes": "Conservar cerrado",
  "status": "available",
  "reserved_by": null,
  "created_at": "2026-11-23T09:00:00+00:00",
  "delivered_at": null
}
```
Los timestamps son ilustrativos, no valores fijos de ejecución.

## Reserva
PATCH `/donations/{id}/reserve`:
```json
{"reserved_by":"Comedor de demostración"}
```
Solo desde `available`, no vencida. PATCH `/donations/{id}/deliver` no requiere body y solo permite `reserved`.

## Stats
```json
{
  "available": 2,
  "reserved": 1,
  "delivered": 1,
  "kilograms_delivered": 8.0,
  "estimated_servings": 22
}
```
Datos solo de ejemplo. `estimated_servings` = parte entera de kg entregados / 0.35; **no** es una medición real de personas beneficiadas.

## Comedores populares

`GET /community-kitchens` consulta PostgreSQL y acepta:

- `name`: búsqueda parcial, sin distinguir mayúsculas y minúsculas.
- `district`: coincidencia exacta del distrito, sin distinguir mayúsculas y minúsculas.
- `limit`: cantidad por página, de 1 a 500 (por defecto 100).
- `offset`: filas que se omiten antes de la página (por defecto 0).

`GET /community-kitchens/{id}` devuelve un registro o 404. La respuesta incluye el código y nombre publicados, distrito, UBIGEO, coordenadas WGS84, modalidad, estado informado por la fuente y cantidad agregada de usuarios cuando está disponible. `address` puede ser nulo: la fuente también contiene direcciones específicas que no se guardan por privacidad. `verified_at` queda nulo; `source_status` no acredita operación actual.

`GET /community-kitchens/stats` resume `total`, registros con coordenadas (`located`), distritos, estados publicados y conteos de usuarios reportados por la fuente. `source_reported_users_total` suma esos valores; no representa personas únicas. Este endpoint separado conserva intacta la respuesta existente de `GET /stats`.

### Claims y perfiles

`POST /community-kitchens/{id}/claims` requiere `Authorization: Bearer <token>` y un cuerpo vacío `{}`. No acepta texto libre ni datos personales; la cuenta se obtiene del token y `account_id` u otros campos se rechazan. Una cuenta puede tener una sola solicitud `pending` a la vez; otras cuentas pueden solicitar administrar el mismo comedor. Un administrador debe verificar la solicitud por un canal autorizado y rechazarla si no puede confirmar la representación. Quien presentó una solicitud no puede revisarla, aunque sea administrador. Aprobar crea una membresía activa `kitchen`; si la cuenta era `donor`, `/auth/me` devuelve `kitchen` desde la misma sesión.

`PUT /community-kitchens/{id}/profile` requiere una membresía `kitchen` activa y los campos `description`, `operating_hours`, `institutional_location` y `needs` (cada uno puede ser `null`; se requiere al menos uno con contenido). No incluyas nombres ni contactos de responsables, ni datos que permitan identificar beneficiarios. El validador rechaza patrones obvios de correo, teléfonos peruanos y DNI etiquetados de ocho dígitos; no detecta nombres propios. La respuesta es una versión `pending`. Un administrador debe revisar cada campo y publicar con `decision: "approved"` o rechazar con `decision: "rejected"`; debe rechazar datos personales o información identificable. El autor no puede moderar su propia versión. Solo versiones publicadas aparecen en `GET /community-kitchens/{id}/profile`. Las versiones publicadas anteriores continúan visibles mientras una nueva revisión está pendiente o rechazada. Los campos del perfil se guardan separados de la ficha importada de IDEP.

La moderación requiere `role=admin`. La API no acepta un `account_id` para decidir qué usuario reclama o edita; usa la identidad verificada del token. Guía de moderación: confirmar externamente la representación del claim; revisar todas las versiones de perfil; no aprobar nombres/contactos de responsables ni datos identificables de beneficiarios; rechazar cualquier contenido de ese tipo. La validación automática cubre solo formatos evidentes y no sustituye esa revisión.

No hay auto-registro de administradores. El primer rol `admin` debe asignarlo manualmente un operador autorizado después de verificar la cuenta, con una actualización SQL limitada al correo exacto y validando que afecte una sola fila.

## Manejo de errores
FastAPI usa `{"detail":"mensaje"}` y validaciones HTTP 422. Frontend no debe inventar otro formato. Modificaciones del contrato requieren coordinación de ambos integrantes.
