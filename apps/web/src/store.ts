/**
 * Estado global de la aplicación (zustand).
 * Contiene la biblioteca, el modelo cargado en el visor, las opciones de vista
 * y el registro de procesos que se muestra en la barra inferior.
 */
import { create } from 'zustand';
import type * as THREE from 'three';
import type { AssetCategory, AssetMeta, GlbValidationReport, ModelStats } from '@alagarda/shared-types';
import * as db from './lib/db';
import { validateGlb } from './lib/glbFormat';
import { computeStats, disposeObject, downloadBuffer, exportGlb, loadGlb } from './lib/modelLoader';
import { formatBytes, safeFileName, stripExtension } from './lib/format';

export type LogLevel = 'info' | 'ok' | 'warn' | 'error';
export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

export type LightingPreset = 'estudio' | 'exterior' | 'atardecer' | 'plaza-noche';
export type LeftTab = 'biblioteca' | 'generador';
export type RightTab = 'propiedades' | 'materiales' | 'validacion' | 'motor';
export type BottomTab = 'registro' | 'animaciones';

export interface LoadedModel {
  assetId: string;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  stats: ModelStats;
  validation: GlbValidationReport;
}

export interface ExportResult {
  assetName: string;
  sizeBytes: number;
  validation: GlbValidationReport;
  /** Comparación del archivo exportado reabierto frente al original. */
  roundTrip: { label: string; before: number; after: number }[];
  preserved: boolean;
}

interface ViewOptions {
  wireframe: boolean;
  skeleton: boolean;
  grid: boolean;
  autoRotate: boolean;
  lighting: LightingPreset;
  exposure: number;
}

interface StudioState {
  assets: AssetMeta[];
  selectedId: string | null;
  loaded: LoadedModel | null;
  loading: boolean;
  /** Se incrementa cuando se editan materiales o transformaciones. */
  revision: number;
  dirty: boolean;
  view: ViewOptions;
  leftTab: LeftTab;
  rightTab: RightTab;
  bottomTab: BottomTab;
  activeClip: string | null;
  playing: boolean;
  lastExport: ExportResult | null;
  logs: LogEntry[];
  thumbnailRequest: string | null;
  fitRequest: number;
  requestFit: () => void;
  apiUrl: string;
  mobilePanel: 'left' | 'right' | null;

  log: (level: LogLevel, message: string) => void;
  refreshLibrary: () => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  selectAsset: (id: string | null) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  updateMeta: (id: string, patch: Partial<Pick<AssetMeta, 'name' | 'project' | 'category' | 'tags' | 'license'>>) => Promise<void>;
  setThumbnail: (id: string, dataUrl: string) => Promise<void>;
  downloadOriginal: () => Promise<void>;
  exportCurrent: (opts: { saveAsVersion: boolean }) => Promise<void>;
  touch: () => void;
  setView: (patch: Partial<ViewOptions>) => void;
  setLeftTab: (t: LeftTab) => void;
  setRightTab: (t: RightTab) => void;
  setBottomTab: (t: BottomTab) => void;
  setActiveClip: (name: string | null) => void;
  setPlaying: (p: boolean) => void;
  setApiUrl: (url: string) => void;
  setMobilePanel: (p: 'left' | 'right' | null) => void;
}

let logCounter = 0;

function readApiUrl(): string {
  try {
    return localStorage.getItem('alagarda.apiUrl') || 'http://127.0.0.1:8000';
  } catch {
    return 'http://127.0.0.1:8000';
  }
}

function now(): string {
  return new Date().toLocaleTimeString('es-ES', { hour12: false });
}

export const useStudio = create<StudioState>((set, get) => ({
  assets: [],
  selectedId: null,
  loaded: null,
  loading: false,
  revision: 0,
  dirty: false,
  view: { wireframe: false, skeleton: false, grid: true, autoRotate: false, lighting: 'estudio', exposure: 1 },
  leftTab: 'biblioteca',
  rightTab: 'propiedades',
  bottomTab: 'registro',
  activeClip: null,
  playing: false,
  lastExport: null,
  logs: [],
  thumbnailRequest: null,
  fitRequest: 0,
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  apiUrl: readApiUrl(),
  mobilePanel: null,

  log: (level, message) =>
    set((s) => ({ logs: [...s.logs.slice(-299), { id: ++logCounter, time: now(), level, message }] })),

  refreshLibrary: async () => {
    const assets = await db.listAssets();
    set({ assets });
  },

  importFiles: async (files) => {
    const { log } = get();
    const list = Array.from(files);
    let lastId: string | null = null;
    for (const file of list) {
      if (!/\.glb$/i.test(file.name)) {
        log('warn', `«${file.name}» omitido: en esta fase solo se importan archivos .glb (glTF binario).`);
        continue;
      }
      log('info', `Importando «${file.name}» (${formatBytes(file.size)})…`);
      const buffer = await file.arrayBuffer();
      const validation = validateGlb(buffer);
      if (!validation.ok) {
        validation.errors.forEach((e) => log('error', `${file.name}: ${e}`));
        log('error', `«${file.name}» no se ha importado porque no es un GLB válido.`);
        continue;
      }
      validation.warnings.forEach((w) => log('warn', `${file.name}: ${w}`));

      let stats: ModelStats | null = null;
      try {
        const gltf = await loadGlb(buffer);
        stats = computeStats(gltf.scene, gltf.animations);
        disposeObject(gltf.scene);
      } catch (e) {
        log('error', `three.js no pudo abrir «${file.name}»: ${e instanceof Error ? e.message : e}`);
        continue;
      }

      const ts = new Date().toISOString();
      const meta: AssetMeta = {
        id: db.newId(),
        name: stripExtension(file.name),
        project: 'GANADERÍA 27',
        category: 'otro' as AssetCategory,
        tags: [],
        license: 'Sin especificar',
        provenance: { source: 'import', engine: null, originalFileName: file.name, parentId: null },
        version: 1,
        sizeBytes: file.size,
        createdAt: ts,
        updatedAt: ts,
        thumbnail: null,
        stats,
      };
      await db.saveAsset(meta, new Blob([buffer], { type: 'model/gltf-binary' }));
      log('ok', `«${file.name}» añadido a la biblioteca (${stats.meshes} mallas, ${stats.triangles.toLocaleString('es-ES')} triángulos).`);
      lastId = meta.id;
    }
    await get().refreshLibrary();
    if (lastId) await get().selectAsset(lastId);
  },

  selectAsset: async (id) => {
    const prev = get().loaded;
    if (id === null) {
      if (prev) disposeObject(prev.scene);
      set({ selectedId: null, loaded: null, activeClip: null, playing: false, dirty: false });
      return;
    }
    const meta = get().assets.find((a) => a.id === id);
    set({ selectedId: id, loading: true, mobilePanel: null });
    try {
      const blob = await db.getAssetFile(id);
      if (!blob) throw new Error('El archivo no está en la biblioteca local.');
      const buffer = await blob.arrayBuffer();
      const validation = validateGlb(buffer);
      const gltf = await loadGlb(buffer);
      const stats = computeStats(gltf.scene, gltf.animations);
      if (prev) disposeObject(prev.scene);
      const first = gltf.animations[0]?.name ?? null;
      set({
        loaded: { assetId: id, scene: gltf.scene, animations: gltf.animations, stats, validation },
        loading: false,
        activeClip: first,
        playing: !!first,
        dirty: false,
        revision: get().revision + 1,
        lastExport: null,
        thumbnailRequest: meta && !meta.thumbnail ? id : null,
      });
      get().log('info', `Abierto «${meta?.name ?? id}».`);
      if (meta && !meta.stats) {
        await db.updateAsset(id, { stats });
        await get().refreshLibrary();
      }
    } catch (e) {
      set({ loading: false });
      get().log('error', `No se pudo abrir el modelo: ${e instanceof Error ? e.message : e}`);
    }
  },

  removeAsset: async (id) => {
    const meta = get().assets.find((a) => a.id === id);
    await db.deleteAsset(id);
    if (get().selectedId === id) await get().selectAsset(null);
    await get().refreshLibrary();
    get().log('info', `Eliminado «${meta?.name ?? id}» de la biblioteca.`);
  },

  updateMeta: async (id, patch) => {
    await db.updateAsset(id, patch);
    await get().refreshLibrary();
  },

  setThumbnail: async (id, dataUrl) => {
    await db.updateAsset(id, { thumbnail: dataUrl });
    set({ thumbnailRequest: null });
    await get().refreshLibrary();
  },

  downloadOriginal: async () => {
    const { selectedId, assets } = get();
    if (!selectedId) return;
    const blob = await db.getAssetFile(selectedId);
    const meta = assets.find((a) => a.id === selectedId);
    if (blob) downloadBuffer(blob, `${safeFileName(meta?.name ?? 'modelo')}.glb`);
  },

  exportCurrent: async ({ saveAsVersion }) => {
    const { loaded, assets, log } = get();
    if (!loaded) return;
    const meta = assets.find((a) => a.id === loaded.assetId);
    const name = meta?.name ?? 'modelo';
    log('info', `Exportando «${name}» a GLB 2.0…`);

    try {
      const buffer = await exportGlb(loaded.scene, loaded.animations);
      const validation = validateGlb(buffer);

      // Validación de ida y vuelta: reabrir el archivo y comparar componentes.
      const reopened = await loadGlb(buffer);
      const after = computeStats(reopened.scene, reopened.animations);
      disposeObject(reopened.scene);
      const before = loaded.stats;
      const roundTrip = [
        { label: 'Mallas', before: before.meshes, after: after.meshes },
        { label: 'Triángulos', before: before.triangles, after: after.triangles },
        { label: 'Materiales', before: before.materials, after: after.materials },
        { label: 'Texturas', before: before.textures, after: after.textures },
        { label: 'Huesos', before: before.bones, after: after.bones },
        { label: 'Animaciones', before: before.animations.length, after: after.animations.length },
      ];
      const preserved = validation.ok && roundTrip.every((r) => r.after >= r.before);

      set({ lastExport: { assetName: name, sizeBytes: buffer.byteLength, validation, roundTrip, preserved }, rightTab: 'validacion' });
      if (preserved) log('ok', `Exportación válida: el GLB reabierto conserva todos sus componentes (${formatBytes(buffer.byteLength)}).`);
      else log('warn', 'La exportación se completó, pero el GLB reabierto no conserva todos los componentes. Revisa la pestaña Validación.');

      downloadBuffer(buffer, `${safeFileName(name)}.glb`);

      if (saveAsVersion && meta) {
        const ts = new Date().toISOString();
        const version: AssetMeta = {
          ...meta,
          id: db.newId(),
          name: `${meta.name} v${meta.version + 1}`,
          version: meta.version + 1,
          provenance: { ...meta.provenance, source: 'export', parentId: meta.id },
          sizeBytes: buffer.byteLength,
          createdAt: ts,
          updatedAt: ts,
          thumbnail: meta.thumbnail,
          stats: after,
        };
        await db.saveAsset(version, new Blob([buffer], { type: 'model/gltf-binary' }));
        await get().refreshLibrary();
        log('ok', `Guardada nueva versión «${version.name}» en la biblioteca.`);
      }
      set({ dirty: false });
    } catch (e) {
      log('error', `Error al exportar: ${e instanceof Error ? e.message : e}`);
    }
  },

  touch: () => set((s) => ({ revision: s.revision + 1, dirty: true })),
  setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
  setLeftTab: (leftTab) => set({ leftTab }),
  setRightTab: (rightTab) => set({ rightTab }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  setActiveClip: (activeClip) => set({ activeClip, playing: activeClip !== null }),
  setPlaying: (playing) => set({ playing }),
  setApiUrl: (apiUrl) => {
    try {
      localStorage.setItem('alagarda.apiUrl', apiUrl);
    } catch {
      /* almacenamiento no disponible */
    }
    set({ apiUrl });
  },
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
}));
