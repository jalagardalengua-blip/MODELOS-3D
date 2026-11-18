import { useEffect, useRef } from 'react';
import { useStudio } from '../store';
import { Tabs } from './ui';

const LEVEL_COLOR = { info: 'text-zinc-400', ok: 'text-emerald-400', warn: 'text-amber-300', error: 'text-red-400' };
const LEVEL_TAG = { info: 'INFO', ok: ' OK ', warn: 'AVISO', error: 'ERROR' };

function LogView() {
  const logs = useStudio((s) => s.logs);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [logs.length]);
  return (
    <div ref={ref} className="mono min-h-0 flex-1 overflow-y-auto px-3 py-1.5 text-[11px] leading-5">
      {logs.length === 0 && <div className="text-zinc-600">Sin actividad todavía.</div>}
      {logs.map((l) => (
        <div key={l.id} className="flex gap-2">
          <span className="shrink-0 text-zinc-600">{l.time}</span>
          <span className={`w-10 shrink-0 ${LEVEL_COLOR[l.level]}`}>{LEVEL_TAG[l.level]}</span>
          <span className="text-zinc-300">{l.message}</span>
        </div>
      ))}
    </div>
  );
}

function AnimationsView() {
  const loaded = useStudio((s) => s.loaded);
  const activeClip = useStudio((s) => s.activeClip);
  const playing = useStudio((s) => s.playing);
  const setActiveClip = useStudio((s) => s.setActiveClip);
  const setPlaying = useStudio((s) => s.setPlaying);
  const clips = loaded?.animations ?? [];

  if (!clips.length)
    return <div className="px-3 py-3 text-[11px] text-zinc-500">{loaded ? 'Este modelo no contiene animaciones.' : 'Abre un modelo para ver sus animaciones.'}</div>;

  return (
    <div className="flex min-h-0 flex-1 items-start gap-2 overflow-x-auto px-3 py-2">
      <button
        onClick={() => setPlaying(!playing)}
        disabled={!activeClip}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-white disabled:opacity-40"
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" /><rect x="7" y="1" width="3" height="10" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1l9 5-9 5z" /></svg>
        )}
      </button>
      {clips.map((c, i) => (
        <button
          key={`${c.name}-${i}`}
          onClick={() => setActiveClip(c.name)}
          className={`shrink-0 rounded-md border px-2.5 py-1 text-left text-[11px] ${
            activeClip === c.name ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white' : 'border-white/10 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="font-medium">{c.name || `Clip ${i + 1}`}</div>
          <div className="mono text-[10px] text-zinc-500">
            {c.duration.toFixed(2)} s · {c.tracks.length} pistas
          </div>
        </button>
      ))}
    </div>
  );
}

export function BottomBar() {
  const tab = useStudio((s) => s.bottomTab);
  const setTab = useStudio((s) => s.setBottomTab);
  const clipCount = useStudio((s) => s.loaded?.animations.length ?? 0);
  const errors = useStudio((s) => s.logs.filter((l) => l.level === 'error').length);
  return (
    <div className="flex h-36 shrink-0 flex-col border-t border-[var(--line)] bg-[var(--panel)] sm:h-40">
      <div className="max-w-xs">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'registro', label: 'Registro', badge: errors ? <span className="rounded bg-red-500/20 px-1 text-[9px] text-red-300">{errors}</span> : undefined },
            { id: 'animaciones', label: 'Animaciones', badge: clipCount ? <span className="text-[9px] text-zinc-500">{clipCount}</span> : undefined },
          ]}
        />
      </div>
      {tab === 'registro' ? <LogView /> : <AnimationsView />}
    </div>
  );
}
