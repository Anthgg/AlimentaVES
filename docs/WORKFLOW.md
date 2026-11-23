# Organización del equipo

| Integrante | Responsabilidad | Carpeta |
| --- | --- | --- |
| Jesus Anthony Garamendi Gonzales | Backend, API y PostgreSQL | back/ |
| Diego Manuel Pizango Chanchari | Frontend e integración | front/ |

## Repositorio

```bash
git clone https://github.com/Anthgg/AlimentaVES.git
cd AlimentaVES
docker compose up --build -d
```

## Ramas de trabajo

Backend:
```bash
git switch -c feat/backend
git add back/
git commit -m "feat(back): implementar API de donaciones"
git push -u origin feat/backend
```

Frontend:
```bash
git switch -c feat/frontend
git add front/
git commit -m "feat(front): implementar pantallas"
git push -u origin feat/frontend
```

Cada rama se integra a `main` mediante Pull Request. El colaborador necesita permisos de escritura para subir una rama al repositorio; también puede trabajar desde un fork.

## Acuerdos

- Mantener el contrato de [API_CONTRACT.md](API_CONTRACT.md).
- Utilizar PostgreSQL en Docker.
- Mantener nombres JSON en `snake_case`.
- No borrar el volumen `postgres_data`.
- Probar el flujo completo antes de la presentación.
- Utilizar datos de demostración ficticios.
