from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile

from ...export.glb_validator import validate_glb
from ..schemas.models import GlbValidationResponse

router = APIRouter(prefix="/api/glb", tags=["glb"])

MAX_UPLOAD_BYTES = 1024 * 1024 * 1024  # 1 GB


@router.post("/validate", response_model=GlbValidationResponse)
async def validate(file: UploadFile) -> dict:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máximo 1 GB).")
    return validate_glb(data).to_dict()
