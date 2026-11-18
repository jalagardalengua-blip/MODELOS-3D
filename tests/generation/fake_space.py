"""Simulación de gradio_client.Client con la estructura de API de los Spaces
microsoft/TRELLIS.2 y black-forest-labs/FLUX.1-schnell. Permite probar el
adaptador completo sin red ni GPU."""

from __future__ import annotations

import tempfile
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from services.export.glb_exporter import make_test_cube

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d4944415478da63f8ffff3f0005fe02fea7d6a4b60000000049454e44ae426082"
)


def _params(*names: str) -> list[dict[str, Any]]:
    return [{"parameter_name": n, "label": n, "parameter_has_default": True} for n in names]


TRELLIS2_API = {
    "named_endpoints": {
        "/start_session": {"parameters": [], "returns": []},
        "/preprocess_image": {"parameters": _params("image"), "returns": []},
        "/get_seed": {"parameters": _params("randomize_seed", "seed"), "returns": []},
        "/image_to_3d": {
            "parameters": _params(
                "image", "seed", "resolution", "ss_guidance_strength", "ss_guidance_rescale", "ss_sampling_steps", "ss_rescale_t"
            ),
            "returns": [],
        },
        "/extract_glb": {"parameters": _params("decimation_target", "texture_size"), "returns": []},
    }
}

FLUX_API = {
    "named_endpoints": {
        "/infer": {
            "parameters": _params("prompt", "seed", "randomize_seed", "width", "height", "num_inference_steps"),
            "returns": [],
        }
    }
}


class FakeJob:
    def __init__(self, result: Any = None, error: Exception | None = None) -> None:
        self._result, self._error, self._polls = result, error, 0

    def done(self) -> bool:
        self._polls += 1
        return self._polls > 1

    def status(self) -> Any:
        return SimpleNamespace(code=SimpleNamespace(name="IN_QUEUE"), rank=0, queue_size=2, eta=3.0, progress_data=None)

    def result(self) -> Any:
        if self._error:
            raise self._error
        return self._result

    def cancel(self) -> bool:
        return True


class FakeClient:
    instances: list[FakeClient] = []
    fail_on: dict[str, Exception] = {}

    def __init__(self, space_id: str, token: str | None = None, verbose: bool = True, download_files: str | None = None) -> None:
        self.space_id = space_id
        self.token = token
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.dir = Path(download_files or tempfile.mkdtemp())
        self.state: dict[str, Any] = {}
        FakeClient.instances.append(self)

    def view_api(self, print_info: bool = True, return_format: str | None = None) -> dict[str, Any]:
        return FLUX_API if "FLUX" in self.space_id else TRELLIS2_API

    def submit(self, *args: Any, api_name: str | None = None, **kwargs: Any) -> FakeJob:
        self.calls.append((api_name or "", kwargs))
        if api_name in FakeClient.fail_on:
            return FakeJob(error=FakeClient.fail_on[api_name])
        if api_name == "/infer":
            p = self.dir / "flux.webp"
            p.write_bytes(PNG_1PX)
            return FakeJob((str(p), kwargs.get("seed")))
        if api_name == "/preprocess_image":
            p = self.dir / "pre.png"
            p.write_bytes(PNG_1PX)
            return FakeJob(str(p))
        if api_name == "/image_to_3d":
            self.state["generated"] = True
            return FakeJob(({"latents": 1}, [str(self.dir / "preview.png")]))
        if api_name == "/extract_glb":
            assert self.state.get("generated"), "extract_glb antes de image_to_3d"
            p = self.dir / "sample.glb"
            p.write_bytes(make_test_cube())
            return FakeJob((str(p), str(p)))
        return FakeJob(None)


def fake_file(path: str) -> dict[str, Any]:
    return {"path": path, "meta": {"_type": "gradio.FileData"}}
