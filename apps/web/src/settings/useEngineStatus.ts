/**
 * Estado del motor local (services/api): salud, hardware, proveedores,
 * configuración y trabajos de generación.
 *
 * La interfaz funciona sin motor: importar, ver, editar y exportar GLB
 * ocurre por completo en el navegador. La generación requiere el motor.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import type { GenerationJob, ProviderStatus } from '@alagarda/shared-types';
import { useStudio } from '../store';
import { fetchJobResult, getConfig, listJobs, type EngineConfig } from '../lib/engineApi';

export interface HardwareInfo {
  platform: string;
  cpuCount: number | null;
  ramGb: number | null;
  gpus: { name: string; vramGb: number | null; vendor: string }[];
  cuda: boolean;
}

interface EngineState {
  state: 'checking' | 'online' | 'offline';
  version: string | null;
  providers: ProviderStatus[];
  hardware: HardwareInfo | null;
  config: EngineConfig | null;
  jobs: GenerationJob[];
  error: string | null;
  lastChecked: number;
  check: (apiUrl: string) => Promise<void>;
  refreshJobs: (apiUrl: string) => Promise<void>;
  upsertJob: (job: GenerationJob) => void;
}

export const useEngine = create<EngineState>((set) => ({
  state: 'checking',
  version: null,
  providers: [],
  hardware: null,
  config: null,
  jobs: [],
  error: null,
  lastChecked: 0,
  check: async (apiUrl) => {
    const base = apiUrl.replace(/\/$/, '');
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const health = await fetch(`${base}/api/health`, { signal: ctrl.signal }).then((r) => r.json());
      clearTimeout(t);
      const [providers, hardware, config, jobs] = await Promise.all([
        fetch(`${base}/api/providers`).then((r) => r.json()),
        fetch(`${base}/api/hardware`).then((r) => r.json()),
        getConfig(apiUrl).catch(() => null),
        listJobs(apiUrl).catch(() => []),
      ]);
      set({
        state: 'online',
        version: health.version ?? null,
        providers: providers.providers ?? [],
        hardware,
        config,
        jobs,
        error: null,
        lastChecked: Date.now(),
      });
    } catch (e) {
      set({ state: 'offline', providers: [], hardware: null, config: null, error: e instanceof Error ? e.message : String(e), lastChecked: Date.now() });
    }
  },
  refreshJobs: async (apiUrl) => {
    try {
      set({ jobs: await listJobs(apiUrl) });
    } catch {
      /* el chequeo periódico marcará el motor como desconectado */
    }
  },
  upsertJob: (job) => set((s) => ({ jobs: [job, ...s.jobs.filter((j) => j.id !== job.id)] })),
}));

export const isActive = (j: GenerationJob) => j.status === 'queued' || j.status === 'running';

/* ---------------------------------------------------------------- importación automática */

const IMPORTED_KEY = 'alagarda.importedJobs';
const LAUNCHED_KEY = 'alagarda.launchedJobs';

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function addToSet(key: string, id: string) {
  const set = readSet(key);
  set.add(id);
  try {
    localStorage.setItem(key, JSON.stringify([...set].slice(-500)));
  } catch {
    /* almacenamiento no disponible */
  }
}

const importedJobs = () => readSet(IMPORTED_KEY);
const markImported = (id: string) => addToSet(IMPORTED_KEY, id);
/** Recuerda los trabajos lanzados desde este navegador para importarlos aunque se cierre la pestaña. */
export const markLaunched = (id: string) => addToSet(LAUNCHED_KEY, id);

const importing = new Set<string>();

/** Añade a la biblioteca los trabajos completados que aún no se han importado. */
async function importFinishedJobs(jobs: GenerationJob[], previous: GenerationJob[]) {
  const studio = useStudio.getState();
  const done = importedJobs();
  const launched = readSet(LAUNCHED_KEY);
  for (const job of jobs) {
    if (job.status !== 'succeeded' || done.has(job.id) || importing.has(job.id)) continue;
    // Solo trabajos que hemos visto terminar en esta sesión o que se lanzaron desde aquí.
    const wasActive = previous.some((p) => p.id === job.id && isActive(p));
    const alreadyInLibrary = studio.assets.some((a) => a.provenance.jobId === job.id);
    if (alreadyInLibrary) {
      markImported(job.id);
      continue;
    }
    if (!wasActive && !launched.has(job.id)) continue;
    importing.add(job.id);
    try {
      studio.log('info', `Descargando el modelo generado «${job.name}»…`);
      const buffer = await fetchJobResult(studio.apiUrl, job.id);
      const id = await studio.addGlbToLibrary(buffer, {
        name: job.name,
        source: 'generated',
        engine: job.engine ?? job.provider,
        jobId: job.id,
        category: job.category,
        license: job.license ?? 'Revisar licencia del motor',
        tags: ['ia', job.params.quality, ...(job.params.prompt ? [] : ['desde-imagen'])],
      });
      markImported(job.id);
      if (id) {
        await useStudio.getState().selectAsset(id);
        studio.log('ok', `Generación completada en ${job.durationSeconds ?? '?'} s. «${job.name}» está abierto en el visor.`);
      }
    } catch (e) {
      studio.log('error', `No se pudo importar «${job.name}»: ${e instanceof Error ? e.message : e}`);
    } finally {
      importing.delete(job.id);
    }
  }
}

/* ---------------------------------------------------------------- sondeo */

let started = false;

export function useEngineStatus() {
  const apiUrl = useStudio((s) => s.apiUrl);
  const engine = useEngine();
  useEffect(() => {
    void useEngine.getState().check(apiUrl);
    if (started) return;
    started = true;
    const slow = setInterval(() => void useEngine.getState().check(useStudio.getState().apiUrl), 15000);
    // Sondeo rápido solo mientras hay trabajos activos.
    const fast = setInterval(() => {
      const st = useEngine.getState();
      if (st.state === 'online' && st.jobs.some(isActive)) void st.refreshJobs(useStudio.getState().apiUrl);
    }, 1500);
    return () => {
      clearInterval(slow);
      clearInterval(fast);
      started = false;
    };
  }, [apiUrl]);
  return engine;
}

/** Registra los cambios de estado de los trabajos y los importa al terminar. */
export function useJobWatcher() {
  useEffect(
    () =>
      useEngine.subscribe((state, prev) => {
        if (state.jobs === prev.jobs) return;
        const log = useStudio.getState().log;
        for (const job of state.jobs) {
          const old = prev.jobs.find((p) => p.id === job.id);
          if (!old || old.status === job.status) continue;
          if (job.status === 'failed') log('error', `Generación «${job.name}» fallida: ${job.error}`);
          if (job.status === 'running' && old.status === 'queued') log('info', `Generación «${job.name}» en marcha.`);
        }
        void importFinishedJobs(state.jobs, prev.jobs);
      }),
    [],
  );
}
