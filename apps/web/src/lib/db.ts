/**
 * Biblioteca local en IndexedDB.
 * - "assets": metadatos (AssetMeta).
 * - "files": binario GLB de cada activo (Blob), separado para listar rápido.
 *
 * Los modelos nunca se suben a GitHub ni a servicios externos desde aquí.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AssetMeta } from '@alagarda/shared-types';

interface StudioDB extends DBSchema {
  assets: { key: string; value: AssetMeta; indexes: { 'by-updated': string } };
  files: { key: string; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<StudioDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<StudioDB>('alagarda-3d-studio', 1, {
      upgrade(database) {
        const assets = database.createObjectStore('assets', { keyPath: 'id' });
        assets.createIndex('by-updated', 'updatedAt');
        database.createObjectStore('files');
      },
    });
  }
  return dbPromise;
}

export async function listAssets(): Promise<AssetMeta[]> {
  const all = await (await db()).getAll('assets');
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveAsset(meta: AssetMeta, file?: Blob): Promise<void> {
  const d = await db();
  const tx = d.transaction(['assets', 'files'], 'readwrite');
  await tx.objectStore('assets').put(meta);
  if (file) await tx.objectStore('files').put(file, meta.id);
  await tx.done;
}

export async function updateAsset(id: string, patch: Partial<AssetMeta>): Promise<AssetMeta | null> {
  const d = await db();
  const current = await d.get('assets', id);
  if (!current) return null;
  const next: AssetMeta = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
  await d.put('assets', next);
  return next;
}

export async function getAssetFile(id: string): Promise<Blob | undefined> {
  return (await db()).get('files', id);
}

export async function deleteAsset(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['assets', 'files'], 'readwrite');
  await tx.objectStore('assets').delete(id);
  await tx.objectStore('files').delete(id);
  await tx.done;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}

/** Pide al navegador que no borre la biblioteca bajo presión de espacio. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
