# Frontend de AlimentaVES

**Responsable: Diego Manuel Pizango Chanchari**

Esta es mi parte del proyecto. Voy a hacer que la página sea fácil de entender y que se pueda usar bien tanto en laptop como en celular. Anthony se encarga de las API, así que yo voy a consumirlas sin cambiar las rutas ni los JSON por mi cuenta.

## Tecnologías

- React y TypeScript para las pantallas.
- Vite para levantar el proyecto rápido.
- CSS para los estilos (si decidimos agregar librerías, primero revisamos el tiempo).
- `fetch` desde `src/lib/api.ts` para conectarnos al backend.

## Cómo iniciar mi parte

Desde la raíz del repositorio, con Docker Desktop abierto:
```bash
docker compose up --build -d
docker compose logs -f front
```

La página abre en http://localhost:5173 y la API en http://localhost:8000/docs.

Si trabajo sin Docker, desde `front/`:
```bash
npm install
npm run dev
```

Para comprobar que no rompí la compilación:
```bash
docker compose exec front npm run build
```

## Pantallas que voy a preparar

1. **Inicio:** explicar rápido qué hace AlimentaVES y mostrar un botón para donar.
2. **Donaciones disponibles:** tarjetas con alimento, cantidad, lugar, vencimiento y estado.
3. **Publicar donación:** formulario con campos obligatorios y mensajes de error.
4. **Reserva y entrega:** botones que cambian el estado de una donación usando la API.
5. **Panel de resultados:** donaciones disponibles, reservadas, entregadas y kilos entregados.

No necesitamos cinco rutas diferentes para la demo. Se puede hacer en una sola página bien organizada, y luego separar componentes si queda tiempo.

## API que voy a consumir

Todas las llamadas ya están agrupadas en `src/lib/api.ts`:
- `api.listDonations()` → GET `/donations`
- `api.getDonation(id)` → GET `/donations/{id}`
- `api.createDonation(datos)` → POST `/donations`
- `api.reserve(id, nombre)` → PATCH `/donations/{id}/reserve`
- `api.deliver(id)` → PATCH `/donations/{id}/deliver`
- `api.stats()` → GET `/stats`

En Docker, la URL para el **navegador** es `http://localhost:8000/api`. No debo cambiarla por `http://back:8000`, porque ese nombre solo funciona entre contenedores.

## Fases que me corresponden

- [x] **Base inicial:** React, cliente API y pantalla de ejemplo creados.
- [ ] **Fase 0:** abrir la página usando Docker y comprobar que carga datos.
- [ ] **Fase 1:** terminar la vista de donaciones y el formulario.
- [ ] **Fase 2:** hacer que reservar/entregar funcionen y que el panel se actualice.
- [ ] **Fase 3:** mejorar responsive, estados de carga y mensajes de error.
- [ ] **Fase 4:** probar junto a Anthony y dejar lista la demo.

Las fases detalladas están en [docs/FASES.md](../docs/FASES.md), y los nombres de campos en [docs/API_CONTRACT.md](../docs/API_CONTRACT.md).

## Cosas que no debo olvidar

- No mostrar como reales las donaciones ficticias.
- Mostrar un mensaje cuando la API no responda y cuando no haya registros.
- No duplicar los `fetch` en cada componente; para eso está `src/lib/api.ts`.
- Antes del cierre, dejar de agregar funciones y revisar que la demo se pueda hacer sin errores.
