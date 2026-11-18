/**
 * Estado del motor local (services/api). Se consulta periódicamente.
 * La interfaz funciona sin motor: importar, ver, editar y exportar GLB
 * ocurre por completo en el navegador.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import type { ProviderStatus } from '@alagarda/shared-types';
import { useStudio } from '../store';

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
  error: string | null;
  lastChecked: number;
  check: (apiUrl: string) => Promise<void>;
}

export const useEngine = create<EngineState>((set) => ({
  state: 'checking',
  version: null,
  providers: [],
  hardware: null,
  error: null,
  lastChecked: 0,
  check: async (apiUrl) => {
    const base = apiUrl.replace(/\/$/, '');
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const health = await fetch(`${base}/api/health`, { signal: ctrl.signal }).then((r) => r.json());
      clearTimeout(t);
      const [providers, hardware] = await Promise.all([
        fetch(`${base}/api/providers`).then((r) => r.json()),
        fetch(`${base}/api/hardware`).then((r) => r.json()),
      ]);
      set({
        state: 'online',
        version: health.version ?? null,
        providers: providers.providers ?? [],
        hardware,
        error: null,
        lastChecked: Date.now(),
      });
    } catch (e) {
      set({
        state: 'offline',
        providers: [],
        hardware: null,
        error: e instanceof Error ? e.message : String(e),
        lastChecked: Date.now(),
      });
    }
  },
}));

let started = false;

export function useEngineStatus() {
  const apiUrl = useStudio((s) => s.apiUrl);
  const engine = useEngine();
  useEffect(() => {
    void useEngine.getState().check(apiUrl);
    if (started) return;
    started = true;
    const id = setInterval(() => void useEngine.getState().check(useStudio.getState().apiUrl), 15000);
    return () => {
      clearInterval(id);
      started = false;
    };
  }, [apiUrl]);
  return engine;
}
