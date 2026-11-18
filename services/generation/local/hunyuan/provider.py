"""Adaptador de Hunyuan3D (Tencent) — motor experimental.

Su licencia tiene condiciones territoriales específicas. No se activa hasta
verificar los derechos aplicables en España y la UE (ver docs/LICENSES.md).
"""

from __future__ import annotations

import os

from ...base_provider import (
    BaseProvider,
    Capability,
    GenerationRequest,
    GenerationResult,
    ProviderKind,
    ProviderUnavailableError,
)


class HunyuanProvider(BaseProvider):
    id = "hunyuan3d"
    name = "Hunyuan3D (experimental)"
    kind = ProviderKind.LOCAL
    capabilities = (Capability.IMAGE_TO_3D, Capability.TEXT_TO_3D, Capability.PBR_TEXTURES)
    license = "Tencent Hunyuan Community License — condiciones territoriales"
    license_review_required = True

    def is_enabled(self) -> bool:
        return os.environ.get("HUNYUAN_ENABLED", "false").lower() == "true"

    def check_availability(self) -> tuple[bool, str | None]:
        return False, "Pendiente de revisión de licencia para España/UE antes de integrarlo."

    def generate(self, request: GenerationRequest) -> GenerationResult:
        raise ProviderUnavailableError("Hunyuan3D no está integrado.")
