from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from ...generation.base_provider import ProviderUnavailableError

router = APIRouter(prefix="/api", tags=["generación"])

MAX_IMAGE_BYTES = 20 * 1024 * 1024
QUALITIES = {"borrador", "alta", "maxima"}


def _jobs(request: Request):
    return request.app.state.jobs


@router.post("/generate", status_code=202)
async def generate(
    request: Request,
    provider: str = Form(...),
    prompt: str | None = Form(None),
    seed: int | None = Form(None),
    quality: str = Form("alta"),
    name: str = Form("Modelo generado"),
    category: str = Form("otro"),
    image: UploadFile | None = File(None),
) -> dict:
    if quality not in QUALITIES:
        raise HTTPException(422, f"Calidad desconocida: {quality}")
    data: bytes | None = None
    if image is not None:
        data = await image.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "La imagen supera los 20 MB.")
        if not data:
            data = None
        elif not (data[:8] == b"\x89PNG\r\n\x1a\n" or data[:3] == b"\xff\xd8\xff" or data[8:12] == b"WEBP"):
            raise HTTPException(415, "La imagen debe ser PNG, JPEG o WebP.")
    try:
        job = _jobs(request).submit(
            provider_id=provider,
            prompt=(prompt or "").strip() or None,
            image=data,
            image_name=image.filename if image else None,
            seed=seed,
            quality=quality,
            name=name.strip() or "Modelo generado",
            category=category,
        )
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ProviderUnavailableError as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return job.to_dict()


@router.get("/jobs")
def list_jobs(request: Request) -> dict:
    return {"jobs": [j.to_dict() for j in _jobs(request).list()[:100]]}


@router.get("/jobs/{job_id}")
def get_job(job_id: str, request: Request) -> dict:
    job = _jobs(request).get(job_id)
    if not job:
        raise HTTPException(404, "Trabajo no encontrado.")
    return job.to_dict()


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, request: Request) -> dict:
    job = _jobs(request).cancel(job_id)
    if not job:
        raise HTTPException(404, "Trabajo no encontrado.")
    return job.to_dict()


@router.get("/jobs/{job_id}/result.glb")
def job_result(job_id: str, request: Request) -> FileResponse:
    jobs = _jobs(request)
    job = jobs.get(job_id)
    path = jobs.result_path(job_id)
    if not job or job.status != "succeeded" or not path.exists():
        raise HTTPException(404, "El resultado no está disponible.")
    return FileResponse(path, media_type="model/gltf-binary", filename=f"{job_id}.glb")


@router.get("/jobs/{job_id}/reference")
def job_reference(job_id: str, request: Request) -> FileResponse:
    path = _jobs(request).reference_path(job_id)
    if not path:
        raise HTTPException(404, "Este trabajo no tiene imagen de referencia.")
    return FileResponse(path)
