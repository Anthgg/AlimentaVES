# AlimentaVES

**HackODS UA 2026 · Villa El Salvador**

AlimentaVES es una plataforma web que busca conectar donantes de alimentos con comedores populares. Con el proyecto queremos ayudar a aprovechar alimentos aptos para consumo que, de otro modo, podrían desperdiciarse.

Nuestro trabajo se relaciona con el **ODS 2 (Hambre Cero)** y el **ODS 12 (Producción y Consumo Responsables)**.

## Integrantes

| Integrante | Responsabilidad |
| --- | --- |
| Jesus Anthony Garamendi Gonzales | Backend, API y base de datos |
| Diego Manuel Pizango Chanchari | Frontend e integración |

## ¿Cómo funciona?

1. El donante registra el alimento, su cantidad, la fecha de vencimiento y el punto de recojo.
2. Las donaciones disponibles aparecen en la plataforma.
3. Un comedor puede reservar una donación.
4. Al confirmar la entrega, se actualizan las estadísticas.

La demostración utiliza nombres y ubicaciones ficticias. Para poner la plataforma en funcionamiento con donaciones reales se necesitarían controles de seguridad alimentaria, verificación de participantes y protección de datos.

## Tecnologías

- **Frontend:** React, TypeScript y Vite.
- **Backend:** Python, FastAPI y Pydantic.
- **Base de datos:** PostgreSQL 16.
- **Entorno de desarrollo:** Docker Compose.

## Organización del repositorio

```text
AlimentaVES/
├── back/                  API y pruebas de backend
├── front/                 Interfaz y cliente HTTP
├── docker/postgres/init/  Base de pruebas
├── docs/                  Arquitectura, fases y contrato de API
└── compose.yaml           Servicios PostgreSQL, backend y frontend
```

## Instalación

Se necesita Git y Docker con Compose instalado.

```bash
git clone https://github.com/Anthgg/AlimentaVES.git
cd AlimentaVES
docker compose up --build -d
docker compose ps
```

Direcciones del proyecto:

| Servicio | Dirección |
| --- | --- |
| Aplicación web | http://localhost:5173 |
| Documentación de API | http://localhost:8000/docs |
| Estado de API | http://localhost:8000/api/health |
| PostgreSQL | localhost:5433 |

Para consultar los registros:

```bash
docker compose logs -f
```

Para detener el proyecto sin borrar la información:

```bash
docker compose down
```

La información de PostgreSQL se conserva en un volumen Docker. El comando `docker compose down -v` elimina los volúmenes y no debe utilizarse para detener el trabajo diario.

## Desarrollo

Tenemos separadas las carpetas de backend y frontend para avanzar en paralelo. Los endpoints y campos JSON se encuentran en [el contrato de API](docs/API_CONTRACT.md), mientras que las actividades y horarios están en [nuestro plan de fases](docs/FASES.md).

También dejamos las instrucciones de cada parte en [back/README.md](back/README.md) y [front/README.md](front/README.md).

## Entregables

- Repositorio con código y documentación.
- Demostración funcional del registro, reserva y entrega de alimentos.
- Presentación de tres minutos con un máximo de cinco diapositivas.

**Proyecto desarrollado por Jesus Anthony Garamendi Gonzales y Diego Manuel Pizango Chanchari.**
