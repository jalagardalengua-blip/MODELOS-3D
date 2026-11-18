/** Cliente HTTP del motor local (services/api). */
import type { GenerationJob, GenerationQuality, AssetCategory } from '@alagarda/shared-types';

export class EngineError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function base(apiUrl: string): string {
  return apiUrl.replace(/\/$/, '');
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new EngineError('No se puede conectar con el motor local. ¿Está arrancado (pnpm api)?', 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* respuesta sin JSON */
    }
    throw new EngineError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export interface GenerateInput {
  provider: string;
  prompt?: string;
  image?: File | null;
  seed?: number | null;
  quality: GenerationQuality;
  name: string;
  category: AssetCategory;
}

export function submitGeneration(apiUrl: string, input: GenerateInput): Promise<GenerationJob> {
  const form = new FormData();
  form.set('provider', input.provider);
  form.set('quality', input.quality);
  form.set('name', input.name);
  form.set('category', input.category);
  if (input.prompt?.trim()) form.set('prompt', input.prompt.trim());
  if (input.seed !== null && input.seed !== undefined) form.set('seed', String(input.seed));
  if (input.image) form.set('image', input.image, input.image.name);
  return request<GenerationJob>(`${base(apiUrl)}/api/generate`, { method: 'POST', body: form });
}

export async function listJobs(apiUrl: string): Promise<GenerationJob[]> {
  return (await request<{ jobs: GenerationJob[] }>(`${base(apiUrl)}/api/jobs`)).jobs;
}

export function cancelJob(apiUrl: string, id: string): Promise<GenerationJob> {
  return request<GenerationJob>(`${base(apiUrl)}/api/jobs/${id}/cancel`, { method: 'POST' });
}

export async function fetchJobResult(apiUrl: string, id: string): Promise<ArrayBuffer> {
  const res = await fetch(`${base(apiUrl)}/api/jobs/${id}/result.glb`);
  if (!res.ok) throw new EngineError('No se pudo descargar el modelo generado.', res.status);
  return res.arrayBuffer();
}

export function jobReferenceUrl(apiUrl: string, id: string): string {
  return `${base(apiUrl)}/api/jobs/${id}/reference`;
}

export interface EngineConfig {
  hfToken: string | null;
  tripoKey: string | null;
}

export function getConfig(apiUrl: string): Promise<EngineConfig> {
  return request<EngineConfig>(`${base(apiUrl)}/api/config`);
}
