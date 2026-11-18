/**
 * Lectura y validación del contenedor binario GLB (glTF 2.0) sin depender de three.js.
 * Especificación: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
 *
 * Esta validación es estructural (cabecera, chunks, JSON, referencias básicas).
 * La validación completa con el validador oficial de Khronos llegará en la Fase 3.
 */
import type { GlbValidationReport } from '@alagarda/shared-types';

const MAGIC_GLTF = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

export interface ParsedGlb {
  version: number;
  length: number;
  json: GltfJson;
  bin: Uint8Array | null;
}

/** Subconjunto del JSON glTF que inspeccionamos. */
export interface GltfJson {
  asset?: { version?: string; generator?: string };
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: { mesh?: number; skin?: number; children?: number[] }[];
  meshes?: { primitives?: { material?: number }[] }[];
  materials?: unknown[];
  textures?: { source?: number }[];
  images?: unknown[];
  skins?: { joints?: number[] }[];
  animations?: unknown[];
  accessors?: unknown[];
  buffers?: { byteLength?: number; uri?: string }[];
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number }[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}

export class GlbFormatError extends Error {}

export function parseGlb(buffer: ArrayBuffer): ParsedGlb {
  if (buffer.byteLength < 20) throw new GlbFormatError('Archivo demasiado pequeño para ser un GLB.');
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== MAGIC_GLTF) throw new GlbFormatError('Cabecera inválida: no empieza por "glTF".');
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);

  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;
  let chunkIndex = 0;

  while (offset + 8 <= Math.min(length, buffer.byteLength)) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > buffer.byteLength) throw new GlbFormatError(`Chunk ${chunkIndex} truncado.`);

    if (chunkIndex === 0) {
      if (chunkType !== CHUNK_JSON) throw new GlbFormatError('El primer chunk debe ser JSON.');
      const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer, start, chunkLength));
      try {
        json = JSON.parse(text) as GltfJson;
      } catch {
        throw new GlbFormatError('El chunk JSON no contiene JSON válido.');
      }
    } else if (chunkType === CHUNK_BIN && bin === null) {
      bin = new Uint8Array(buffer, start, chunkLength);
    }
    offset = end;
    chunkIndex++;
  }

  if (!json) throw new GlbFormatError('No se encontró el chunk JSON.');
  return { version, length, json, bin };
}

/** Extensiones que el visor sabe decodificar. */
export const SUPPORTED_EXTENSIONS = new Set([
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_materials_clearcoat',
  'KHR_materials_transmission',
  'KHR_materials_volume',
  'KHR_materials_ior',
  'KHR_materials_specular',
  'KHR_materials_sheen',
  'KHR_materials_emissive_strength',
  'KHR_materials_iridescence',
  'KHR_materials_anisotropy',
  'KHR_materials_dispersion',
  'KHR_materials_unlit',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
  'KHR_lights_punctual',
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'EXT_texture_webp',
  'EXT_mesh_gpu_instancing',
]);

export function validateGlb(buffer: ArrayBuffer): GlbValidationReport {
  const report: GlbValidationReport = {
    ok: false,
    version: null,
    declaredLength: null,
    actualLength: buffer.byteLength,
    generator: null,
    counts: { meshes: 0, materials: 0, textures: 0, images: 0, skins: 0, animations: 0, nodes: 0 },
    errors: [],
    warnings: [],
  };

  let parsed: ParsedGlb;
  try {
    parsed = parseGlb(buffer);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
    return report;
  }

  const { json } = parsed;
  report.version = parsed.version;
  report.declaredLength = parsed.length;
  report.generator = json.asset?.generator ?? null;

  if (parsed.version !== 2) report.errors.push(`Versión de contenedor ${parsed.version}; se esperaba 2.`);
  if (parsed.length !== buffer.byteLength)
    report.errors.push(`La longitud declarada (${parsed.length}) no coincide con el tamaño real (${buffer.byteLength}).`);
  if (json.asset?.version !== '2.0') report.errors.push(`asset.version es "${json.asset?.version ?? '—'}"; se esperaba "2.0".`);

  report.counts = {
    meshes: json.meshes?.length ?? 0,
    materials: json.materials?.length ?? 0,
    textures: json.textures?.length ?? 0,
    images: json.images?.length ?? 0,
    skins: json.skins?.length ?? 0,
    animations: json.animations?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
  };

  // Referencias básicas
  const nodeCount = report.counts.nodes;
  json.nodes?.forEach((n, i) => {
    if (n.mesh !== undefined && (n.mesh < 0 || n.mesh >= report.counts.meshes))
      report.errors.push(`El nodo ${i} referencia una malla inexistente (${n.mesh}).`);
    if (n.skin !== undefined && (n.skin < 0 || n.skin >= report.counts.skins))
      report.errors.push(`El nodo ${i} referencia un esqueleto inexistente (${n.skin}).`);
    n.children?.forEach((c) => {
      if (c < 0 || c >= nodeCount) report.errors.push(`El nodo ${i} tiene un hijo inexistente (${c}).`);
    });
  });
  json.meshes?.forEach((m, i) =>
    m.primitives?.forEach((p, j) => {
      if (p.material !== undefined && (p.material < 0 || p.material >= report.counts.materials))
        report.errors.push(`La primitiva ${j} de la malla ${i} referencia un material inexistente.`);
    }),
  );
  json.textures?.forEach((t, i) => {
    if (t.source !== undefined && (t.source < 0 || t.source >= report.counts.images))
      report.errors.push(`La textura ${i} referencia una imagen inexistente.`);
  });
  json.skins?.forEach((s, i) => {
    s.joints?.forEach((j) => {
      if (j < 0 || j >= nodeCount) report.errors.push(`El esqueleto ${i} referencia una articulación inexistente.`);
    });
  });

  // Buffers
  const firstBuffer = json.buffers?.[0];
  if (firstBuffer && firstBuffer.uri === undefined) {
    if (!parsed.bin) report.errors.push('El buffer 0 debe estar en el chunk BIN, pero no existe.');
    else if ((firstBuffer.byteLength ?? 0) > parsed.bin.byteLength)
      report.errors.push('El buffer 0 es mayor que el chunk BIN.');
  }
  json.buffers?.forEach((b, i) => {
    if (b.uri !== undefined && !b.uri.startsWith('data:'))
      report.warnings.push(`El buffer ${i} apunta a un archivo externo (${b.uri}); el GLB no es autocontenido.`);
  });
  json.bufferViews?.forEach((bv, i) => {
    const buf = json.buffers?.[bv.buffer ?? -1];
    if (!buf) report.errors.push(`El bufferView ${i} referencia un buffer inexistente.`);
    else if ((bv.byteOffset ?? 0) + (bv.byteLength ?? 0) > (buf.byteLength ?? 0))
      report.errors.push(`El bufferView ${i} se sale de su buffer.`);
  });

  // Extensiones
  for (const ext of json.extensionsRequired ?? []) {
    if (!SUPPORTED_EXTENSIONS.has(ext)) report.errors.push(`Extensión obligatoria no soportada: ${ext}.`);
  }
  for (const ext of json.extensionsUsed ?? []) {
    if (!SUPPORTED_EXTENSIONS.has(ext)) report.warnings.push(`Extensión desconocida para el visor: ${ext}.`);
  }

  if (report.counts.meshes === 0) report.warnings.push('El archivo no contiene mallas.');
  if (report.counts.materials === 0 && report.counts.meshes > 0)
    report.warnings.push('Las mallas no tienen materiales; se verán con el material por defecto.');

  report.ok = report.errors.length === 0;
  return report;
}
