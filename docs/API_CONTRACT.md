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

## Manejo de errores
FastAPI usa `{"detail":"mensaje"}` y validaciones HTTP 422. Frontend no debe inventar otro formato. Modificaciones del contrato requieren coordinación de ambos integrantes.
