# Fases de trabajo | AlimentaVES

Somos dos integrantes: **Jesus Anthony Garamendi Gonzales (backend)** y **Diego Manuel Pizango Chanchari (frontend)**. Como el hackatón es corto, vamos a terminar primero el recorrido principal y dejar las funciones extra para después.

## Qué es obligatorio para nuestra demo

**Publicar donación → verla en la lista → reservar → confirmar entrega → actualizar estadísticas.**

El resultado debe funcionar de verdad en el navegador, con datos guardados en la base de Docker. Un diseño sin funcionamiento no alcanza.

## Fase 0 | 08:30 a 09:15 — Prepararnos

| Anthony, backend | Diego, frontend |
| --- | --- |
| Levantar Docker y revisar `/api/health` y Swagger. | Clonar el repo, levantar Docker y entrar a `localhost:5173`. |
| Revisar modelos, base de datos y rutas. | Revisar `src/lib/api.ts` y los tipos de `src/types.ts`. |
| Mantener la estructura `back/`. | Mantener la estructura `front/`. |

**Para avanzar:** los dos pueden ejecutar `docker compose up --build -d` y conocen el contrato de API. No se cambia el contrato sin avisar.

## Fase 1 | 09:15 a 11:30 — Núcleo funcional

| Anthony, backend | Diego, frontend |
| --- | --- |
| Validar POST `/donations` y GET `/donations`. | Mostrar lista de donaciones reales desde la API (aunque sean datos de prueba). |
| Validar GET `/donations/{id}`. | Crear el formulario y conectar `api.createDonation`. |
| Validar PATCH `/donations/{id}/reserve`. | Mostrar el botón de reservar con su estado de carga. |
| Comprobar 404/409/422 y vencimiento. | Mostrar errores de la API sin bloquear toda la página. |

**Checkpoint 11:30:** se puede crear, listar y reservar una donación sin inventar datos en el frontend.

## Fase 2 | 11:30 a 13:00 — Interfaz e integración

| Anthony, backend | Diego, frontend |
| --- | --- |
| Validar PATCH `/donations/{id}/deliver`. | Agregar acción de confirmar entrega. |
| Validar GET `/stats` y conteos. | Diseñar las tarjetas de estadísticas con `api.stats()`. |
| Revisar que SQLite conserve datos al reiniciar el backend. | Mejorar la vista para celular y desktop. |

**Checkpoint 13:00:** recorrido completo funcionando, aunque el diseño todavía no esté perfecto.

## 13:00 a 14:00 — Almuerzo

Si la demo ya funciona, no agregar funcionalidades nuevas durante este tiempo.

## Fase 3 | 14:00 a 15:30 — Pruebas

| Anthony, backend | Diego, frontend |
| --- | --- |
| Ejecutar `docker compose exec back python -m pytest -q`. | Ejecutar `docker compose exec front npm run build`. |
| Revisar datos, transiciones y errores. | Probar formulario, filtros, estado vacío y móvil. |
| Comprobar `docker compose down` + `up -d` sin perder donaciones. | Hacer la demo completa con el backend real. |

**Checkpoint 15:30:** flujo probado sin errores bloqueantes. Si algo extra falla, se quita de la demo.

## Fase 4 | 15:30 a 16:00 — Cierre técnico

| Anthony, backend | Diego, frontend |
| --- | --- |
| Revisar Swagger, pruebas y README de `back/`. | Revisar pantallas, compilación y README de `front/`. |
| Subir cambios por su rama y PR. | Subir cambios por su rama y PR. |
| Verificar integración en `main`. | Confirmar que el navegador muestra todo. |

**Checkpoint 16:00:** código integrado en GitHub, README y demo listos. No introducir cambios innecesarios.

## Fase 5 | 16:00 a 16:30 — Pitch

Preparar **máximo 5 diapositivas** y practicar una exposición de **3 minutos**:

1. Problema del desperdicio de alimentos.
2. Solución AlimentaVES y a quién ayuda.
3. ODS 2 y 12.
4. Demo del proceso completo.
5. Impacto esperado y siguientes mejoras.

Las estadísticas del panel son **datos de demostración**, no resultados reales de Villa El Salvador. Si mostramos información local, citar la fuente.

## Contrato API que debemos respetar

| Endpoint | Lo hace Anthony | Lo usa Diego |
| --- | --- | --- |
| GET `/api/health` | Estado de API | Opcional, comprobación |
| GET `/api/donations` | Lista + filtro `status` | Tarjetas/filtros |
| GET `/api/donations/{id}` | Detalle | Detalle si se usa |
| POST `/api/donations` | Validación + guardar | Formulario |
| PATCH `/api/donations/{id}/reserve` | Reserva sin duplicar | Botón reservar |
| PATCH `/api/donations/{id}/deliver` | Cambio a entregado | Botón entregar |
| GET `/api/stats` | Contadores y kilos | Dashboard |

JSON, respuestas y errores: [API_CONTRACT.md](API_CONTRACT.md). No añadir login, pagos, mapas, roles complejos o nuevos módulos durante las fases obligatorias. Si sobra tiempo, se evalúan juntos.

## Prueba final que haremos juntos

- [ ] Abrimos http://localhost:5173 y la API está respondiendo.
- [ ] Publicamos una donación ficticia, válida y con fecha futura.
- [ ] La vemos en la lista.
- [ ] La reservamos y no permite una segunda reserva.
- [ ] Confirmamos entrega.
- [ ] El panel aumenta entregadas y kilos entregados.
- [ ] Reiniciamos contenedores sin borrar el volumen y los datos siguen ahí.
- [ ] El repositorio y el pitch están listos.

Las casillas sin marcar son tareas por verificar, **no resultados que ya hayamos comprobado**.
