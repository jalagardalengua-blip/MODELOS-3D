/**
 * Generador de modelos: imagen → 3D o texto → imagen de referencia → 3D.
 * Envía el trabajo al motor local, que lo ejecuta en segundo plano; al terminar,
 * el GLB se valida y entra solo en la biblioteca (ver useJobWatcher).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ASSET_CATEGORIES, type AssetCategory, type GenerationQuality } from '@alagarda/shared-types';
import { isActive, markLaunched, useEngine } from '../settings/useEngineStatus';
import { useStudio } from '../store';
import { submitGeneration } from '../lib/engineApi';
import { Button, Field, inputClass, StatusDot } from '../components/ui';
import { formatBytes } from '../lib/format';

type Mode = 'imagen' | 'texto';

interface Template {
  id: string;
  label: string;
  category: AssetCategory;
  prompt: string;
}

/** Descripciones en inglés: el generador de imágenes de referencia las interpreta con más precisión. */
const TEMPLATES: Template[] = [
  {
    id: 'toro',
    label: 'Toro bravo',
    category: 'toro',
    prompt:
      'Spanish fighting bull (toro bravo de lidia), jet black coat, muscular powerful body, large neck hump (morrillo), forward-curving sharp horns, standing in a calm neutral pose, anatomically accurate',
  },
  {
    id: 'torero',
    label: 'Torero',
    category: 'torero',
    prompt:
      'Spanish bullfighter (matador) in a traditional traje de luces, gold embroidered jacket and tight trousers, black montera hat, pink stockings, black flat shoes, standing in a neutral A-pose, realistic human proportions',
  },
  {
    id: 'caballo',
    label: 'Caballo',
    category: 'caballo',
    prompt:
      'Andalusian horse for rejoneo, chestnut coat, braided mane, Spanish leather saddle and bridle with reins, standing square in a neutral pose, anatomically accurate',
  },
  {
    id: 'capote',
    label: 'Capote',
    category: 'capote-muleta',
    prompt: 'Bullfighting capote cape, magenta silk outside and yellow lining, heavy fabric hanging with natural folds, displayed on a stand',
  },
  {
    id: 'muleta',
    label: 'Muleta',
    category: 'capote-muleta',
    prompt: 'Red bullfighting muleta cloth draped over its wooden stick, natural fabric folds',
  },
  {
    id: 'plaza',
    label: 'Plaza',
    category: 'plaza',
    prompt:
      'Miniature model of a traditional Spanish bullring, circular sand arena (albero), red wooden barrier, stone tiered stands, white walls with arches, aerial three-quarter view',
  },
];

const QUALITIES: { id: GenerationQuality; label: string; hint: string }[] = [
  { id: 'borrador', label: 'Borrador', hint: '512³ · texturas 1K · ~150 mil caras. El más rápido; ideal para probar.' },
  { id: 'alta', label: 'Alta', hint: '1024³ · texturas 2K · ~400 mil caras. Recomendado.' },
  { id: 'maxima', label: 'Máxima', hint: '1536³ · texturas 4K · ~1 M caras. Consume más cupo de GPU gratuito.' },
];

const CONSENT_KEY = 'alagarda.consentExternal';

function readConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function GeneratorPanel() {
  const providers = useEngine((s) => s.providers);
  const engineState = useEngine((s) => s.state);
  const jobs = useEngine((s) => s.jobs);
  const upsertJob = useEngine((s) => s.upsertJob);
  const apiUrl = useStudio((s) => s.apiUrl);
  const log = useStudio((s) => s.log);
  const setBottomTab = useStudio((s) => s.setBottomTab);
  const setRightTab = useStudio((s) => s.setRightTab);

  const [mode, setMode] = useState<Mode>('imagen');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('otro');
  const [quality, setQuality] = useState<GenerationQuality>('alta');
  const [randomSeed, setRandomSeed] = useState(true);
  const [seed, setSeed] = useState(1234);
  const [providerId, setProviderId] = useState('');
  const [consent, setConsent] = useState(readConsent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const capability = mode === 'imagen' ? 'image-to-3d' : 'text-to-3d';
  const compatible = useMemo(() => providers.filter((p) => p.capabilities.includes(capability)), [providers, capability]);
  const provider = compatible.find((p) => p.id === providerId) ?? compatible.find((p) => p.available) ?? compatible[0];

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const activeJobs = jobs.filter(isActive);

  const pickImage = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError('La imagen debe ser PNG, JPEG o WebP.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('La imagen supera los 20 MB.');
      return;
    }
    setImage(file);
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
  };

  const applyTemplate = (t: Template) => {
    setPrompt(t.prompt);
    setCategory(t.category);
    setName(t.label);
  };

  const inputReady = mode === 'imagen' ? !!image : prompt.trim().length >= 3;
  const needsConsent = !!provider?.sendsDataExternally;
  const canSubmit = engineState === 'online' && !!provider?.available && inputReady && (!needsConsent || consent) && !submitting;

  const blocker =
    engineState !== 'online'
      ? 'Arranca el motor local (pnpm api) para generar.'
      : !provider
        ? 'No hay ningún proveedor compatible.'
        : !provider.available
          ? (provider.reason ?? 'Proveedor no disponible.')
          : !inputReady
            ? mode === 'imagen'
              ? 'Elige una imagen de referencia.'
              : 'Escribe una descripción.'
            : needsConsent && !consent
              ? 'Confirma el envío a Hugging Face.'
              : null;

  const submit = async () => {
    if (!provider) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await submitGeneration(apiUrl, {
        provider: provider.id,
        prompt: mode === 'texto' ? prompt : undefined,
        image: mode === 'imagen' ? image : null,
        seed: randomSeed ? null : seed,
        quality,
        name: name.trim() || (mode === 'texto' ? prompt.slice(0, 40) : 'Modelo generado'),
        category,
      });
      markLaunched(job.id);
      upsertJob(job);
      setBottomTab('trabajos');
      log('info', `Generación «${job.name}» enviada a ${provider.name} (calidad ${quality}).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      log('error', `No se pudo iniciar la generación: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-[var(--bg)] p-1">
        {(['imagen', 'texto'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`h-7 rounded text-[11px] font-semibold ${mode === m ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {m === 'imagen' ? 'Desde imagen' : 'Desde texto'}
          </button>
        ))}
      </div>

      {mode === 'imagen' ? (
        <Field label="Imagen de referencia">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              pickImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickImage(e.dataTransfer.files[0]);
            }}
            className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-white/15 bg-[var(--bg)] hover:border-white/30"
          >
            {preview ? (
              <img src={preview} alt="Referencia" className="h-full w-full object-contain" />
            ) : (
              <span className="px-4 text-center text-[11px] leading-relaxed text-zinc-500">
                Pulsa o arrastra una imagen
                <br />
                PNG, JPEG o WebP · máx. 20 MB
              </span>
            )}
          </button>
          {image && (
            <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
              <span className="truncate">
                {image.name} · {formatBytes(image.size)}
              </span>
              <button className="text-zinc-400 hover:text-white" onClick={() => setImage(null)}>
                Quitar
              </button>
            </div>
          )}
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
            Mejores resultados: un único objeto completo, centrado, con fondo liso y buena luz. El fondo se elimina automáticamente.
          </p>
        </Field>
      ) : (
        <>
          <Field label="Plantillas">
            <div className="flex flex-wrap gap-1">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => applyTemplate(t)} className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5">
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Descripción">
            <textarea
              className={`${inputClass} h-32 resize-none py-1.5 leading-relaxed`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Forma, proporciones, materiales, colores y postura del modelo…"
            />
          </Field>
          <p className="-mt-1 mb-2 text-[10px] leading-relaxed text-zinc-500">
            Primero se crea una imagen de referencia (FLUX.1 schnell) y después el modelo 3D. Las descripciones en inglés dan resultados más precisos.
          </p>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Nombre">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Toro 01" />
        </Field>
        <Field label="Categoría">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as AssetCategory)}>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Calidad">
        <div className="grid grid-cols-3 gap-1">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuality(q.id)}
              className={`h-7 rounded text-[11px] ${quality === q.id ? 'bg-[var(--accent)]/20 text-white ring-1 ring-[var(--accent)]' : 'bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
            >
              {q.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">{QUALITIES.find((q) => q.id === quality)?.hint}</p>
      </Field>

      <Field label="Semilla">
        <div className="flex items-center gap-2">
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-400">
            <input type="checkbox" checked={randomSeed} onChange={(e) => setRandomSeed(e.target.checked)} />
            Aleatoria
          </label>
          <input
            type="number"
            className={inputClass}
            disabled={randomSeed}
            value={seed}
            min={0}
            onChange={(e) => setSeed(Math.max(0, Math.floor(+e.target.value || 0)))}
          />
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">Con la misma imagen y semilla se obtiene el mismo resultado; cambia la semilla para crear variantes.</p>
      </Field>

      <Field label="Motor">
        <select className={inputClass} value={provider?.id ?? ''} onChange={(e) => setProviderId(e.target.value)}>
          {compatible.length === 0 && <option value="">—</option>}
          {compatible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.available ? '' : ' · no disponible'}
            </option>
          ))}
        </select>
      </Field>

      {needsConsent && (
        <label className="mb-3 flex items-start gap-2 rounded-md bg-white/[0.03] p-2 text-[11px] leading-relaxed text-zinc-400">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              try {
                localStorage.setItem(CONSENT_KEY, e.target.checked ? '1' : '0');
              } catch {
                /* sin almacenamiento */
              }
            }}
          />
          <span>
            Entiendo que la {mode === 'imagen' ? 'imagen' : 'descripción'} se envía a Hugging Face para procesarla en sus GPU gratuitas. No envíes material confidencial.
          </span>
        </label>
      )}

      {(error || blocker) && (
        <div className={`mb-2 flex items-start gap-2 text-[11px] leading-snug ${error ? 'text-red-300' : 'text-zinc-400'}`}>
          <StatusDot state={error ? 'error' : 'off'} />
          <span>{error ?? blocker}</span>
        </div>
      )}

      <Button variant="primary" className="w-full" disabled={!canSubmit} onClick={() => void submit()}>
        {submitting ? 'Enviando…' : activeJobs.length ? `Añadir a la cola (${activeJobs.length} en curso)` : 'Generar modelo 3D'}
      </Button>

      <button
        className="mt-2 w-full text-center text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        onClick={() => setRightTab('motor')}
      >
        {providers.filter((p) => p.available).length} de {providers.length || '—'} proveedores disponibles · ver motor
      </button>
    </div>
  );
}
