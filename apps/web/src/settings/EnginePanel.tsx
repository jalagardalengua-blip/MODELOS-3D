import { useState } from 'react';
import { useStudio } from '../store';
import { useEngine } from './useEngineStatus';
import { Button, Field, inputClass, Row, Section, StatusDot } from '../components/ui';

export function EnginePanel() {
  const apiUrl = useStudio((s) => s.apiUrl);
  const setApiUrl = useStudio((s) => s.setApiUrl);
  const { state, version, providers, hardware, config, error, check } = useEngine();
  const [url, setUrl] = useState(apiUrl);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Section title="Motor local">
        <div className="mb-2 flex items-center gap-2 text-[12px]">
          <StatusDot state={state === 'online' ? 'ok' : state === 'checking' ? 'warn' : 'off'} />
          <span className="text-zinc-200">{state === 'online' ? `Conectado · v${version}` : state === 'checking' ? 'Comprobando…' : 'Desconectado'}</span>
        </div>
        <Field label="Dirección del motor">
          <div className="flex gap-1.5">
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button
              onClick={() => {
                setApiUrl(url);
                void check(url);
              }}
            >
              Probar
            </Button>
          </div>
        </Field>
        {state === 'offline' && (
          <div className="rounded-md bg-white/[0.03] p-2 text-[11px] leading-relaxed text-zinc-400">
            El visor, la biblioteca y la exportación GLB funcionan sin motor. Para la generación con IA, arranca el motor en tu ordenador:
            <pre className="mono mt-1.5 overflow-x-auto rounded bg-black/40 p-1.5 text-[10px] text-zinc-300">pnpm api</pre>
            {error && <div className="mt-1 text-[10px] text-zinc-600">{error}</div>}
          </div>
        )}
      </Section>

      {state === 'online' && (
        <Section title="Hugging Face">
          <Row label="HF_TOKEN">{config?.hfToken ?? 'no configurado'}</Row>
          {!config?.hfToken && (
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Funciona sin token con el cupo de invitado. Con una cuenta gratuita tienes más cupo diario de GPU: crea un token de lectura en
              huggingface.co → Settings → Access Tokens y ponlo en el archivo <span className="mono">.env</span> como{' '}
              <span className="mono">HF_TOKEN=…</span>. Después reinicia el motor.
            </p>
          )}
        </Section>
      )}

      {hardware && (
        <Section title="Hardware detectado">
          <Row label="Sistema">{hardware.platform}</Row>
          <Row label="CPU">{hardware.cpuCount ?? '—'} hilos</Row>
          <Row label="RAM">{hardware.ramGb ? `${hardware.ramGb.toFixed(1)} GB` : '—'}</Row>
          {hardware.gpus.length === 0 && <Row label="GPU">No detectada</Row>}
          {hardware.gpus.map((g, i) => (
            <Row key={i} label={`GPU ${i + 1}`}>
              {g.name}
              {g.vramGb ? ` · ${g.vramGb.toFixed(0)} GB` : ''}
            </Row>
          ))}
          <Row label="CUDA">{hardware.cuda ? 'Sí' : 'No'}</Row>
        </Section>
      )}

      <Section title="Proveedores de generación">
        {providers.length === 0 && <p className="text-[11px] text-zinc-500">Conecta el motor local para ver los proveedores.</p>}
        {providers.map((p) => (
          <div key={p.id} className="mb-2 rounded-md border border-[var(--line)] p-2">
            <div className="flex items-center gap-2">
              <StatusDot state={p.available ? 'ok' : p.enabled ? 'warn' : 'off'} />
              <span className="flex-1 text-[12px] font-medium text-zinc-100">{p.name}</span>
              <span className="text-[10px] text-zinc-500 uppercase">{p.kind === 'local' ? 'Local' : 'Externo'}</span>
            </div>
            <div className="mt-1 text-[11px] leading-snug text-zinc-400">{p.available ? 'Disponible' : p.reason}</div>
            <div className="mt-1 text-[10px] text-zinc-500">
              Licencia: {p.license}
              {p.licenseReviewRequired && <span className="ml-1 text-amber-300">· revisión obligatoria antes de uso comercial</span>}
            </div>
            {p.sendsDataExternally && <div className="mt-0.5 text-[10px] text-zinc-500">Envía los datos de entrada a un servicio externo.</div>}
          </div>
        ))}
      </Section>
    </div>
  );
}
