"""Esquemas de respuesta de la API (contrato con packages/shared-types)."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    name: str
    version: str


class ProviderStatusModel(BaseModel):
    id: str
    name: str
    kind: str
    enabled: bool
    available: bool
    capabilities: list[str]
    reason: str | None
    license: str
    licenseReviewRequired: bool  # noqa: N815
    sendsDataExternally: bool = False  # noqa: N815


class ProvidersResponse(BaseModel):
    providers: list[ProviderStatusModel]


class GpuModel(BaseModel):
    name: str
    vramGb: float | None  # noqa: N815
    vendor: str


class HardwareResponse(BaseModel):
    platform: str
    cpuCount: int | None  # noqa: N815
    ramGb: float | None  # noqa: N815
    gpus: list[GpuModel]
    cuda: bool


class ValidationCounts(BaseModel):
    meshes: int
    materials: int
    textures: int
    images: int
    skins: int
    animations: int
    nodes: int


class GlbValidationResponse(BaseModel):
    ok: bool
    version: int | None
    declaredLength: int | None  # noqa: N815
    actualLength: int  # noqa: N815
    generator: str | None
    counts: ValidationCounts
    errors: list[str]
    warnings: list[str]
