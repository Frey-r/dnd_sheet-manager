/* Class picker: the class gives the avatar an aura of its colour (no class clothing). */
import { useMemo, useState } from 'react';
import type { SRDClass } from '../../../types/srd';
import { auraForClass, splitSource } from '../../../lib/avatar';
import { LoadingState } from '../../ui/Feedback';

export function ClassStep({ classes, loading, klass, onChoose }: {
  classes: SRDClass[];
  loading: boolean;
  klass: SRDClass | null;
  onChoose: (c: SRDClass) => void;
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes.filter((c) => !q || c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes, query]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="mc-eyebrow">Clase</h2>
        <p className="mt-1 text-[12.5px] text-muted">Cada clase tiene un color: tu personaje lo lleva como aura.</p>
      </div>
      {classes.length > 8 && <input aria-label="Buscar clase" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar clase…" className="h-9 px-3" />}
      {loading && <LoadingState />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((c) => {
          const color = auraForClass(c.name) ?? 'transparent';
          const active = klass?.id === c.id;
          const { base, source } = splitSource(c.name);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChoose(c)}
              aria-pressed={active}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-card-2'}`}
            >
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} aria-hidden />
              <span className="min-w-0">
                <span className={`block truncate text-[13.5px] font-semibold ${active ? 'text-accent' : ''}`}>{base}</span>
                <span className="block truncate text-[11px] text-muted">{c.hit_die ? `d${c.hit_die}` : ''}{source ? ` · ${source}` : ''}</span>
              </span>
            </button>
          );
        })}
      </div>
      {!loading && list.length === 0 && <p className="p-4 text-muted">Sin resultados.</p>}
    </div>
  );
}
