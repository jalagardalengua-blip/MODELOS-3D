"""Motor local de ALAGARDA 3D STUDIO.

Arranque (desde la raíz del repositorio):
    python -m uvicorn services.api.main:app --host 127.0.0.1 --port 8000

Escucha solo en 127.0.0.1 por defecto: el motor no debe exponerse a la red.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..generation.provider_manager import ProviderManager
from .jobs import JobManager
from .routes import generation, glb, system
from .security.secrets import load_env_file


def create_app(manager: ProviderManager | None = None, jobs: JobManager | None = None) -> FastAPI:
    load_env_file()
    app = FastAPI(title="ALAGARDA 3D STUDIO · motor local", version=system.VERSION)
    origins = [
        o.strip()
        for o in os.environ.get("ALAGARDA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",")
        if o.strip()
    ]
    # tauri://localhost y http://tauri.localhost: aplicación de escritorio (Fase 5)
    origins += ["tauri://localhost", "http://tauri.localhost"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.state.providers = manager or ProviderManager()
    app.state.jobs = jobs or JobManager(app.state.providers)
    app.include_router(system.router)
    app.include_router(glb.router)
    app.include_router(generation.router)
    return app


app = create_app()
