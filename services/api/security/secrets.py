"""Gestión de secretos del motor local.

- Las claves se leen SOLO de variables de entorno o del archivo .env local
  (excluido de git). Nunca se guardan en el código ni en el navegador.
- La API nunca devuelve una clave; como mucho, si está configurada y sus
  últimos 4 caracteres.
"""

from __future__ import annotations

import os
from pathlib import Path

_loaded = False


def load_env_file(path: str | Path | None = None) -> None:
    """Carga un .env sencillo (CLAVE=valor) sin sobrescribir variables existentes."""
    global _loaded
    env_path = Path(path) if path else Path(__file__).resolve().parents[3] / ".env"
    if env_path.is_file():
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    _loaded = True


def get_secret(name: str) -> str | None:
    if not _loaded:
        load_env_file()
    value = os.environ.get(name, "").strip()
    return value or None


def mask(value: str | None) -> str | None:
    if not value:
        return None
    return f"••••{value[-4:]}" if len(value) > 8 else "••••"
