/**
 * Generador de modelos (Fase 2). La interfaz ya existe, pero la generación
 * solo se activa cuando el motor local informa de un proveedor disponible.
 * No se simula ninguna generación.
 */
import { useState } from 'react';
import { useEngine } from '../settings/useEngineStatus';
import { useStudio } from '../store';
import { Button, Field, inputClass, StatusDot } from '../components/ui';

const PRESETS = [
  { id: 'toro', label: 'Toro bravo', prompt: 'Toro bravo de lidia, capa negra, cornamenta veleta, morrillo desarrollado, musculatura definida, anatomía realista' },
  { id: 'torero', label: 'Torero', prompt: 'Torero con traje de luces bordado en oro, montera, medias rosas y zapatillas, postura neutra en A' },
  { id: 'caballo', label: 'Caballo', prompt: 'Caballo de rejoneo, pelaje castaño, crin trenzada, silla vaquera y riendas' },
  { id: 'capote', label: 'Capote', prompt: 'Capote de brega, tela fucsia por fuera y amarilla por dentro, pliegues naturales' },
  { id: 'plaza', label: 'Plaza', prompt: 'Plaza de toros circular, ruedo de albero, barrera roja, tendidos de piedra' },
];

export function GeneratorPanel() {
  const providers = useEngine((s) => s.providers);
  const state = useEngine((s) => s.state);
  const setRightTab = useStudio((s) => s.setRightTab);
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState('trellis');
  const available = providers.filter((p) => p.available);
  const selected = providers.find((p) => p.id === engine);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mb-3 rounded-md border border-[var(--accent-2)]/30 bg-[var(--accent-2)]/10 p-2.5 text-[11px] leading-relaxed text-amber-100/90">
        La generación por IA llega en la <b>Fase 2</b>. Este panel ya prepara la petición, pero solo se activará cuando el motor local
        tenga un proveedor disponible (TRELLIS en una GPU compatible).
      </div>

      <Field label="Plantilla">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setPrompt(p.prompt)} className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5">
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Descripción física">
        <textarea
          className={`${inputClass} h-28 resize-none py-1.5`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe forma, proporciones, materiales y estado del modelo…"
        />
      </Field>

      <Field label="Imagen de referencia">
        <input type="file" accept="image/*" disabled className={`${inputClass} pt-1 text-zinc-500`} />
      </Field>

      <Field label="Motor">
        <select className={inputClass} value={engine} onChange={(e) => setEngine(e.target.value)}>
          {(providers.length ? providers : [{ id: 'trellis', name: 'TRELLIS (local)' }]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="mb-3 flex items-start gap-2 text-[11px] text-zinc-400">
        <StatusDot state={selected?.available ? 'ok' : 'off'} />
        <span>
          {state !== 'online'
            ? 'Motor local desconectado.'
            : selected?.available
              ? 'Proveedor disponible.'
              : (selected?.reason ?? 'Proveedor no disponible.')}
        </span>
      </div>

      <Button variant="primary" className="w-full" disabled title="Disponible en la Fase 2">
        Generar modelo
      </Button>
      <button className="mt-2 w-full text-center text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline" onClick={() => setRightTab('motor')}>
        {available.length} de {providers.length || 3} proveedores disponibles · ver motor
      </button>
    </div>
  );
}
