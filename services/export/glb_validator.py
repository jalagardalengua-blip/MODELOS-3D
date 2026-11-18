"""Validación estructural de archivos GLB (glTF 2.0) sin dependencias externas.

Comprueba la cabecera, los chunks JSON/BIN, la versión del asset, las
referencias entre nodos, mallas, materiales, texturas y esqueletos, y que los
bufferViews no se salgan de sus buffers.

Es el equivalente en Python de apps/web/src/lib/glbFormat.ts; ambos deben dar
el mismo resultado para el mismo archivo.
"""

from __future__ import annotations

import json
import struct
from dataclasses import asdict, dataclass, field
from typing import Any

MAGIC_GLTF = 0x46546C67  # "glTF"
CHUNK_JSON = 0x4E4F534A  # "JSON"
CHUNK_BIN = 0x004E4942  # "BIN\0"

SUPPORTED_EXTENSIONS = {
    "KHR_materials_pbrSpecularGlossiness",
    "KHR_materials_clearcoat",
    "KHR_materials_transmission",
    "KHR_materials_volume",
    "KHR_materials_ior",
    "KHR_materials_specular",
    "KHR_materials_sheen",
    "KHR_materials_emissive_strength",
    "KHR_materials_iridescence",
    "KHR_materials_anisotropy",
    "KHR_materials_dispersion",
    "KHR_materials_unlit",
    "KHR_texture_transform",
    "KHR_mesh_quantization",
    "KHR_lights_punctual",
    "KHR_draco_mesh_compression",
    "EXT_meshopt_compression",
    "EXT_texture_webp",
    "EXT_mesh_gpu_instancing",
}


class GlbFormatError(ValueError):
    """El archivo no tiene la estructura de un GLB."""


@dataclass
class ParsedGlb:
    version: int
    length: int
    json: dict[str, Any]
    bin: bytes | None


@dataclass
class GlbValidationReport:
    ok: bool = False
    version: int | None = None
    declaredLength: int | None = None  # noqa: N815 (mismo contrato que el frontend)
    actualLength: int = 0  # noqa: N815
    generator: str | None = None
    counts: dict[str, int] = field(
        default_factory=lambda: {
            "meshes": 0,
            "materials": 0,
            "textures": 0,
            "images": 0,
            "skins": 0,
            "animations": 0,
            "nodes": 0,
        }
    )
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def parse_glb(data: bytes) -> ParsedGlb:
    if len(data) < 20:
        raise GlbFormatError("Archivo demasiado pequeño para ser un GLB.")
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != MAGIC_GLTF:
        raise GlbFormatError('Cabecera inválida: no empieza por "glTF".')

    offset = 12
    gltf_json: dict[str, Any] | None = None
    bin_chunk: bytes | None = None
    index = 0
    limit = min(length, len(data))
    while offset + 8 <= limit:
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + chunk_length
        if end > len(data):
            raise GlbFormatError(f"Chunk {index} truncado.")
        if index == 0:
            if chunk_type != CHUNK_JSON:
                raise GlbFormatError("El primer chunk debe ser JSON.")
            try:
                gltf_json = json.loads(data[start:end].decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise GlbFormatError("El chunk JSON no contiene JSON válido.") from exc
        elif chunk_type == CHUNK_BIN and bin_chunk is None:
            bin_chunk = data[start:end]
        offset = end
        index += 1

    if gltf_json is None:
        raise GlbFormatError("No se encontró el chunk JSON.")
    return ParsedGlb(version=version, length=length, json=gltf_json, bin=bin_chunk)


def validate_glb(data: bytes) -> GlbValidationReport:
    report = GlbValidationReport(actualLength=len(data))
    try:
        parsed = parse_glb(data)
    except GlbFormatError as exc:
        report.errors.append(str(exc))
        return report

    j = parsed.json
    report.version = parsed.version
    report.declaredLength = parsed.length
    report.generator = (j.get("asset") or {}).get("generator")

    if parsed.version != 2:
        report.errors.append(f"Versión de contenedor {parsed.version}; se esperaba 2.")
    if parsed.length != len(data):
        report.errors.append(
            f"La longitud declarada ({parsed.length}) no coincide con el tamaño real ({len(data)})."
        )
    asset_version = (j.get("asset") or {}).get("version")
    if asset_version != "2.0":
        report.errors.append(f'asset.version es "{asset_version or "—"}"; se esperaba "2.0".')

    def arr(key: str) -> list[Any]:
        value = j.get(key)
        return value if isinstance(value, list) else []

    nodes, meshes, materials = arr("nodes"), arr("meshes"), arr("materials")
    textures, images, skins = arr("textures"), arr("images"), arr("skins")
    report.counts = {
        "meshes": len(meshes),
        "materials": len(materials),
        "textures": len(textures),
        "images": len(images),
        "skins": len(skins),
        "animations": len(arr("animations")),
        "nodes": len(nodes),
    }

    def in_range(i: Any, n: int) -> bool:
        return isinstance(i, int) and 0 <= i < n

    for i, node in enumerate(nodes):
        if "mesh" in node and not in_range(node["mesh"], len(meshes)):
            report.errors.append(f"El nodo {i} referencia una malla inexistente ({node['mesh']}).")
        if "skin" in node and not in_range(node["skin"], len(skins)):
            report.errors.append(f"El nodo {i} referencia un esqueleto inexistente ({node['skin']}).")
        for child in node.get("children", []):
            if not in_range(child, len(nodes)):
                report.errors.append(f"El nodo {i} tiene un hijo inexistente ({child}).")
    for i, mesh in enumerate(meshes):
        for k, prim in enumerate(mesh.get("primitives", [])):
            if "material" in prim and not in_range(prim["material"], len(materials)):
                report.errors.append(f"La primitiva {k} de la malla {i} referencia un material inexistente.")
    for i, tex in enumerate(textures):
        if "source" in tex and not in_range(tex["source"], len(images)):
            report.errors.append(f"La textura {i} referencia una imagen inexistente.")
    for i, skin in enumerate(skins):
        for joint in skin.get("joints", []):
            if not in_range(joint, len(nodes)):
                report.errors.append(f"El esqueleto {i} referencia una articulación inexistente.")
                break

    buffers = arr("buffers")
    if buffers and "uri" not in buffers[0]:
        if parsed.bin is None:
            report.errors.append("El buffer 0 debe estar en el chunk BIN, pero no existe.")
        elif buffers[0].get("byteLength", 0) > len(parsed.bin):
            report.errors.append("El buffer 0 es mayor que el chunk BIN.")
    for i, buf in enumerate(buffers):
        uri = buf.get("uri")
        if uri is not None and not str(uri).startswith("data:"):
            report.warnings.append(
                f"El buffer {i} apunta a un archivo externo ({uri}); el GLB no es autocontenido."
            )
    for i, bv in enumerate(arr("bufferViews")):
        b = bv.get("buffer", -1)
        if not in_range(b, len(buffers)):
            report.errors.append(f"El bufferView {i} referencia un buffer inexistente.")
        elif bv.get("byteOffset", 0) + bv.get("byteLength", 0) > buffers[b].get("byteLength", 0):
            report.errors.append(f"El bufferView {i} se sale de su buffer.")

    for ext in j.get("extensionsRequired", []):
        if ext not in SUPPORTED_EXTENSIONS:
            report.errors.append(f"Extensión obligatoria no soportada: {ext}.")
    for ext in j.get("extensionsUsed", []):
        if ext not in SUPPORTED_EXTENSIONS:
            report.warnings.append(f"Extensión desconocida para el visor: {ext}.")

    if not meshes:
        report.warnings.append("El archivo no contiene mallas.")
    elif not materials:
        report.warnings.append("Las mallas no tienen materiales; se verán con el material por defecto.")

    report.ok = not report.errors
    return report
