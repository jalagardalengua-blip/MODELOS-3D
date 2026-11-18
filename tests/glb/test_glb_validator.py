import json
import struct

from services.export.glb_exporter import make_test_cube, pack_glb
from services.export.glb_validator import validate_glb


def test_cube_is_valid():
    report = validate_glb(make_test_cube())
    assert report.ok, report.errors
    assert report.version == 2
    assert report.counts["meshes"] == 1
    assert report.counts["materials"] == 1
    assert report.declaredLength == report.actualLength


def test_glb_length_is_4_byte_aligned():
    assert len(make_test_cube()) % 4 == 0


def test_missing_material_is_a_warning_not_an_error():
    report = validate_glb(make_test_cube(with_material=False))
    assert report.ok
    assert any("materiales" in w for w in report.warnings)


def test_bad_magic():
    report = validate_glb(b"XXXX" + b"\x00" * 30)
    assert not report.ok


def test_truncated_file():
    data = make_test_cube()
    report = validate_glb(data[:-40])
    assert not report.ok


def test_dangling_mesh_reference():
    gltf = {"asset": {"version": "2.0"}, "nodes": [{"mesh": 3}], "meshes": []}
    report = validate_glb(pack_glb(gltf))
    assert not report.ok
    assert any("malla inexistente" in e for e in report.errors)


def test_wrong_asset_version():
    report = validate_glb(pack_glb({"asset": {"version": "1.0"}}))
    assert not report.ok


def test_unsupported_required_extension():
    gltf = {"asset": {"version": "2.0"}, "extensionsRequired": ["EXT_inventada"], "extensionsUsed": ["EXT_inventada"]}
    report = validate_glb(pack_glb(gltf))
    assert not report.ok


def test_bufferview_out_of_bounds():
    gltf = {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": 4}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 64}],
    }
    report = validate_glb(pack_glb(gltf, b"\x00" * 4))
    assert any("se sale" in e for e in report.errors)


def test_first_chunk_must_be_json():
    body = b"\x00" * 8
    chunk = struct.pack("<II", len(body), 0x004E4942) + body
    data = struct.pack("<III", 0x46546C67, 2, 12 + len(chunk)) + chunk
    report = validate_glb(data)
    assert not report.ok
    assert json.dumps(report.to_dict())  # serializable
