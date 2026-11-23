# AlimentaVES 🌱

Proyecto que estamos haciendo para el **HackODS UA 2026**. La idea es que los alimentos que sobran y todavía están en buen estado puedan llegar a comedores populares de Villa El Salvador, en vez de desperdiciarse.

Nos estamos enfocando en el **ODS 2: Hambre Cero** y también en el **ODS 12: Producción y Consumo Responsables**.

## ¿Quiénes somos?

Somos dos estudiantes de Ingeniería de Sistemas:

| Integrante | Parte del proyecto |
| --- | --- |
| **Jesus Anthony Garamendi Gonzales** | Backend, base de datos y API |
| **Diego Manuel Pizango Chanchari** | Frontend, pantallas e integración |

## ¿Qué queremos mostrar?

En la demo una persona podrá publicar una donación de alimentos, un comedor podrá reservarla y después se podrá marcar como entregada. Al final se actualizarán los números del panel.

Por ahora los nombres, comedores y direcciones de la demo son **ficticios**. Todavía no es una plataforma para coordinar entregas reales; antes habría que validar a los participantes, proteger sus datos y revisar la inocuidad de los alimentos.

## Así está organizado

```text
AlimentaVES/
├── back/              # Anthony: Python + FastAPI + SQLite
│   ├── app/
│   ├── tests/
│   ├── Dockerfile
│   └── README.md
├── front/             # Diego: React + TypeScript + Vite
│   ├── src/
│   ├── Dockerfile
│   └── README.md
├── docs/
│   ├── FASES.md        # Nuestro orden de trabajo
│   ├── API_CONTRACT.md # Rutas y JSON acordados
│   ├── ARCHITECTURE.md
│   ├── DOCKER.md
│   └── WORKFLOW.md
└── compose.yaml       # Levanta los dos servicios
```

## Cómo levantar todo con Docker

Necesitamos **Docker Desktop** abierto (o Docker Engine con Compose).

```bash
git clone https://github.com/Anthgg/AlimentaVES.git
cd AlimentaVES
docker compose up --build -d
```

Cuando ambos servicios estén listos:
- **Página web:** http://localhost:5173
- **Documentación de la API:** http://localhost:8000/docs
- **Prueba rápida del backend:** http://localhost:8000/api/health

Para ver qué sucede:
```bash
docker compose ps
docker compose logs -f
```

Para detener sin borrar los datos guardados:
```bash
docker compose down
```

**No usar `docker compose down -v`**, porque sí elimina el volumen de la base de datos. El proyecto también se puede ejecutar sin Docker; las instrucciones están dentro de `back/README.md` y `front/README.md`.

## Cómo vamos a trabajar

- Anthony se concentra en `back/`. Diego se concentra en `front/`.
- Cada uno crea su rama y manda un Pull Request a `main`, que dejamos como rama estable.
- Si hay que cambiar el nombre de una ruta o de un campo JSON, primero lo conversamos. El acuerdo está en [docs/API_CONTRACT.md](docs/API_CONTRACT.md).
- Los tiempos, las fases y lo que tiene que entregar cada uno están en [docs/FASES.md](docs/FASES.md).

## Lo que ya hay y lo que falta

- [x] Separar `back/` y `front/`.
- [x] Escribir un contrato inicial de API.
- [x] Crear código base de donaciones y una pantalla inicial.
- [x] Agregar archivos Docker y plan de fases.
- [ ] Probar la integración completa con Docker en nuestras laptops.
- [ ] Terminar el diseño y revisar errores.
- [ ] Preparar y ensayar el pitch de 3 minutos (máximo 5 diapositivas).

Es un **MVP de hackatón**, así que preferimos que el flujo principal funcione bien antes de agregar cosas que no lleguemos a terminar.

**Equipo AlimentaVES**
