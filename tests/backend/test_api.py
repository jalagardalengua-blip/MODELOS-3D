from fastapi.testclient import TestClient

from services.api.main import create_app
from services.export.glb_exporter import make_test_cube
from services.generation.base_provider import (
    BaseProvider,
    GenerationRequest,
    GenerationResult,
    ProviderKind,
    ProviderUnavailableError,
)
from services.generation.provider_manager import ProviderManager


def client(manager: ProviderManager | None = None) -> TestClient:
    return TestClient(create_app(manager))


def test_health():
    r = client().get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_hardware_shape():
    data = client().get("/api/hardware").json()
    assert {"platform", "cpuCount", "ramGb", "gpus", "cuda"} <= data.keys()


def test_default_providers_are_listed_and_never_fake_availability(monkeypatch):
    monkeypatch.delenv("TRIPO_ENABLED", raising=False)
    data = client().get("/api/providers").json()["providers"]
    ids = {p["id"] for p in data}
    assert ids == {"trellis2-hf", "trellis", "hunyuan3d", "tripo"}
    # Los motores locales y de pago no se anuncian como disponibles sin estarlo.
    assert all(not p["available"] for p in data if p["id"] != "trellis2-hf")
    hf = next(p for p in data if p["id"] == "trellis2-hf")
    assert hf["enabled"] is True and hf["sendsDataExternally"] is True
    tripo = next(p for p in data if p["id"] == "tripo")
    assert tripo["enabled"] is False, "Tripo debe estar desactivado por defecto"


def test_validate_endpoint_accepts_valid_glb():
    r = client().post("/api/glb/validate", files={"file": ("cubo.glb", make_test_cube(), "model/gltf-binary")})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["counts"]["meshes"] == 1


def test_validate_endpoint_rejects_garbage():
    r = client().post("/api/glb/validate", files={"file": ("x.glb", b"not a glb at all, sorry", "model/gltf-binary")})
    assert r.status_code == 200
    assert r.json()["ok"] is False


class _FakeProvider(BaseProvider):
    id = "fake"
    name = "Fake"
    kind = ProviderKind.LOCAL
    license = "test"

    def __init__(self, available: bool):
        self._available = available

    def check_availability(self):
        return self._available, None if self._available else "no"

    def generate(self, request: GenerationRequest, progress=None) -> GenerationResult:
        return GenerationResult(glb=make_test_cube(), engine=self.id, license=self.license)


def test_manager_routes_to_available_provider():
    m = ProviderManager([_FakeProvider(True)])
    result = m.generate("fake", GenerationRequest(prompt="toro"))
    assert result.glb[:4] == b"glTF"


def test_manager_refuses_unavailable_provider():
    m = ProviderManager([_FakeProvider(False)])
    try:
        m.generate("fake", GenerationRequest(prompt="toro"))
    except ProviderUnavailableError:
        return
    raise AssertionError("Debió rechazar un proveedor no disponible")


def test_manager_rejects_duplicate_ids():
    m = ProviderManager([_FakeProvider(True)])
    try:
        m.register(_FakeProvider(True))
    except ValueError:
        return
    raise AssertionError("Debió rechazar ids duplicados")
