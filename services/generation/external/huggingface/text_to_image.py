"""Texto → imagen de referencia para reconstrucción 3D.

TRELLIS.2 reconstruye a partir de una imagen. Para describir un modelo con
palabras, primero se genera una imagen con FLUX.1 schnell (Apache-2.0) en
Hugging Face, con un encuadre pensado para 3D: un único objeto completo,
centrado, vista 3/4, fondo liso y luz de estudio uniforme.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any

from .space_client import ProgressFn, SpaceClient, SpaceError, extract_file_path

DEFAULT_T2I_SPACE = "black-forest-labs/FLUX.1-schnell"

REFERENCE_SUFFIX = (
    "single subject, full body entirely in frame, centered, three-quarter front view, "
    "isolated on a plain light grey seamless background, soft even studio lighting, "
    "no cast shadows, sharp focus, highly detailed, photorealistic, 3D asset reference"
)


def build_reference_prompt(prompt: str) -> str:
    prompt = prompt.strip().rstrip(".")
    return f"{prompt}. {REFERENCE_SUFFIX}"


class TextToImage:
    def __init__(self, token: str | None = None, client_factory: Any = None, file_wrapper: Any = None) -> None:
        self.space_id = os.environ.get("T2I_SPACE", DEFAULT_T2I_SPACE).strip() or DEFAULT_T2I_SPACE
        self._token = token
        self._client_factory = client_factory
        self._file_wrapper = file_wrapper
        self.last_prompt: str | None = None

    def generate(
        self,
        prompt: str,
        workdir: Path,
        seed: int = 0,
        progress: ProgressFn | None = None,
        progress_range: tuple[float, float] = (0.0, 1.0),
    ) -> Path:
        client = SpaceClient(
            self.space_id,
            token=self._token,
            download_dir=workdir,
            client_factory=self._client_factory,
            file_wrapper=self._file_wrapper,
        )
        client.connect()
        api_name = "/infer" if client.has_endpoint("/infer") else (client.endpoints() or [None])[0]
        if not api_name:
            raise SpaceError(f"El Space {self.space_id} no expone ningún endpoint.")
        self.last_prompt = build_reference_prompt(prompt)
        out = client.call(
            api_name,
            {
                "prompt": self.last_prompt,
                "seed": seed,
                "randomize_seed": False,
                "width": 1024,
                "height": 1024,
                "num_inference_steps": 4,
            },
            progress,
            progress_range,
            "Imagen de referencia (FLUX.1 schnell)",
        )
        src = extract_file_path(out)
        if not src:
            raise SpaceError(f"{self.space_id} no devolvió una imagen. Salida: {out!r}"[:400])
        dest = workdir / ("reference" + (Path(src).suffix or ".png"))
        if Path(src).resolve() != dest.resolve():
            shutil.copyfile(src, dest)
        return dest
