# Frontend de AlimentaVES

**Responsable:** Diego Manuel Pizango Chanchari

En esta carpeta trabajamos la interfaz web para que donantes y comedores puedan consultar los alimentos disponibles y seguir el proceso de donación.

## Tecnologías

- React
- TypeScript
- Vite
- CSS
- API REST del backend FastAPI

La base de datos es PostgreSQL. El frontend no se conecta directamente a ella; utiliza la API del backend.

## Cómo ejecutarlo

Desde la raíz del repositorio:

```bash
docker compose up --build -d
```

La aplicación estará en http://localhost:5173.

Para trabajar sin Docker:

```bash
cd front
npm install
npm run dev
```

## Pantallas

1. Inicio e información del proyecto.
2. Listado de donaciones disponibles.
3. Formulario de registro de alimentos.
4. Reserva y confirmación de entrega.
5. Directorio de comedores populares con OpenStreetMap.
6. Panel con el resumen de donaciones.

## Integración con el backend

El cliente HTTP se encuentra en `src/lib/api.ts`. Los endpoints disponibles son:

| Función | Endpoint |
| --- | --- |
| Listar donaciones | GET /api/donations |
| Consultar detalle | GET /api/donations/{id} |
| Crear donación | POST /api/donations |
| Reservar | PATCH /api/donations/{id}/reserve |
| Confirmar entrega | PATCH /api/donations/{id}/deliver |
| Ver estadísticas | GET /api/stats |
| Listar comedores populares | GET /api/community-kitchens |
| Consultar comedor | GET /api/community-kitchens/{id} |

El contrato con ejemplos de peticiones y respuestas está en [API_CONTRACT.md](../docs/API_CONTRACT.md).

## Comedores y OpenStreetMap

El directorio consume las coordenadas WGS84 de `GET /api/community-kitchens` y las muestra en el mapa incrustado de OpenStreetMap. También incluye un enlace para abrir la ubicación directamente en OpenStreetMap. No requiere API key ni configuración adicional.

El mapa incluye atribución a OpenStreetMap contributors. La ubicación y el estado del comedor proceden de la fuente pública indicada por el backend; no representan una verificación de operación actual.

## Verificación

```bash
docker compose exec front npm run build
```

## Fases asignadas

- [x] Crear el proyecto React y el cliente API inicial.
- [ ] Verificar conexión con el backend.
- [ ] Completar formulario y listado de donaciones.
- [ ] Integrar reservas, entregas y estadísticas.
- [ ] Ajustar diseño para laptop y móvil.
- [ ] Probar el flujo completo con el backend.

Las tareas por horario están en [FASES.md](../docs/FASES.md).
