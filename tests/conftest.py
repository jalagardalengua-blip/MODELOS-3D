import sys
from pathlib import Path

# Permite importar el paquete "services" desde la raíz del repositorio.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
