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

## Manejo de errores
FastAPI usa `{"detail":"mensaje"}` y validaciones HTTP 422. Frontend no debe inventar otro formato. Modificaciones del contrato requieren coordinación de ambos integrantes.
