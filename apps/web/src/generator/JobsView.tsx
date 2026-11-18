/** Lista de trabajos de generación con progreso, errores y acceso al resultado. */
import type { GenerationJob } from '@alagarda/shared-types';
import { useEngine } from '../settings/useEngineStatus';
import { useStudio } from '../store';
import { cancelJob, jobReferenceUrl } from '../lib/engineApi';
import { formatBytes } from '../lib/format';

const STATUS_LABEL: Record<GenerationJob['status'], string> = {
  queued: 'En cola',
  running: 'Generando',
  succeeded: 'Completado',
  failed: 'Error',
  cancelled: 'Cancelado',
};

const STATUS_COLOR: Record<GenerationJob['status'], string> = {
  queued: 'text-zinc-400',
  running: 'text-[var(--accent-2)]',
  succeeded: 'text-emerald-400',
  failed: 'text-red-400',
  cancelled: 'text-zinc-500',
};

function JobRow({ job }: { job: GenerationJob }) {
  const apiUrl = useStudio((s) => s.apiUrl);
  const asset = useStudio((s) => s.assets.find((a) => a.provenance.jobId === job.id));
  const selectAsset = useStudio((s) => s.selectAsset);
  const upsertJob = useEngine((s) => s.upsertJob);
  const pct = Math.round(job.progress * 100);

  return (
    <div className="flex w-72 shrink-0 gap-2 rounded-md border border-[var(--line)] bg-[var(--panel-2)] p-2">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-black">
        {job.hasReference || job.params.imageName ? (
          <img src={jobReferenceUrl(apiUrl, job.id)} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-zinc-100">{job.name}</span>
          <span className={`shrink-0 text-[10px] font-semibold ${STATUS_COLOR[job.status]}`}>{STATUS_LABEL[job.status]}</span>
        </div>
        {(job.status === 'running' || job.status === 'queued') && (
          <>
            <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            <div className="mt-1 truncate text-[10px] text-zinc-400" title={job.message}>
              {pct}% · {job.message}
            </div>
          </>
        )}
        {job.status === 'failed' && (
          <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-red-300" title={job.error ?? ''}>
            {job.error}
          </div>
        )}
        {job.status === 'succeeded' && (
          <div className="mt-1 text-[10px] text-zinc-500">
            {job.sizeBytes ? formatBytes(job.sizeBytes) : ''} · {job.durationSeconds ?? '?'} s · {job.params.quality}
          </div>
        )}
        <div className="mt-1 flex gap-2 text-[10px]">
          {job.status === 'queued' && (
            <button className="text-zinc-400 hover:text-white" onClick={() => void cancelJob(apiUrl, job.id).then(upsertJob)}>
              Cancelar
            </button>
          )}
          {job.status === 'succeeded' && asset && (
            <button className="text-zinc-300 hover:text-white" onClick={() => void selectAsset(asset.id)}>
              Abrir en el visor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobsView() {
  const jobs = useEngine((s) => s.jobs);
  const state = useEngine((s) => s.state);
  if (state !== 'online') return <div className="px-3 py-3 text-[11px] text-zinc-500">Motor local desconectado: no hay trabajos que mostrar.</div>;
  if (!jobs.length) return <div className="px-3 py-3 text-[11px] text-zinc-500">Aún no hay generaciones. Usa el panel Generador.</div>;
  return (
    <div className="flex min-h-0 flex-1 items-start gap-2 overflow-x-auto px-3 py-2">
      {jobs.slice(0, 30).map((j) => (
        <JobRow key={j.id} job={j} />
      ))}
    </div>
  );
}
