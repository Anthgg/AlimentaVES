# Cómo nos repartimos el trabajo

Somos dos:
- **Jesus Anthony Garamendi Gonzales:** backend (`back/`), endpoints, base de datos, validaciones y pruebas.
- **Diego Manuel Pizango Chanchari:** frontend (`front/`), pantallas, formularios, consumo de las API y diseño responsive.

El repositorio es [Anthgg/AlimentaVES](https://github.com/Anthgg/AlimentaVES).

## Para empezar

```bash
git clone https://github.com/Anthgg/AlimentaVES.git
cd AlimentaVES
docker compose up --build -d
```

El plan con las fases y horas está en [FASES.md](FASES.md). El contrato que debe usar el frontend está en [API_CONTRACT.md](API_CONTRACT.md).

## Cada uno en su rama

Anthony:
```bash
git switch -c feat/backend
# trabajar en back/
git add back/
git commit -m "feat(back): mejorar API de donaciones"
git push -u origin feat/backend
```

Diego:
```bash
git switch -c feat/frontend
# trabajar en front/
git add front/
git commit -m "feat(front): mejorar interfaz AlimentaVES"
git push -u origin feat/frontend
```

Después, abrir un Pull Request hacia `main` y revisar el cambio. **main tiene que quedar funcionando** para la demo.

Antes de integrar trabajos de ramas diferentes:
```bash
git fetch origin
git rebase origin/main
```

El repositorio público se puede clonar sin permiso, pero Diego necesita acceso de colaborador para hacer push directo. Como alternativa, puede usar un fork y mandar PR.

## Reglas entre nosotros

1. No cambiar rutas, nombres de campos o estados sin avisar al otro.
2. Usar `snake_case` en el JSON, por ejemplo `donor_name`.
3. Trabajar con datos de prueba, sin nombres, teléfonos ni domicilios privados reales.
4. Si la API devuelve un error, mostrarlo en la pantalla; no esconderlo con datos inventados.
5. Probar todo juntos antes de cerrar: publicar, listar, reservar, entregar y revisar estadísticas.
6. No borrar los volúmenes Docker cuando terminamos de trabajar.

Si tenemos tiempo de sobra, recién pensamos en agregar extras. Si no, con la demo principal estable tenemos lo necesario para presentar.
