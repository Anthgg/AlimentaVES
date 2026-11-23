from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import cors_origins, demo_seed_enabled
from .database import init_db
from .routes import community_kitchens, donations, stats
from .seed import seed_demo_if_empty

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if demo_seed_enabled():
        seed_demo_if_empty()
    yield

app = FastAPI(
    title="AlimentaVES API",
    description="API de demostración para rescate solidario de alimentos. No es un sistema productivo.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)

@app.get("/api/health", tags=["Sistema"])
def health():
    return {"status": "ok"}

app.include_router(donations.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(community_kitchens.router, prefix="/api")
