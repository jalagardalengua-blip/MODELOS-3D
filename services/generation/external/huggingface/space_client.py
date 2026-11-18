"""Cliente robusto para Spaces de Hugging Face (Gradio).

Los Spaces cambian sus parámetros con el tiempo. Para no romperse con cada
actualización, este cliente:

1. Lee la API real del Space al conectarse (`view_api`).
2. Envía solo los parámetros que el endpoint acepta, por nombre; el resto
   toma el valor por defecto del propio Space.
3. Informa del progreso (cola, posición, ETA, porcentaje) mientras espera.
4. Normaliza las salidas de archivo (ruta, dict o tupla) a una ruta local.
"""

from __future__ import annotations

import inspect
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

ProgressFn = Callable[[float, str], None]


class SpaceError(RuntimeError):
    """Error comunicando con un Space."""


class SpaceQuotaError(SpaceError):
    """Se ha agotado el cupo gratuito de GPU (ZeroGPU) o el Space está saturado."""


_QUOTA_HINTS = ("quota", "exceeded", "zerogpu", "gpu task aborted", "too many requests", "429", "queue is full")


def _classify(exc: Exception) -> SpaceError:
    text = str(exc)
    low = text.lower()
    if any(h in low for h in _QUOTA_HINTS):
        return SpaceQuotaError(
            "Hugging Face ha rechazado la petición por cupo de GPU o saturación. "
            "Espera un rato o configura HF_TOKEN con tu cuenta gratuita para tener más cupo. "
            f"Detalle: {text}"
        )
    return SpaceError(text)


def _load_gradio_client():
    try:
        from gradio_client import Client, handle_file  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - depende del entorno
        raise SpaceError(
            "Falta el paquete gradio_client. Instálalo con: python -m pip install -r services/requirements.txt"
        ) from exc
    return Client, handle_file


def gradio_client_available() -> bool:
    try:
        _load_gradio_client()
    except SpaceError:
        return False
    return True


class SpaceClient:
    def __init__(
        self,
        space_id: str,
        token: str | None = None,
        download_dir: str | Path | None = None,
        client_factory: Callable[..., Any] | None = None,
        file_wrapper: Callable[[str], Any] | None = None,
    ) -> None:
        self.space_id = space_id
        self._token = token
        self._download_dir = str(download_dir) if download_dir else None
        self._client_factory = client_factory
        self._file_wrapper = file_wrapper
        self._client: Any = None
        self._api: dict[str, Any] | None = None

    # ------------------------------------------------------------------ conexión
    def connect(self) -> None:
        if self._client is not None:
            return
        factory, wrapper = self._client_factory, self._file_wrapper
        if factory is None or wrapper is None:
            client_cls, handle_file = _load_gradio_client()
            factory = factory or client_cls
            wrapper = wrapper or handle_file
        self._file_wrapper = wrapper

        kwargs: dict[str, Any] = {"verbose": False}
        try:
            params = inspect.signature(factory).parameters
        except (TypeError, ValueError):
            params = {}
        if self._token:
            # gradio_client 1.x usa hf_token; 2.x usa token.
            kwargs["token" if "token" in params or not params else "hf_token"] = self._token
        if self._download_dir and "download_files" in params:
            kwargs["download_files"] = self._download_dir
        try:
            self._client = factory(self.space_id, **kwargs)
            self._api = self._client.view_api(print_info=False, return_format="dict") or {}
        except Exception as exc:  # noqa: BLE001
            self._client = None
            raise _classify(exc) from exc

    @property
    def api(self) -> dict[str, Any]:
        self.connect()
        return self._api or {}

    def endpoints(self) -> list[str]:
        return list((self.api.get("named_endpoints") or {}).keys())

    def has_endpoint(self, api_name: str) -> bool:
        return api_name in (self.api.get("named_endpoints") or {})

    def parameter_names(self, api_name: str) -> list[str]:
        info = (self.api.get("named_endpoints") or {}).get(api_name)
        if info is None:
            raise SpaceError(f"El Space {self.space_id} no expone el endpoint {api_name}. Endpoints: {self.endpoints()}")
        return [p.get("parameter_name") or p.get("label") for p in info.get("parameters", [])]

    def file(self, path: str | Path) -> Any:
        self.connect()
        assert self._file_wrapper is not None
        return self._file_wrapper(str(path))

    # ------------------------------------------------------------------ llamadas
    def call(
        self,
        api_name: str,
        values: dict[str, Any],
        progress: ProgressFn | None = None,
        progress_range: tuple[float, float] = (0.0, 1.0),
        label: str = "",
        timeout: float = 900.0,
    ) -> Any:
        """Llama a un endpoint enviando solo los parámetros que acepta."""
        accepted = set(self.parameter_names(api_name))
        kwargs = {k: v for k, v in values.items() if k in accepted and v is not None}
        lo, hi = progress_range

        try:
            job = self._client.submit(api_name=api_name, **kwargs)
        except Exception as exc:  # noqa: BLE001
            raise _classify(exc) from exc

        start = time.monotonic()
        last_msg = ""
        while not job.done():
            if time.monotonic() - start > timeout:
                try:
                    job.cancel()
                finally:
                    raise SpaceError(f"{label or api_name}: tiempo de espera agotado ({timeout:.0f} s).")
            if progress:
                frac, msg = _describe_status(job, label or api_name)
                if msg != last_msg or frac is not None:
                    progress(lo + (hi - lo) * (frac or 0.0), msg)
                    last_msg = msg
            time.sleep(0.5)

        try:
            result = job.result()
        except Exception as exc:  # noqa: BLE001
            raise _classify(exc) from exc
        if progress:
            progress(hi, f"{label or api_name}: completado")
        return result


def _describe_status(job: Any, label: str) -> tuple[float | None, str]:
    try:
        st = job.status()
    except Exception:  # noqa: BLE001
        return None, f"{label}: en curso…"
    code = getattr(getattr(st, "code", None), "name", str(getattr(st, "code", "")))
    if code in ("JOINING_QUEUE", "STARTING", "SENDING_DATA"):
        return 0.0, f"{label}: conectando con Hugging Face…"
    if code == "IN_QUEUE":
        rank, size, eta = getattr(st, "rank", None), getattr(st, "queue_size", None), getattr(st, "eta", None)
        pos = f" (posición {rank + 1} de {size})" if isinstance(rank, int) and isinstance(size, int) else ""
        eta_txt = f", unos {eta:.0f} s" if isinstance(eta, (int, float)) and eta > 0 else ""
        return 0.0, f"{label}: en cola{pos}{eta_txt}"
    if code == "QUEUE_FULL":
        return 0.0, f"{label}: la cola de Hugging Face está llena, reintentando…"
    progress_data = getattr(st, "progress_data", None) or []
    for p in progress_data:
        idx, length = getattr(p, "index", None), getattr(p, "length", None)
        desc = getattr(p, "desc", None) or getattr(p, "unit", None) or ""
        if isinstance(idx, (int, float)) and isinstance(length, (int, float)) and length:
            return min(1.0, idx / length), f"{label}: {desc} {int(idx)}/{int(length)}".strip()
        prog = getattr(p, "progress", None)
        if isinstance(prog, (int, float)):
            return min(1.0, float(prog)), f"{label}: {desc}".strip()
    return None, f"{label}: procesando en GPU…"


def extract_file_path(output: Any) -> str | None:
    """Devuelve la primera ruta de archivo existente dentro de una salida de Gradio."""
    if output is None:
        return None
    if isinstance(output, (str, Path)):
        p = str(output)
        return p if Path(p).exists() else None
    if isinstance(output, dict):
        for key in ("path", "value", "name", "url"):
            found = extract_file_path(output.get(key))
            if found:
                return found
        return None
    if isinstance(output, (list, tuple)):
        for item in output:
            found = extract_file_path(item)
            if found:
                return found
    return None


def find_glb(output: Any) -> str | None:
    """Busca específicamente un .glb en la salida (algunos endpoints devuelven vídeo + GLB)."""
    candidates: list[str] = []

    def walk(o: Any) -> None:
        if isinstance(o, (str, Path)):
            if Path(str(o)).exists():
                candidates.append(str(o))
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, (list, tuple)):
            for v in o:
                walk(v)

    walk(output)
    for c in candidates:
        if c.lower().endswith(".glb"):
            return c
    for c in candidates:
        with open(c, "rb") as fh:
            if fh.read(4) == b"glTF":
                return c
    return None
