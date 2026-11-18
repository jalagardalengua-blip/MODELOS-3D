from __future__ import annotations

from fastapi import APIRouter, Request

from ...generation.hardware import detect_hardware
from ..schemas.models import HardwareResponse, HealthResponse, ProvidersResponse

router = APIRouter(prefix="/api", tags=["sistema"])

VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", name="ALAGARDA 3D STUDIO · motor local", version=VERSION)


@router.get("/hardware", response_model=HardwareResponse)
def hardware() -> dict:
    return detect_hardware().to_dict()


@router.get("/providers", response_model=ProvidersResponse)
def providers(request: Request) -> dict:
    manager = request.app.state.providers
    return {"providers": [s.to_dict() for s in manager.statuses()]}
