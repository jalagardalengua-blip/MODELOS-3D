"""Registro de proveedores de generación.

Añadir un motor nuevo = crear su adaptador (subclase de BaseProvider) y
registrarlo en DEFAULT_PROVIDERS.
"""

from __future__ import annotations

from .base_provider import BaseProvider, GenerationRequest, GenerationResult, ProviderStatus, ProviderUnavailableError
from .external.tripo.provider import TripoProvider
from .local.hunyuan.provider import HunyuanProvider
from .local.trellis.provider import TrellisProvider


class ProviderManager:
    def __init__(self, providers: list[BaseProvider] | None = None) -> None:
        self._providers: dict[str, BaseProvider] = {}
        for p in providers if providers is not None else [TrellisProvider(), HunyuanProvider(), TripoProvider()]:
            self.register(p)

    def register(self, provider: BaseProvider) -> None:
        if not provider.id:
            raise ValueError("Un proveedor debe tener id.")
        if provider.id in self._providers:
            raise ValueError(f"Proveedor duplicado: {provider.id}")
        self._providers[provider.id] = provider

    def get(self, provider_id: str) -> BaseProvider:
        try:
            return self._providers[provider_id]
        except KeyError as exc:
            raise KeyError(f"Proveedor desconocido: {provider_id}") from exc

    def statuses(self) -> list[ProviderStatus]:
        return [p.status() for p in self._providers.values()]

    def generate(self, provider_id: str, request: GenerationRequest) -> GenerationResult:
        provider = self.get(provider_id)
        status = provider.status()
        if not status.available:
            raise ProviderUnavailableError(status.reason or "Proveedor no disponible.")
        return provider.generate(request)
