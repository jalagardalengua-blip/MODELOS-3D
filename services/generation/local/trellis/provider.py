"""Adaptador de TRELLIS (Microsoft) — motor local prioritario.

Fase 1: solo comprueba si el equipo puede ejecutarlo.
Fase 2: lanzará la inferencia en un proceso aparte usando la instalación
indicada en TRELLIS_PATH, y devolverá el GLB resultante.
"""

from __future__ import annotations

import os
from pathlib import Path

from ...base_provider import (
    BaseProvider,
    Capability,
    GenerationRequest,
    GenerationResult,
    ProviderKind,
    ProviderUnavailableError,
)
from ...hardware import detect_hardware

MIN_VRAM_GB = 16.0


class TrellisProvider(BaseProvider):
    id = "trellis"
    name = "TRELLIS (local)"
    kind = ProviderKind.LOCAL
    capabilities = (Capability.IMAGE_TO_3D, Capability.TEXT_TO_3D, Capability.PBR_TEXTURES, Capability.VARIANTS)
    license = "MIT (código); revisar dependencias y pesos"
    license_review_required = True

    def check_availability(self) -> tuple[bool, str | None]:
        hw = detect_hardware()
        if not hw.cuda:
            return False, "Requiere una GPU NVIDIA con CUDA; no se ha detectado ninguna."
        vram = hw.max_nvidia_vram_gb()
        if vram < MIN_VRAM_GB:
            return False, f"Requiere al menos {MIN_VRAM_GB:.0f} GB de VRAM; la GPU detectada tiene {vram:.0f} GB."
        path = os.environ.get("TRELLIS_PATH", "").strip()
        if not path:
            return False, "GPU compatible. Falta instalar TRELLIS e indicar su ruta en TRELLIS_PATH."
        if not Path(path).is_dir():
            return False, f"TRELLIS_PATH no existe: {path}"
        return False, "Instalación detectada. La integración de inferencia llega en la Fase 2."

    def generate(self, request: GenerationRequest) -> GenerationResult:
        raise ProviderUnavailableError("La generación con TRELLIS se implementa en la Fase 2.")
