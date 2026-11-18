"""Cola de trabajos de generación en segundo plano.

- Un único trabajador: las generaciones se ejecutan de una en una, en orden.
- Cada trabajo guarda en disco su entrada, su imagen de referencia, el GLB
  resultante y un job.json con procedencia, motor, licencia y parámetros.
- El GLB se valida antes de marcar el trabajo como completado.
"""

from __future__ import annotations

import json
import os
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..export.glb_validator import validate_glb
from ..generation.base_provider import GenerationRequest, ProviderUnavailableError
from ..generation.provider_manager import ProviderManager


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Job:
    id: str
    provider: str
    status: str  # queued | running | succeeded | failed | cancelled
    progress: float
    message: str
    createdAt: str  # noqa: N815
    updatedAt: str  # noqa: N815
    params: dict[str, Any]
    name: str
    category: str
    error: str | None = None
    engine: str | None = None
    license: str | None = None
    sizeBytes: int | None = None  # noqa: N815
    hasReference: bool = False  # noqa: N815
    metadata: dict[str, Any] = field(default_factory=dict)
    durationSeconds: float | None = None  # noqa: N815

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def storage_dir() -> Path:
    root = Path(os.environ.get("ALAGARDA_STORAGE_DIR", "./storage"))
    if not root.is_absolute():
        root = Path(__file__).resolve().parents[2] / root
    return root


class JobManager:
    def __init__(self, providers: ProviderManager, root: Path | None = None) -> None:
        self.providers = providers
        self.root = (root or storage_dir()) / "generations"
        self.root.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="alagarda-gen")
        self._load_history()

    # ------------------------------------------------------------------ persistencia
    def _dir(self, job_id: str) -> Path:
        return self.root / job_id

    def _save(self, job: Job) -> None:
        d = self._dir(job.id)
        d.mkdir(parents=True, exist_ok=True)
        tmp = d / "job.json.tmp"
        tmp.write_text(json.dumps(job.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(d / "job.json")

    def _load_history(self) -> None:
        for meta in self.root.glob("*/job.json"):
            try:
                data = json.loads(meta.read_text(encoding="utf-8"))
                job = Job(**data)
            except (OSError, ValueError, TypeError):
                continue
            if job.status in ("queued", "running"):
                # El motor se reinició con el trabajo a medias.
                job.status, job.error, job.message = "failed", "El motor se cerró durante la generación.", "Interrumpido"
                self._save(job)
            self._jobs[job.id] = job

    # ------------------------------------------------------------------ API pública
    def list(self) -> list[Job]:
        with self._lock:
            return sorted(self._jobs.values(), key=lambda j: j.createdAt, reverse=True)

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def result_path(self, job_id: str) -> Path:
        return self._dir(job_id) / "model.glb"

    def reference_path(self, job_id: str) -> Path | None:
        d = self._dir(job_id)
        for name in ("reference.png", "reference.jpg", "reference.webp", "input.png"):
            if (d / name).exists():
                return d / name
        return None

    def submit(
        self,
        provider_id: str,
        prompt: str | None,
        image: bytes | None,
        image_name: str | None,
        seed: int | None,
        quality: str,
        name: str,
        category: str,
    ) -> Job:
        provider = self.providers.get(provider_id)  # KeyError si no existe
        status = provider.status()
        if not status.available:
            raise ProviderUnavailableError(status.reason or "Proveedor no disponible.")
        if not image and not (prompt and prompt.strip()):
            raise ValueError("Indica una imagen de referencia o una descripción.")

        ts = _now()
        job = Job(
            id=uuid.uuid4().hex[:12],
            provider=provider_id,
            status="queued",
            progress=0.0,
            message="En cola",
            createdAt=ts,
            updatedAt=ts,
            params={"prompt": prompt, "seed": seed, "quality": quality, "imageName": image_name},
            name=name,
            category=category,
            license=status.license,
        )
        d = self._dir(job.id)
        d.mkdir(parents=True, exist_ok=True)
        if image:
            (d / "input.png").write_bytes(image)
        with self._lock:
            self._jobs[job.id] = job
        self._save(job)
        request = GenerationRequest(prompt=prompt, images=[image] if image else [], seed=seed, quality=quality)
        self._executor.submit(self._run, job.id, request)
        return job

    def cancel(self, job_id: str) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job and job.status == "queued":
                job.status, job.message, job.updatedAt = "cancelled", "Cancelado", _now()
        if job:
            self._save(job)
        return job

    # ------------------------------------------------------------------ ejecución
    def _update(self, job: Job, **changes: Any) -> None:
        with self._lock:
            for k, v in changes.items():
                setattr(job, k, v)
            job.updatedAt = _now()
        self._save(job)

    def _run(self, job_id: str, request: GenerationRequest) -> None:
        job = self.get(job_id)
        if job is None or job.status == "cancelled":
            return
        started = time.monotonic()
        self._update(job, status="running", message="Iniciando…", progress=0.0)

        last_save = [0.0]

        def progress(fraction: float, message: str) -> None:
            fraction = max(job.progress, min(1.0, float(fraction)))
            with self._lock:
                job.progress, job.message, job.updatedAt = fraction, message, _now()
            if time.monotonic() - last_save[0] > 2:
                last_save[0] = time.monotonic()
                self._save(job)

        try:
            result = self.providers.generate(job.provider, request, progress)
            report = validate_glb(result.glb)
            if not report.ok:
                raise RuntimeError("El GLB generado no es válido: " + "; ".join(report.errors))
            d = self._dir(job.id)
            self.result_path(job.id).write_bytes(result.glb)
            if result.reference_image:
                (d / "reference.png").write_bytes(result.reference_image)
            self._update(
                job,
                status="succeeded",
                progress=1.0,
                message="Completado",
                engine=result.engine,
                license=result.license,
                sizeBytes=len(result.glb),
                hasReference=bool(result.reference_image),
                metadata={**result.metadata, "validation": {"warnings": report.warnings, "counts": report.counts}},
                durationSeconds=round(time.monotonic() - started, 1),
            )
        except Exception as exc:  # noqa: BLE001 — cualquier fallo debe quedar registrado en el trabajo
            self._update(
                job,
                status="failed",
                message="Error",
                error=str(exc) or exc.__class__.__name__,
                durationSeconds=round(time.monotonic() - started, 1),
                metadata={"trace": traceback.format_exc(limit=4)},
            )

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
