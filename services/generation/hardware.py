"""Detección de hardware para decidir qué motores pueden ejecutarse en local."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from typing import Any


@dataclass
class GpuInfo:
    name: str
    vramGb: float | None  # noqa: N815
    vendor: str


@dataclass
class HardwareInfo:
    platform: str
    cpuCount: int | None  # noqa: N815
    ramGb: float | None  # noqa: N815
    gpus: list[GpuInfo] = field(default_factory=list)
    cuda: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def max_nvidia_vram_gb(self) -> float:
        return max((g.vramGb or 0.0 for g in self.gpus if g.vendor == "NVIDIA"), default=0.0)


def _ram_gb() -> float | None:
    try:
        if hasattr(os, "sysconf") and "SC_PHYS_PAGES" in os.sysconf_names:
            return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024**3
    except (ValueError, OSError):
        pass
    if platform.system() == "Windows":
        try:
            import ctypes

            class MemoryStatus(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MemoryStatus()
            stat.dwLength = ctypes.sizeof(MemoryStatus)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))  # type: ignore[attr-defined]
            return stat.ullTotalPhys / 1024**3
        except Exception:  # noqa: BLE001
            return None
    return None


def _nvidia_gpus() -> list[GpuInfo]:
    exe = shutil.which("nvidia-smi")
    if not exe:
        return []
    try:
        out = subprocess.run(
            [exe, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return []
    gpus = []
    for line in out.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if not parts or not parts[0]:
            continue
        vram = float(parts[1]) / 1024 if len(parts) > 1 and parts[1].replace(".", "").isdigit() else None
        gpus.append(GpuInfo(name=parts[0], vramGb=vram, vendor="NVIDIA"))
    return gpus


def _windows_other_gpus() -> list[GpuInfo]:
    """AMD/Intel en Windows (sin VRAM fiable)."""
    if platform.system() != "Windows":
        return []
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_VideoController).Name"],
            capture_output=True,
            text=True,
            timeout=8,
            check=True,
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return []
    result = []
    for name in (n.strip() for n in out.splitlines()):
        if not name or "NVIDIA" in name.upper():
            continue
        vendor = "AMD" if ("AMD" in name.upper() or "RADEON" in name.upper()) else "Intel" if "INTEL" in name.upper() else "Otro"
        result.append(GpuInfo(name=name, vramGb=None, vendor=vendor))
    return result


@lru_cache(maxsize=1)
def detect_hardware() -> HardwareInfo:
    nvidia = _nvidia_gpus()
    return HardwareInfo(
        platform=f"{platform.system()} {platform.release()} ({platform.machine()})",
        cpuCount=os.cpu_count(),
        ramGb=_ram_gb(),
        gpus=nvidia + _windows_other_gpus(),
        cuda=bool(nvidia),
    )
