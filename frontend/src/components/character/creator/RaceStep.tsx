/* Race picker grouped by base race (every catalogue source), with pixel thumbnails. */
import { useMemo, useState } from 'react';
import type { SRDRace } from '../../../types/srd';
import { splitSource } from '../../../lib/avatar';
import { groupRaces, preferredEntry } from '../../../lib/avatar/raceGroups';
import { PixelAvatar } from '../../avatar/PixelAvatar';
import { LoadingState } from '../../ui/Feedback';

export function RaceStep({ races, loading, race, onChoose }: {
  races: SRDRace[];
  loading: boolean;
  race: SRDRace | null;
  onChoose: (r: SRDRace) => void;
}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupRaces(races), [races]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groups.filter((g) => g.base.toLowerCase().includes(q)) : groups;
  }, [groups, query]);
  const selectedBase = race ? splitSource(race.name).base.toLowerCase() : '';
  const current = groups.find((g) => g.base.toLowerCase() === selectedBase);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="mc-eyebrow">Raza o especie</h2>
        <span className="text-[12px] text-muted">{groups.length} razas · {races.length} entradas</span>
      </div>
      <input aria-label="Buscar raza" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar raza…" className="h-9 px-3" />

      {current && current.entries.length > 1 && (
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Versión o libro de {current.base}
          <select value={race?.id ?? ''} onChange={(e) => { const r = current.entries.find((x) => x.id === Number(e.target.value)); if (r) onChoose(r); }} className="h-9 px-2">
            {current.entries.map((e) => <option key={e.id} value={e.id}>{splitSource(e.name).source || e.source || 'Catálogo'}{e.is_srd ? ' · SRD' : ''}</option>)}
          </select>
        </label>
      )}

      {loading && <LoadingState />}
      <div className="grid max-h-[28rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 xl:grid-cols-5">
        {visible.map((g) => {
          const entry = preferredEntry(g);
          const active = g.base.toLowerCase() === selectedBase;
          return (
            <button
              key={g.base}
              type="button"
              onClick={() => onChoose(active && race ? race : entry)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors ${active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-card-2'}`}
            >
              <PixelAvatar race={entry.name} raceSize={entry.size} aura={false} crop="bust" scale={2} decorative />
              <span className={`line-clamp-2 text-[11.5px] font-medium leading-tight ${active ? 'text-accent' : ''}`}>{g.base}</span>
              {g.entries.length > 1 && <span className="text-[10px] text-muted">{g.entries.length} versiones</span>}
            </button>
          );
        })}
      </div>
      {!loading && visible.length === 0 && <p className="p-4 text-muted">Sin resultados. ¿Está importado el catálogo?</p>}
    </div>
  );
}
