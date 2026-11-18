"""TRELLIS.2 ejecutado en el Space oficial de Microsoft en Hugging Face.

- Gratuito: usa ZeroGPU de Hugging Face (cupo diario, mayor con HF_TOKEN).
- Imagen → 3D. Para texto → 3D se genera antes una imagen de referencia con
  un Space de texto → imagen (FLUX.1 schnell) preparada para reconstrucción 3D.
- Licencia del modelo TRELLIS.2: MIT (código y pesos según su model card);
  revisar antes de uso comercial (ver docs/LICENSES.md).

Flujo del Space:
    [start_session] → preprocess_image → image_to_3d → extract_glb
"""

from __future__ import annotations

import json
import os
import random
import shutil
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any

from ....api.security.secrets import get_secret
from ...base_provider import (
    BaseProvider,
    Capability,
    GenerationRequest,
    GenerationResult,
    ProgressFn,
    ProviderKind,
    ProviderUnavailableError,
)
from .space_client import SpaceClient, SpaceError, find_glb, gradio_client_available
from .text_to_image import TextToImage

DEFAULT_SPACE = "microsoft/TRELLIS.2"
MAX_SEED = 2**31 - 1

# Calidades: resolución del modelo, tamaño de textura y número de caras objetivo.
QUALITY_PRESETS: dict[str, dict[str, Any]] = {
    "borrador": {"resolution": "512", "texture_size": 1024, "decimation_target": 150_000},
    "alta": {"resolution": "1024", "texture_size": 2048, "decimation_target": 400_000},
    "maxima": {"resolution": "1536", "texture_size": 4096, "decimation_target": 1_000_000},
}


def _space_runtime_stage(space_id: str, token: str | None, timeout: float = 4.0) -> str | None:
    """Consulta el estado del Space (RUNNING, SLEEPING, BUILDING…). None si no se pudo."""
    req = urllib.request.Request(f"https://huggingface.co/api/spaces/{space_id}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (URL fija https)
            data = json.loads(resp.read().decode("utf-8"))
        return (data.get("runtime") or {}).get("stage")
    except Exception:  # noqa: BLE001
        return None


class Trellis2SpaceProvider(BaseProvider):
    id = "trellis2-hf"
    name = "TRELLIS.2 · Hugging Face (gratis)"
    kind = ProviderKind.EXTERNAL
    capabilities = (Capability.IMAGE_TO_3D, Capability.TEXT_TO_3D, Capability.PBR_TEXTURES, Capability.VARIANTS)
    license = "TRELLIS.2: MIT · imagen de referencia FLUX.1 schnell: Apache-2.0"
    license_review_required = True
    sends_data_externally = True

    _status_cache: tuple[float, bool, str | None] | None = None
    _STATUS_TTL = 120.0

    def __init__(self, client_factory: Any = None, file_wrapper: Any = None, text_to_image: TextToImage | None = None):
        self._client_factory = client_factory
        self._file_wrapper = file_wrapper
        self._t2i = text_to_image

    @property
    def space_id(self) -> str:
        return os.environ.get("TRELLIS2_SPACE", DEFAULT_SPACE).strip() or DEFAULT_SPACE

    def is_enabled(self) -> bool:
        # Gratuito: activado por defecto. Se puede desactivar con HF_SPACES_ENABLED=false.
        return os.environ.get("HF_SPACES_ENABLED", "true").lower() != "false"

    def check_availability(self) -> tuple[bool, str | None]:
        if not gradio_client_available():
            return False, "Falta gradio_client: python -m pip install -r services/requirements.txt"
        now = time.monotonic()
        cache = type(self)._status_cache
        if cache and now - cache[0] < self._STATUS_TTL:
            return cache[1], cache[2]
        stage = _space_runtime_stage(self.space_id, get_secret("HF_TOKEN"))
        if stage is None:
            result = (False, "No se puede contactar con Hugging Face. Comprueba tu conexión a Internet.")
        elif stage in ("RUNNING", "RUNNING_BUILDING", "SLEEPING", "PAUSED_BY_INACTIVITY"):
            # Un Space dormido se despierta con la primera petición.
            result = (True, None)
        else:
            result = (False, f"El Space {self.space_id} no está disponible ahora mismo (estado: {stage}).")
        type(self)._status_cache = (now, *result)
        return result

    # ------------------------------------------------------------------ generación
    def _client(self, workdir: Path) -> SpaceClient:
        return SpaceClient(
            self.space_id,
            token=get_secret("HF_TOKEN"),
            download_dir=workdir,
            client_factory=self._client_factory,
            file_wrapper=self._file_wrapper,
        )

    def generate(self, request: GenerationRequest, progress: ProgressFn | None = None) -> GenerationResult:
        report = progress or (lambda _f, _m: None)
        quality = QUALITY_PRESETS.get(request.quality, QUALITY_PRESETS["alta"])
        seed = request.seed if request.seed is not None else random.randint(0, MAX_SEED)
        workdir = Path(tempfile.mkdtemp(prefix="alagarda-trellis2-"))
        metadata: dict[str, Any] = {"space": self.space_id, "seed": seed, "quality": request.quality, **quality}

        try:
            # 1. Imagen de referencia (subida por el usuario o generada desde texto)
            if request.images:
                image_path = workdir / "reference.png"
                image_path.write_bytes(request.images[0])
                metadata["input"] = "image"
                span = (0.0, 0.05)
            elif request.prompt:
                t2i = self._t2i or TextToImage(token=get_secret("HF_TOKEN"), client_factory=self._client_factory, file_wrapper=self._file_wrapper)
                report(0.01, "Generando imagen de referencia desde el texto…")
                image_path = t2i.generate(request.prompt, workdir, seed=seed, progress=report, progress_range=(0.01, 0.2))
                metadata.update({"input": "text", "reference_space": t2i.space_id, "reference_prompt": t2i.last_prompt})
                span = (0.2, 0.25)
            else:
                raise ProviderUnavailableError("Indica una imagen de referencia o una descripción.")
            request.options["reference_image_path"] = str(image_path)

            # 2. Conexión al Space y sesión
            report(span[0], f"Conectando con {self.space_id}…")
            client = self._client(workdir)
            client.connect()
            for session_ep in ("/start_session", "/lambda"):
                if client.has_endpoint(session_ep) and not client.parameter_names(session_ep):
                    try:
                        client.call(session_ep, {}, label="Sesión")
                    except SpaceError:
                        pass
                    break

            # 3. Preprocesado (eliminación de fondo) si el Space lo expone por separado
            image_arg = client.file(image_path)
            if client.has_endpoint("/preprocess_image"):
                out = client.call("/preprocess_image", {"image": image_arg, "input": image_arg}, report, (span[0], span[1]), "Eliminando fondo")
                pre = _first_path(out)
                if pre:
                    image_arg = client.file(pre)

            # 4. Imagen → 3D
            gen_ep = _pick_endpoint(client, ["/image_to_3d", "/generate", "/generate_3d"], ("3d", "generate"))
            extract_ep = _pick_endpoint(client, ["/extract_glb", "/export_glb"], ("glb",), required=False)
            gen_lo = span[1]
            gen_out = client.call(
                gen_ep,
                {
                    "image": image_arg,
                    "seed": seed,
                    "randomize_seed": False,
                    "resolution": quality["resolution"],
                },
                report,
                (gen_lo, 0.8),
                "Generando geometría y materiales (TRELLIS.2)",
            )

            # 5. Extracción del GLB con texturas PBR (algunas versiones lo devuelven directamente)
            direct = find_glb(gen_out)
            if direct or not extract_ep:
                out = gen_out
            else:
                out = client.call(
                extract_ep,
                {
                    "decimation_target": quality["decimation_target"],
                    "texture_size": quality["texture_size"],
                    "mesh_simplify": 0.95,
                },
                report,
                (0.8, 0.97),
                "Extrayendo GLB con texturas PBR",
                )
            glb_path = find_glb(out)
            if not glb_path:
                raise SpaceError(f"El Space no devolvió un archivo GLB. Salida recibida: {out!r}"[:500])
            glb = Path(glb_path).read_bytes()
            reference = Path(image_path).read_bytes()
            report(1.0, "Modelo generado")
            return GenerationResult(
                glb=glb,
                engine=self.id,
                license=self.license,
                metadata=metadata,
                reference_image=reference,
            )
        finally:
            shutil.rmtree(workdir, ignore_errors=True)


def _pick_endpoint(client: SpaceClient, preferred: list[str], contains: tuple[str, ...], required: bool = True) -> str:
    for name in preferred:
        if client.has_endpoint(name):
            return name
    for name in client.endpoints():
        if any(c in name.lower() for c in contains):
            return name
    if required:
        raise SpaceError(f"El Space {client.space_id} no tiene un endpoint compatible. Endpoints: {client.endpoints()}")
    return ""


def _first_path(output: Any) -> str | None:
    from .space_client import extract_file_path

    return extract_file_path(output)
