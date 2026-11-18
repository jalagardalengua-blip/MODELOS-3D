import { useEffect, useState } from 'react';
import { ASSET_CATEGORIES, type AssetCategory } from '@alagarda/shared-types';
import { useStudio, type LightingPreset } from '../store';
import { Button, Empty, Field, inputClass, Row, Section, Toggle } from '../components/ui';
import { formatBytes, formatNumber } from '../lib/format';

const LIGHTS: { id: LightingPreset; label: string }[] = [
  { id: 'estudio', label: 'Estudio' },
  { id: 'exterior', label: 'Exterior' },
  { id: 'atardecer', label: 'Atardecer' },
  { id: 'plaza-noche', label: 'Plaza noche' },
];

function ViewOptions() {
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  return (
    <Section title="Vista">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Toggle label="Wireframe" checked={view.wireframe} onChange={(v) => setView({ wireframe: v })} />
        <Toggle label="Esqueleto" checked={view.skeleton} onChange={(v) => setView({ skeleton: v })} />
        <Toggle label="Rejilla" checked={view.grid} onChange={(v) => setView({ grid: v })} />
        <Toggle label="Girar" checked={view.autoRotate} onChange={(v) => setView({ autoRotate: v })} />
      </div>
      <Field label="Iluminación">
        <div className="grid grid-cols-4 gap-1">
          {LIGHTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setView({ lighting: l.id })}
              className={`h-7 rounded text-[10px] ${view.lighting === l.id ? 'bg-white/15 text-white' : 'bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Exposición · ${view.exposure.toFixed(2)}`}>
        <input type="range" min={0.2} max={2.5} step={0.05} value={view.exposure} onChange={(e) => setView({ exposure: +e.target.value })} className="w-full" />
      </Field>
    </Section>
  );
}

function TransformEditor() {
  const loaded = useStudio((s) => s.loaded);
  const touch = useStudio((s) => s.touch);
  useStudio((s) => s.revision);
  if (!loaded) return null;
  const root = loaded.scene;
  const deg = (r: number) => Math.round((r * 180) / Math.PI);

  return (
    <Section
      title="Transformación"
      right={
        <button
          className="text-[10px] text-zinc-500 hover:text-zinc-200"
          onClick={() => {
            root.rotation.set(0, 0, 0);
            root.scale.set(1, 1, 1);
            root.position.set(0, 0, 0);
            touch();
          }}
        >
          Restablecer
        </button>
      }
    >
      {(['x', 'y', 'z'] as const).map((axis) => (
        <Field key={axis} label={`Rotación ${axis.toUpperCase()} · ${deg(root.rotation[axis])}°`}>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={deg(root.rotation[axis])}
            onChange={(e) => {
              root.rotation[axis] = (+e.target.value * Math.PI) / 180;
              touch();
            }}
            className="w-full"
          />
        </Field>
      ))}
      <Field label={`Escala uniforme · ${root.scale.x.toFixed(3)}`}>
        <input
          type="number"
          step={0.01}
          min={0.0001}
          className={inputClass}
          value={+root.scale.x.toFixed(4)}
          onChange={(e) => {
            const v = Math.max(0.0001, +e.target.value || 1);
            root.scale.setScalar(v);
            touch();
          }}
        />
      </Field>
      <p className="text-[10px] leading-relaxed text-zinc-500">Los cambios se aplican al nodo raíz y se incluyen al exportar.</p>
    </Section>
  );
}

function MetaEditor() {
  const asset = useStudio((s) => s.assets.find((a) => a.id === s.selectedId));
  const updateMeta = useStudio((s) => s.updateMeta);
  const removeAsset = useStudio((s) => s.removeAsset);
  const [form, setForm] = useState({ name: '', project: '', tags: '', license: '' });

  useEffect(() => {
    if (asset) setForm({ name: asset.name, project: asset.project, tags: asset.tags.join(', '), license: asset.license });
  }, [asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!asset) return null;
  const commit = () =>
    void updateMeta(asset.id, {
      name: form.name.trim() || asset.name,
      project: form.project.trim(),
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      license: form.license.trim(),
    });

  return (
    <Section title="Activo">
      <Field label="Nombre">
        <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={commit} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Proyecto">
          <input className={inputClass} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} onBlur={commit} />
        </Field>
        <Field label="Categoría">
          <select className={inputClass} value={asset.category} onChange={(e) => void updateMeta(asset.id, { category: e.target.value as AssetCategory })}>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Etiquetas (separadas por comas)">
        <input className={inputClass} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} onBlur={commit} placeholder="negro, veleto, encaste…" />
      </Field>
      <Field label="Licencia">
        <input className={inputClass} value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} onBlur={commit} placeholder="CC-BY-4.0, propia…" />
      </Field>
      <Row label="Procedencia">
        {asset.provenance.source === 'import' ? 'Importado' : asset.provenance.source === 'export' ? 'Exportado' : 'Generado'}
        {asset.provenance.engine ? ` · ${asset.provenance.engine}` : ''}
      </Row>
      {asset.provenance.originalFileName && <Row label="Archivo">{asset.provenance.originalFileName}</Row>}
      <Row label="Versión">v{asset.version}</Row>
      <Row label="Tamaño">{formatBytes(asset.sizeBytes)}</Row>
      <div className="mt-2">
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (window.confirm(`¿Eliminar «${asset.name}» de la biblioteca local? No se puede deshacer.`)) void removeAsset(asset.id);
          }}
        >
          Eliminar de la biblioteca
        </Button>
      </div>
    </Section>
  );
}

function Stats() {
  const stats = useStudio((s) => s.loaded?.stats);
  if (!stats) return null;
  const b = stats.bounds;
  return (
    <Section title="Geometría">
      <Row label="Mallas">{formatNumber(stats.meshes)}</Row>
      <Row label="Vértices">{formatNumber(stats.vertices)}</Row>
      <Row label="Triángulos">{formatNumber(stats.triangles)}</Row>
      <Row label="Materiales">{stats.materials}</Row>
      <Row label="Texturas">{stats.textures}</Row>
      <Row label="Mallas con piel">{stats.skinnedMeshes}</Row>
      <Row label="Huesos">{stats.bones}</Row>
      <Row label="Animaciones">{stats.animations.length}</Row>
      <Row label="Dimensiones">
        {b.x.toFixed(2)} × {b.y.toFixed(2)} × {b.z.toFixed(2)}
      </Row>
    </Section>
  );
}

export function PropertiesPanel() {
  const loaded = useStudio((s) => s.loaded);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ViewOptions />
      {loaded ? (
        <>
          <MetaEditor />
          <Stats />
          <TransformEditor />
        </>
      ) : (
        <Empty>Selecciona un modelo de la biblioteca para ver sus propiedades.</Empty>
      )}
    </div>
  );
}
