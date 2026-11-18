/**
 * Inspección y edición básica de materiales PBR (Base Color, Roughness,
 * Metallic, Emissive) y listado de mapas de textura por canal.
 */
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useStudio } from '../store';
import { collectMaterials, materialTextures } from '../lib/modelLoader';
import { Empty, Field, Section } from '../components/ui';

const SLOT_LABELS: Record<string, string> = {
  map: 'Base Color',
  normalMap: 'Normal',
  roughnessMap: 'Roughness',
  metalnessMap: 'Metallic',
  aoMap: 'Ambient Occlusion',
  emissiveMap: 'Emissive',
  alphaMap: 'Alpha',
};

function texturePreview(tex: THREE.Texture): string | null {
  const img = tex.image as (CanvasImageSource & { width?: number; height?: number }) | undefined;
  if (!img || !img.width || !img.height) return null;
  try {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    c.getContext('2d')?.drawImage(img, 0, 0, 48, 48);
    return c.toDataURL();
  } catch {
    return null;
  }
}

export function MaterialsPanel() {
  const loaded = useStudio((s) => s.loaded);
  const touch = useStudio((s) => s.touch);
  useStudio((s) => s.revision);
  const [open, setOpen] = useState<string | null>(null);

  const materials = useMemo(() => (loaded ? collectMaterials(loaded.scene) : []), [loaded]);
  if (!loaded) return <Empty>Abre un modelo para inspeccionar sus materiales.</Empty>;
  if (!materials.length) return <Empty>Este modelo no tiene materiales.</Empty>;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {materials.map((m, i) => {
        const std = m as THREE.MeshStandardMaterial;
        const isPbr = std.isMeshStandardMaterial;
        const maps = materialTextures(m);
        const key = m.uuid;
        const expanded = open === key || materials.length === 1;
        return (
          <Section
            key={key}
            title={m.name || `Material ${i + 1}`}
            right={<span className="text-[10px] text-zinc-500">{m.type.replace('Mesh', '').replace('Material', '')}</span>}
          >
            <button className="mb-2 flex w-full items-center gap-2 text-left" onClick={() => setOpen(expanded ? null : key)}>
              {isPbr && <span className="h-5 w-5 rounded ring-1 ring-white/10" style={{ background: `#${std.color.getHexString()}` }} />}
              <span className="text-[11px] text-zinc-400">
                {maps.length} mapas · {expanded ? 'ocultar' : 'editar'}
              </span>
            </button>
            {expanded && (
              <>
                {isPbr && (
                  <>
                    <Field label="Base Color">
                      <input
                        type="color"
                        value={`#${std.color.getHexString()}`}
                        onChange={(e) => {
                          std.color.set(e.target.value);
                          touch();
                        }}
                      />
                    </Field>
                    <Field label={`Roughness · ${std.roughness.toFixed(2)}`}>
                      <input type="range" min={0} max={1} step={0.01} value={std.roughness} className="w-full" onChange={(e) => { std.roughness = +e.target.value; touch(); }} />
                    </Field>
                    <Field label={`Metallic · ${std.metalness.toFixed(2)}`}>
                      <input type="range" min={0} max={1} step={0.01} value={std.metalness} className="w-full" onChange={(e) => { std.metalness = +e.target.value; touch(); }} />
                    </Field>
                    <Field label="Emissive">
                      <input type="color" value={`#${std.emissive.getHexString()}`} onChange={(e) => { std.emissive.set(e.target.value); touch(); }} />
                    </Field>
                    <Field label={`Opacidad · ${std.opacity.toFixed(2)}`}>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={std.opacity}
                        className="w-full"
                        onChange={(e) => {
                          std.opacity = +e.target.value;
                          std.transparent = std.opacity < 1;
                          std.needsUpdate = true;
                          touch();
                        }}
                      />
                    </Field>
                  </>
                )}
                <div className="mt-1 space-y-1">
                  {maps.length === 0 && <p className="text-[11px] text-zinc-500">Sin texturas.</p>}
                  {maps.map(({ slot, texture }) => {
                    const preview = texturePreview(texture);
                    const img = texture.image as { width?: number; height?: number } | undefined;
                    return (
                      <div key={slot} className="flex items-center gap-2 rounded bg-white/[0.03] p-1">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-black">{preview && <img src={preview} alt="" className="h-full w-full" />}</div>
                        <div className="min-w-0 text-[11px]">
                          <div className="text-zinc-200">{SLOT_LABELS[slot] ?? slot}</div>
                          <div className="mono text-[10px] text-zinc-500">{img?.width && img?.height ? `${img.width} × ${img.height}` : '—'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Section>
        );
      })}
    </div>
  );
}
