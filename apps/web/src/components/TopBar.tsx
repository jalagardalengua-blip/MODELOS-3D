import { useRef } from 'react';
import { useStudio } from '../store';
import { Button } from './ui';
import { useEngineStatus } from '../settings/useEngineStatus';
import { StatusDot } from './ui';

export function TopBar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const importFiles = useStudio((s) => s.importFiles);
  const loaded = useStudio((s) => s.loaded);
  const dirty = useStudio((s) => s.dirty);
  const exportCurrent = useStudio((s) => s.exportCurrent);
  const downloadOriginal = useStudio((s) => s.downloadOriginal);
  const asset = useStudio((s) => s.assets.find((a) => a.id === s.selectedId));
  const setMobilePanel = useStudio((s) => s.setMobilePanel);
  const mobilePanel = useStudio((s) => s.mobilePanel);
  const setRightTab = useStudio((s) => s.setRightTab);
  const engine = useEngineStatus();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-2 sm:px-3">
      <button
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/5 lg:hidden"
        onClick={() => setMobilePanel(mobilePanel === 'left' ? null : 'left')}
        aria-label="Biblioteca"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)]">
          <svg width="16" height="16" viewBox="0 0 32 32">
            <path d="M8 23 16 8l8 15z" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[12px] font-bold tracking-[0.14em]">ALAGARDA</div>
          <div className="text-[9px] font-semibold tracking-[0.3em] text-zinc-500">3D STUDIO</div>
        </div>
      </div>

      <div className="mx-2 hidden h-6 w-px bg-[var(--line)] md:block" />
      <div className="hidden min-w-0 flex-1 md:block">
        <div className="truncate text-[11px] text-zinc-500">{asset?.project ?? 'Sin proyecto'}</div>
        <div className="truncate text-[12px] font-medium text-zinc-200">
          {asset?.name ?? 'Ningún modelo abierto'}
          {dirty && <span className="ml-1.5 text-[var(--accent-2)]">● sin exportar</span>}
        </div>
      </div>
      <div className="flex-1 md:hidden" />

      <button
        onClick={() => {
          setRightTab('motor');
          setMobilePanel('right');
        }}
        className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/5 sm:flex"
        title="Estado del motor local"
      >
        <StatusDot state={engine.state === 'online' ? 'ok' : engine.state === 'checking' ? 'warn' : 'off'} />
        {engine.state === 'online' ? 'Motor local' : engine.state === 'checking' ? 'Comprobando…' : 'Motor desconectado'}
      </button>

      <input
        ref={fileInput}
        type="file"
        accept=".glb,model/gltf-binary"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button onClick={() => fileInput.current?.click()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className="hidden sm:inline">Importar GLB</span>
      </Button>
      <Button className="max-md:hidden" disabled={!loaded} onClick={() => void downloadOriginal()} title="Descargar el archivo tal como está en la biblioteca">
        Original
      </Button>
      <Button variant="primary" disabled={!loaded} onClick={() => void exportCurrent({ saveAsVersion: dirty })}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 15V3m0 0 4 4m-4-4L8 7M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className="hidden sm:inline">Exportar GLB</span>
      </Button>

      <button
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/5 lg:hidden"
        onClick={() => setMobilePanel(mobilePanel === 'right' ? null : 'right')}
        aria-label="Propiedades"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1" />
        </svg>
      </button>
    </header>
  );
}
