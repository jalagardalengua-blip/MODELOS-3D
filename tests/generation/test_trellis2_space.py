import time

import pytest
from fastapi.testclient import TestClient

from services.api.jobs import JobManager
from services.api.main import create_app
from services.export.glb_validator import validate_glb
from services.generation.base_provider import GenerationRequest
from services.generation.external.huggingface.space_client import SpaceQuotaError
from services.generation.external.huggingface.text_to_image import TextToImage, build_reference_prompt
from services.generation.external.huggingface.trellis2_provider import Trellis2SpaceProvider
from services.generation.provider_manager import ProviderManager
from tests.generation.fake_space import PNG_1PX, FakeClient, fake_file


@pytest.fixture(autouse=True)
def _reset():
    FakeClient.instances.clear()
    FakeClient.fail_on = {}
    Trellis2SpaceProvider._status_cache = None
    yield


def provider() -> Trellis2SpaceProvider:
    t2i = TextToImage(client_factory=FakeClient, file_wrapper=fake_file)
    return Trellis2SpaceProvider(client_factory=FakeClient, file_wrapper=fake_file, text_to_image=t2i)


def test_image_to_3d_full_flow():
    progress = []
    result = provider().generate(
        GenerationRequest(images=[PNG_1PX], seed=7, quality="alta"), lambda f, m: progress.append((f, m))
    )
    assert validate_glb(result.glb).ok
    assert result.engine == "trellis2-hf"
    assert result.reference_image == PNG_1PX

    client = FakeClient.instances[-1]
    names = [c[0] for c in client.calls]
    assert names == ["/start_session", "/preprocess_image", "/image_to_3d", "/extract_glb"]
    gen_kwargs = dict(client.calls)["/image_to_3d"]
    # Solo se envían parámetros que el endpoint acepta (randomize_seed no existe en él).
    assert gen_kwargs["seed"] == 7 and gen_kwargs["resolution"] == "1024"
    assert "randomize_seed" not in gen_kwargs
    assert dict(client.calls)["/extract_glb"] == {"decimation_target": 400_000, "texture_size": 2048}
    # El progreso avanza y termina en 1.
    fractions = [f for f, _ in progress]
    assert fractions == sorted(fractions) and fractions[-1] == 1.0
    assert any("en cola" in m for _, m in progress)


def test_text_to_3d_generates_reference_image_first():
    result = provider().generate(GenerationRequest(prompt="Toro bravo negro", seed=3, quality="borrador"))
    assert validate_glb(result.glb).ok
    assert result.metadata["input"] == "text"
    flux = next(c for c in FakeClient.instances if "FLUX" in c.space_id)
    sent_prompt = flux.calls[0][1]["prompt"]
    assert sent_prompt.startswith("Toro bravo negro") and "plain light grey" in sent_prompt
    trellis = next(c for c in FakeClient.instances if "TRELLIS" in c.space_id)
    assert dict(trellis.calls)["/image_to_3d"]["resolution"] == "512"


def test_quota_errors_are_explained():
    FakeClient.fail_on = {"/image_to_3d": RuntimeError("You have exceeded your GPU quota (60s requested vs. 0s left).")}
    with pytest.raises(SpaceQuotaError) as exc:
        provider().generate(GenerationRequest(images=[PNG_1PX]))
    assert "HF_TOKEN" in str(exc.value)


def test_reference_prompt_keeps_user_text():
    assert build_reference_prompt("  caballo de rejoneo. ").startswith("caballo de rejoneo. single subject")


def _wait(client: TestClient, job_id: str, timeout: float = 10) -> dict:
    end = time.time() + timeout
    while time.time() < end:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("succeeded", "failed", "cancelled"):
            return job
        time.sleep(0.05)
    raise AssertionError("El trabajo no terminó a tiempo")


def test_generate_endpoint_runs_job_and_serves_glb(tmp_path, monkeypatch):
    p = provider()
    monkeypatch.setattr(p, "check_availability", lambda: (True, None))
    manager = ProviderManager([p])
    app = create_app(manager, JobManager(manager, root=tmp_path))
    client = TestClient(app)

    r = client.post(
        "/api/generate",
        data={"provider": "trellis2-hf", "quality": "alta", "name": "Toro prueba", "category": "toro", "seed": "5"},
        files={"image": ("toro.png", PNG_1PX, "image/png")},
    )
    assert r.status_code == 202, r.text
    job = _wait(client, r.json()["id"])
    assert job["status"] == "succeeded", job
    assert job["engine"] == "trellis2-hf" and job["hasReference"] is True and job["category"] == "toro"

    glb = client.get(f"/api/jobs/{job['id']}/result.glb")
    assert glb.status_code == 200 and validate_glb(glb.content).ok
    assert client.get(f"/api/jobs/{job['id']}/reference").status_code == 200
    assert (tmp_path / "generations" / job["id"] / "job.json").exists()

    # El historial sobrevive a un reinicio del motor.
    again = JobManager(manager, root=tmp_path)
    assert again.get(job["id"]).status == "succeeded"


def test_generate_rejects_unavailable_provider(tmp_path):
    manager = ProviderManager([provider()])
    manager.get("trellis2-hf").check_availability = lambda: (False, "sin red")  # type: ignore[method-assign]
    client = TestClient(create_app(manager, JobManager(manager, root=tmp_path)))
    r = client.post("/api/generate", data={"provider": "trellis2-hf", "prompt": "toro"})
    assert r.status_code == 409 and "sin red" in r.json()["detail"]


def test_generate_rejects_non_images(tmp_path, monkeypatch):
    p = provider()
    monkeypatch.setattr(p, "check_availability", lambda: (True, None))
    manager = ProviderManager([p])
    client = TestClient(create_app(manager, JobManager(manager, root=tmp_path)))
    r = client.post("/api/generate", data={"provider": "trellis2-hf"}, files={"image": ("x.png", b"no soy una imagen", "image/png")})
    assert r.status_code == 415


def test_failed_generation_is_recorded(tmp_path, monkeypatch):
    FakeClient.fail_on = {"/extract_glb": RuntimeError("boom")}
    p = provider()
    monkeypatch.setattr(p, "check_availability", lambda: (True, None))
    manager = ProviderManager([p])
    client = TestClient(create_app(manager, JobManager(manager, root=tmp_path)))
    r = client.post("/api/generate", data={"provider": "trellis2-hf", "prompt": "toro"})
    job = _wait(client, r.json()["id"])
    assert job["status"] == "failed" and "boom" in job["error"]
