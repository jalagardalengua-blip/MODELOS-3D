"""Contrato común para todos los motores de generación 3D.

Cada proveedor (TRELLIS, Hunyuan3D, Tripo…) implementa esta interfaz. Así la
aplicación puede cambiar de motor sin modificar la interfaz ni el resto del
pipeline.
"""

from __future__ import annotations

import abc
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class ProviderKind(str, Enum):
    LOCAL = "local"
    EXTERNAL = "external"


class Capability(str, Enum):
    TEXT_TO_3D = "text-to-3d"
    IMAGE_TO_3D = "image-to-3d"
    MULTI_IMAGE_TO_3D = "multi-image-to-3d"
    PBR_TEXTURES = "pbr-textures"
    VARIANTS = "variants"


@dataclass
class ProviderStatus:
    id: str
    name: str
    kind: str
    enabled: bool
    available: bool
    capabilities: list[str]
    reason: str | None
    license: str
    licenseReviewRequired: bool  # noqa: N815 (contrato compartido con el frontend)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class GenerationRequest:
    prompt: str | None = None
    images: list[bytes] = field(default_factory=list)
    seed: int | None = None
    quality: str = "high"
    options: dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerationResult:
    glb: bytes
    engine: str
    license: str
    metadata: dict[str, Any] = field(default_factory=dict)


class ProviderUnavailableError(RuntimeError):
    """El proveedor no puede ejecutarse en este equipo o con esta configuración."""


class BaseProvider(abc.ABC):
    id: str = ""
    name: str = ""
    kind: ProviderKind = ProviderKind.LOCAL
    capabilities: tuple[Capability, ...] = ()
    license: str = ""
    license_review_required: bool = False

    def is_enabled(self) -> bool:
        """Los proveedores locales están activados por defecto; los externos no."""
        return self.kind == ProviderKind.LOCAL

    @abc.abstractmethod
    def check_availability(self) -> tuple[bool, str | None]:
        """Devuelve (disponible, motivo si no lo está). No debe lanzar excepciones."""

    @abc.abstractmethod
    def generate(self, request: GenerationRequest) -> GenerationResult:
        """Genera un modelo y lo devuelve como GLB."""

    def status(self) -> ProviderStatus:
        enabled = self.is_enabled()
        try:
            available, reason = self.check_availability() if enabled else (False, "Desactivado en la configuración.")
        except Exception as exc:  # noqa: BLE001 — el estado nunca debe romper la API
            available, reason = False, f"Error al comprobar el proveedor: {exc}"
        return ProviderStatus(
            id=self.id,
            name=self.name,
            kind=self.kind.value,
            enabled=enabled,
            available=enabled and available,
            capabilities=[c.value for c in self.capabilities],
            reason=None if (enabled and available) else reason,
            license=self.license,
            licenseReviewRequired=self.license_review_required,
        )
