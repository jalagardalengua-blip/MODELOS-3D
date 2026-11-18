/**
 * Tipos compartidos entre la interfaz web, la aplicación de escritorio
 * y (por contrato JSON) el motor local en Python.
 *
 * Mantener sincronizado con packages/asset-schema/asset.schema.json
 * y services/api/schemas/.
 */

export type AssetCategory =
  | 'toro'
  | 'torero'
  | 'caballo'
  | 'capote-muleta'
  | 'publico'
  | 'plaza'
  | 'humano'
  | 'animal'
  | 'vehiculo'
  | 'ropa'
  | 'edificio'
  | 'escenario'
  | 'objeto'
  | 'otro';

export const ASSET_CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: 'toro', label: 'Toro bravo' },
  { id: 'torero', label: 'Torero' },
  { id: 'caballo', label: 'Caballo' },
  { id: 'capote-muleta', label: 'Capote / Muleta' },
  { id: 'publico', label: 'Público' },
  { id: 'plaza', label: 'Plaza' },
  { id: 'humano', label: 'Humano' },
  { id: 'animal', label: 'Animal' },
  { id: 'vehiculo', label: 'Vehículo' },
  { id: 'ropa', label: 'Ropa' },
  { id: 'edificio', label: 'Edificio' },
  { id: 'escenario', label: 'Escenario' },
  { id: 'objeto', label: 'Objeto' },
  { id: 'otro', label: 'Otro' },
];

/** De dónde procede un activo. Cada activo registra procedencia y licencia. */
export type AssetSource = 'import' | 'generated' | 'export';

export interface AssetProvenance {
  source: AssetSource;
  /** Motor que lo generó (trellis, hunyuan, tripo…) o null si es importado. */
  engine: string | null;
  /** Archivo original del que procede, si se importó. */
  originalFileName: string | null;
  /** ID del activo del que deriva (p. ej. una exportación de otro activo). */
  parentId: string | null;
  /** Trabajo de generación del motor local que lo produjo. */
  jobId?: string | null;
}

export interface AssetMeta {
  id: string;
  name: string;
  project: string;
  category: AssetCategory;
  tags: string[];
  /** Licencia declarada (texto libre o identificador SPDX). */
  license: string;
  provenance: AssetProvenance;
  /** Versión del activo dentro de su linaje. */
  version: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  /** Miniatura en data URL (PNG/JPEG). */
  thumbnail: string | null;
  stats: ModelStats | null;
}

export interface ModelStats {
  meshes: number;
  vertices: number;
  triangles: number;
  materials: number;
  textures: number;
  skinnedMeshes: number;
  bones: number;
  animations: { name: string; duration: number; tracks: number }[];
  /** Dimensiones de la caja envolvente en unidades del modelo. */
  bounds: { x: number; y: number; z: number };
}

/** Resultado de validar un archivo GLB (en navegador o en el motor local). */
export interface GlbValidationReport {
  ok: boolean;
  version: number | null;
  declaredLength: number | null;
  actualLength: number;
  generator: string | null;
  counts: {
    meshes: number;
    materials: number;
    textures: number;
    images: number;
    skins: number;
    animations: number;
    nodes: number;
  };
  errors: string[];
  warnings: string[];
}

/** Estado de un proveedor de generación expuesto por el motor local. */
export interface ProviderStatus {
  id: string;
  name: string;
  kind: 'local' | 'external';
  enabled: boolean;
  available: boolean;
  capabilities: string[];
  reason: string | null;
  license: string;
  licenseReviewRequired: boolean;
  /** La generación envía imágenes o descripciones a un servicio externo. */
  sendsDataExternally: boolean;
}

export type GenerationQuality = 'borrador' | 'alta' | 'maxima';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** Trabajo de generación del motor local (services/api/jobs.py). */
export interface GenerationJob {
  id: string;
  provider: string;
  status: JobStatus;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  params: { prompt: string | null; seed: number | null; quality: GenerationQuality; imageName: string | null };
  name: string;
  category: AssetCategory;
  error: string | null;
  engine: string | null;
  license: string | null;
  sizeBytes: number | null;
  hasReference: boolean;
  metadata: Record<string, unknown>;
  durationSeconds: number | null;
}
