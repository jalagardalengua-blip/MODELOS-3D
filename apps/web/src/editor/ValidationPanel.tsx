import type { GlbValidationReport } from '@alagarda/shared-types';
import { useStudio } from '../store';
import { Button, Empty, Row, Section, StatusDot } from '../components/ui';
import { formatBytes, formatNumber } from '../lib/format';

function Report({ title, report }: { title: string; report: GlbValidationReport }) {
  return (
    <Section title={title} right={<span className={`text-[10px] font-semibold ${report.ok ? 'text-emerald-400' : 'text-red-400'}`}>{report.ok ? 'VÁLIDO' : 'CON ERRORES'}</span>}>
      <Row label="Contenedor">GLB v{report.version ?? '—'}</Row>
      <Row label="Generador">{report.generator ?? '—'}</Row>
      <Row label="Tamaño">{formatBytes(report.actualLength)}</Row>
      <Row label="Nodos / Mallas">
        {report.counts.nodes} / {report.counts.meshes}
      </Row>
      <Row label="Materiales">{report.counts.materials}</Row>
      <Row label="Texturas / Imágenes">
        {report.counts.textures} / {report.counts.images}
      </Row>
      <Row label="Esqueletos">{report.counts.skins}</Row>
      <Row label="Animaciones">{report.counts.animations}</Row>
      {[...report.errors.map((m) => ['error', m] as const), ...report.warnings.map((m) => ['warn', m] as const)].map(([lvl, m], i) => (
        <div key={i} className="mt-1.5 flex gap-2 text-[11px] leading-snug">
          <StatusDot state={lvl === 'error' ? 'error' : 'warn'} />
          <span className={lvl === 'error' ? 'text-red-300' : 'text-amber-200/90'}>{m}</span>
        </div>
      ))}
    </Section>
  );
}

export function ValidationPanel() {
  const loaded = useStudio((s) => s.loaded);
  const last = useStudio((s) => s.lastExport);
  const exportCurrent = useStudio((s) => s.exportCurrent);
  if (!loaded) return <Empty>Abre un modelo para validarlo.</Empty>;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Report title="Archivo en biblioteca" report={loaded.validation} />
      {last ? (
        <>
          <Section
            title="Prueba de ida y vuelta"
            right={<span className={`text-[10px] font-semibold ${last.preserved ? 'text-emerald-400' : 'text-amber-400'}`}>{last.preserved ? 'CONSERVADO' : 'REVISAR'}</span>}
          >
            <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
              El GLB exportado se ha vuelto a abrir y se ha comparado con el modelo del visor.
            </p>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-[11px]">
              <span className="text-zinc-500" />
              <span className="text-right text-zinc-500">Antes</span>
              <span className="text-right text-zinc-500">Después</span>
              {last.roundTrip.map((r) => (
                <div key={r.label} className="contents">
                  <span className="text-zinc-400">{r.label}</span>
                  <span className="mono text-right text-zinc-300">{formatNumber(r.before)}</span>
                  <span className={`mono text-right ${r.after >= r.before ? 'text-emerald-300' : 'text-red-300'}`}>{formatNumber(r.after)}</span>
                </div>
              ))}
            </div>
          </Section>
          <Report title="GLB exportado" report={last.validation} />
        </>
      ) : (
        <Section title="Exportación">
          <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
            Exporta el modelo para comprobar que el GLB resultante conserva mallas, materiales, texturas, huesos y animaciones.
          </p>
          <Button variant="primary" className="w-full" onClick={() => void exportCurrent({ saveAsVersion: false })}>
            Exportar y validar
          </Button>
        </Section>
      )}
    </div>
  );
}
