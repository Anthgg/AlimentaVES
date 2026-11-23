# Frontend | AlimentaVES

Stack: React 19, TypeScript y Vite. Una interfaz de arranque ya consume el contrato del backend; el integrante frontend puede rediseñarla libremente sin modificar las rutas API.

```bash
cd front
npm install
# copiar .env.example a .env (opcional, URL por defecto localhost:8000)
npm run dev
```

- App: http://localhost:5173
- Build: `npm run build`
- API: `src/lib/api.ts`
- Tipos compartidos a nivel de contrato: `src/types.ts`
- Ver `../docs/API_CONTRACT.md`.

**Nota:** El botón de reserva utiliza un nombre de comedor ficticio como demostración hasta que exista autenticación.
