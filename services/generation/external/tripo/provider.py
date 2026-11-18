"""Adaptador de Tripo — proveedor externo opcional.

DESACTIVADO por defecto. Funciona con créditos de pago y el plan gratuito
limita la exportación y el uso comercial. Para activarlo:
TRIPO_ENABLED=true, TRIPO_API_KEY y un límite TRIPO_MAX_CREDITS_PER_SESSION > 0.
Nunca se envían modelos privados sin autorización explícita del usuario.
"""

from __future__ import annotations

import os

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


class TripoProvider(BaseProvider):
    id = "tripo"
    name = "Tripo (externo)"
    kind = ProviderKind.EXTERNAL
    capabilities = (Capability.TEXT_TO_3D, Capability.IMAGE_TO_3D, Capability.MULTI_IMAGE_TO_3D, Capability.PBR_TEXTURES)
    license = "Según plan: el gratuito restringe exportación y uso comercial"
    license_review_required = True
    sends_data_externally = True

    def is_enabled(self) -> bool:
        return os.environ.get("TRIPO_ENABLED", "false").lower() == "true"

    def credit_limit(self) -> int:
        try:
            return int(os.environ.get("TRIPO_MAX_CREDITS_PER_SESSION", "0"))
        except ValueError:
            return 0

    def check_availability(self) -> tuple[bool, str | None]:
        if not get_secret("TRIPO_API_KEY"):
            return False, "Falta TRIPO_API_KEY en el archivo .env del motor local."
        if self.credit_limit() <= 0:
            return False, "Define TRIPO_MAX_CREDITS_PER_SESSION > 0 para evitar gastos imprevistos."
        return False, "Configurado. El adaptador de API se implementa en la Fase 5."

    def generate(self, request: GenerationRequest, progress: ProgressFn | None = None) -> GenerationResult:
        raise ProviderUnavailableError("El adaptador de Tripo se implementa en la Fase 5.")
