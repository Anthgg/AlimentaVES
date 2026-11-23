# Trabajo de dos integrantes

## Clonar
```bash
git clone https://github.com/Anthgg/AlimentaVES.git
cd AlimentaVES
```

## Responsabilidades
- **Jesus Anthony Garamendi Gonzales (Backend):** trabajar en `back/` y mantener `docs/API_CONTRACT.md` actualizado.
- **Diego Manuel Pizango Chanchari (Frontend):** trabajar en `front/` y consumir `src/lib/api.ts`.
- Ambos: aprobar cambios al contrato antes de alterar request/response.

## Ramas propuestas
```bash
# Integrante frontend
git switch -c feat/frontend
# ... editar solo front/
git add front/
git commit -m "feat(front): implementar interfaz AlimentaVES"
git push -u origin feat/frontend
```

```bash
# Integrante backend
git switch -c feat/backend
# ... editar solo back/
git add back/
git commit -m "feat(back): completar API de donaciones"
git push -u origin feat/backend
```

Crear PR contra `main`. Antes de integrar:
```bash
git fetch origin
git rebase origin/main
```

Clonar repositorio público requiere solo acceso de lectura. Para `git push`, el compañero necesita permiso de escritura como colaborador; alternativamente puede hacer un fork y abrir PR.

## Acordar antes de trabajar
- JSON en `snake_case`.
- Backend en `localhost:8000` y frontend en `localhost:5173`.
- Estados exactamente: `available`, `reserved`, `delivered`.
- La demo utiliza datos ficticios etiquetados. Probar todo el flujo antes del cierre del hackatón.
