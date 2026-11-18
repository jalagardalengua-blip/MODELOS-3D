import { useEffect, useMemo, useState } from 'react';
import { ASSET_CATEGORIES } from '@alagarda/shared-types';
import { useStudio } from '../store';
import { Empty, inputClass } from '../components/ui';
import { formatBytes, formatDate, formatNumber } from '../lib/format';
import { requestPersistentStorage, storageEstimate } from '../lib/db';

export function LibraryPanel() {
  const assets = useStudio((s) => s.assets);
  const selectedId = useStudio((s) => s.selectedId);
  const selectAsset = useStudio((s) => s.selectAsset);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('todas');
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void storageEstimate().then(setUsage);
  }, [assets.length]);
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (category !== 'todas' && a.category !== category) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.project.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [assets, query, category]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-[var(--line)] p-3">
        <input className={inputClass} placeholder="Buscar por nombre, proyecto o etiqueta…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {assets.length === 0 ? (
          <Empty>
            La biblioteca está vacía.
            <br />
            Importa un archivo .glb para empezar.
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty>No hay modelos que coincidan con la búsqueda.</Empty>
        ) : (
          <ul className="space-y-1">
            {filtered.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => void selectAsset(a.id)}
                  className={`flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition ${
                    selectedId === a.id ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/60' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-[var(--bg)] ring-1 ring-white/5">
                    {a.thumbnail ? (
                      <img src={a.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[9px] text-zinc-600">GLB</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-zinc-100">{a.name}</div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {ASSET_CATEGORIES.find((c) => c.id === a.category)?.label} · {formatBytes(a.sizeBytes)}
                      {a.stats && ` · ${formatNumber(a.stats.triangles)} tri`}
                    </div>
                    <div className="truncate text-[10px] text-zinc-600">
                      {a.provenance.source === 'export' ? `v${a.version} · ` : ''}
                      {formatDate(a.updatedAt)}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--line)] px-3 py-2 text-[10px] text-zinc-500">
        {assets.length} activos
        {usage && usage.quota > 0 && ` · ${formatBytes(usage.usage)} usados de ${formatBytes(usage.quota)} disponibles`}
      </div>
    </div>
  );
}
