"""Diagnóstico de la conexión con Hugging Face.

Uso (desde la raíz del repositorio):
    python -m services.generation.external.huggingface.diagnose
    python -m services.generation.external.huggingface.diagnose --imagen ruta/a/foto.png
    python -m services.generation.external.huggingface.diagnose --texto "toro bravo negro"

Sin argumentos: comprueba el estado de los Spaces y muestra su API real.
Con --imagen o --texto: hace una generación completa y guarda el GLB en
storage/diagnostico.glb.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from ....api.security.secrets import get_secret, load_env_file, mask
from ....export.glb_validator import validate_glb
from ...base_provider import GenerationRequest
from .space_client import SpaceClient, SpaceError, gradio_client_available
from .text_to_image import DEFAULT_T2I_SPACE
from .trellis2_provider import Trellis2SpaceProvider, _space_runtime_stage

ROOT = Path(__file__).resolve().parents[4]


def show_space(space_id: str, token: str | None) -> bool:
    print(f"\n== {space_id}")
    print(f"   estado: {_space_runtime_stage(space_id, token) or 'no se pudo consultar'}")
    try:
        client = SpaceClient(space_id, token=token)
        client.connect()
    except SpaceError as exc:
        print(f"   ✗ no se pudo conectar: {exc}")
        return False
    for ep in client.endpoints():
        print(f"   {ep}({', '.join(client.parameter_names(ep))})")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnóstico de TRELLIS.2 en Hugging Face")
    parser.add_argument("--imagen", type=Path)
    parser.add_argument("--texto")
    parser.add_argument("--calidad", default="borrador", choices=["borrador", "alta", "maxima"])
    args = parser.parse_args()

    load_env_file()
    token = get_secret("HF_TOKEN")
    print("ALAGARDA 3D STUDIO · diagnóstico de Hugging Face")
    print(f"gradio_client instalado: {'sí' if gradio_client_available() else 'NO'}")
    print(f"HF_TOKEN: {mask(token) or 'no configurado (cupo de invitado, más limitado)'}")
    if not gradio_client_available():
        print("Instala las dependencias: python -m pip install -r services/requirements.txt")
        return 1

    provider = Trellis2SpaceProvider()
    ok = show_space(provider.space_id, token) & show_space(DEFAULT_T2I_SPACE, token)
    if not (args.imagen or args.texto):
        return 0 if ok else 1

    request = GenerationRequest(
        prompt=args.texto,
        images=[args.imagen.read_bytes()] if args.imagen else [],
        quality=args.calidad,
    )
    print(f"\nGenerando ({args.calidad})…")
    start = time.monotonic()
    try:
        result = provider.generate(request, lambda f, m: print(f"  [{f * 100:5.1f}%] {m}"))
    except Exception as exc:  # noqa: BLE001
        print(f"✗ Error: {exc}")
        return 1
    report = validate_glb(result.glb)
    out = ROOT / "storage" / "diagnostico.glb"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(result.glb)
    print(f"\n✓ GLB de {len(result.glb) / 1e6:.1f} MB en {time.monotonic() - start:.0f} s → {out}")
    print(f"  válido: {report.ok} · {report.counts}")
    for w in report.warnings:
        print(f"  aviso: {w}")
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
