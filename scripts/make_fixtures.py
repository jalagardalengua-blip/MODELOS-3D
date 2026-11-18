"""Genera los GLB de prueba en tests/fixtures/ (python scripts/make_fixtures.py)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.export.glb_exporter import make_test_cube  # noqa: E402

out = ROOT / "tests" / "fixtures"
out.mkdir(parents=True, exist_ok=True)
(out / "cube.glb").write_bytes(make_test_cube())
print(f"Escrito {out / 'cube.glb'}")
