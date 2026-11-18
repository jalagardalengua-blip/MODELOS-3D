"""Empaquetado de glTF 2.0 en un contenedor GLB binario.

En la Fase 1 la exportación del visor ocurre en el navegador (three.js
GLTFExporter). Este módulo es la base del exportador del motor local: lo usarán
la cadena de procesamiento con Blender (Fase 3) y las pruebas, y garantiza el
alineamiento a 4 bytes que exige la especificación.
"""

from __future__ import annotations

import json
import struct
from typing import Any

from .glb_validator import CHUNK_BIN, CHUNK_JSON, MAGIC_GLTF


def _pad(data: bytes, fill: bytes) -> bytes:
    remainder = len(data) % 4
    return data if remainder == 0 else data + fill * (4 - remainder)


def pack_glb(gltf: dict[str, Any], binary: bytes | None = None) -> bytes:
    """Devuelve un GLB válido a partir del JSON glTF y del buffer binario."""
    gltf = dict(gltf)
    gltf.setdefault("asset", {"version": "2.0", "generator": "ALAGARDA 3D STUDIO"})
    if binary is not None:
        buffers = list(gltf.get("buffers", [{}]))
        buffers[0] = {**buffers[0], "byteLength": len(binary)}
        buffers[0].pop("uri", None)
        gltf["buffers"] = buffers

    json_chunk = _pad(json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8"), b" ")
    chunks = struct.pack("<II", len(json_chunk), CHUNK_JSON) + json_chunk
    if binary is not None:
        bin_chunk = _pad(binary, b"\x00")
        chunks += struct.pack("<II", len(bin_chunk), CHUNK_BIN) + bin_chunk

    header = struct.pack("<III", MAGIC_GLTF, 2, 12 + len(chunks))
    return header + chunks


def make_test_cube(with_material: bool = True) -> bytes:
    """Cubo mínimo (24 vértices, 12 triángulos) usado por las pruebas."""
    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []
    faces = [
        ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
        ((-1, 0, 0), (0, 1, 0), (0, 0, -1)),
        ((0, 1, 0), (0, 0, 1), (1, 0, 0)),
        ((0, -1, 0), (0, 0, -1), (1, 0, 0)),
        ((0, 0, 1), (1, 0, 0), (0, 1, 0)),
        ((0, 0, -1), (-1, 0, 0), (0, 1, 0)),
    ]
    for n, u, v in faces:
        base = len(positions) // 3
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = [0.5 * (n[k] + su * u[k] + sv * v[k]) for k in range(3)]
            positions += p
            normals += list(n)
        indices += [base, base + 1, base + 2, base, base + 2, base + 3]

    pos_bytes = struct.pack(f"<{len(positions)}f", *positions)
    nor_bytes = struct.pack(f"<{len(normals)}f", *normals)
    idx_bytes = struct.pack(f"<{len(indices)}H", *indices)
    binary = pos_bytes + nor_bytes + idx_bytes

    gltf: dict[str, Any] = {
        "asset": {"version": "2.0", "generator": "ALAGARDA 3D STUDIO test cube"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Cubo"}],
        "meshes": [
            {
                "name": "Cubo",
                "primitives": [
                    {"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, **({"material": 0} if with_material else {})}
                ],
            }
        ],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bytes), "byteLength": len(nor_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bytes) + len(nor_bytes), "byteLength": len(idx_bytes), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 24, "type": "VEC3", "min": [-0.5] * 3, "max": [0.5] * 3},
            {"bufferView": 1, "componentType": 5126, "count": 24, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5123, "count": 36, "type": "SCALAR"},
        ],
    }
    if with_material:
        gltf["materials"] = [
            {
                "name": "Albero",
                "pbrMetallicRoughness": {"baseColorFactor": [0.78, 0.55, 0.3, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.8},
            }
        ]
    return pack_glb(gltf, binary)
