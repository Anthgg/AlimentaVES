# Fases de desarrollo de AlimentaVES

El equipo está formado por **Jesus Anthony Garamendi Gonzales (backend)** y **Diego Manuel Pizango Chanchari (frontend)**. La base de datos acordada es **PostgreSQL 16**, ejecutada con Docker Compose.

## Flujo principal

Registrar donación → consultar donaciones → reservar → confirmar entrega → actualizar estadísticas.

| Fase | Horario | Backend: Anthony | Frontend: Diego |
| --- | --- | --- | --- |
| F0 | 08:30–09:15 | Levantar PostgreSQL y FastAPI; comprobar /api/health | Clonar, iniciar React y revisar cliente API |
| F1 | 09:15–11:30 | Probar POST y GET /donations, GET /donations/{id} y PATCH /reserve | Formulario, tarjetas de donaciones y botón de reserva |
| F2 | 11:30–13:00 | Validar PATCH /deliver, GET /stats y persistencia en PostgreSQL | Integrar entrega y estadísticas; ajustar vista móvil |
| F3 | 14:00–15:30 | Pruebas de API, estados y errores en base aislada | Probar interfaz, formularios, carga y errores |
| F4 | 15:30–16:00 | Integración en GitHub y documentación del backend | Integración en GitHub y documentación del frontend |
| F5 | 16:00–16:30 | Revisar demostración | Preparar y ensayar presentación |

**Pausa de almuerzo:** 13:00–14:00.

## Puntos de control

- **11:30:** registrar, listar y reservar alimentos.
- **13:00:** confirmar entrega y visualizar estadísticas.
- **15:30:** pruebas del flujo completo.
- **16:00:** código integrado en el repositorio.
- **16:30:** presentación preparada, con máximo cinco diapositivas y exposición de tres minutos.

## Endpoints acordados

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /api/health | Estado del backend |
| GET | /api/donations | Listar y filtrar |
| GET | /api/donations/{id} | Consultar detalle |
| POST | /api/donations | Registrar |
| PATCH | /api/donations/{id}/reserve | Reservar |
| PATCH | /api/donations/{id}/deliver | Confirmar entrega |
| GET | /api/stats | Resumen del panel |

Los modelos JSON y códigos de respuesta están en [API_CONTRACT.md](API_CONTRACT.md).

## Lista de comprobación

- [ ] PostgreSQL, backend y frontend se inician con Docker Compose.
- [ ] Las donaciones permanecen guardadas después de reiniciar.
- [ ] El formulario registra una donación válida.
- [ ] La reserva impide que se reserve dos veces.
- [ ] La entrega actualiza el panel.
- [ ] Los tests se ejecutan sin alterar los datos de la demostración.
- [ ] El repositorio contiene los cambios de ambos integrantes.
- [ ] La demostración y las diapositivas están preparadas.

No se incluyen pagos, autenticación o geolocalización en el alcance de esta primera versión. La plataforma usa datos ficticios durante la presentación.
