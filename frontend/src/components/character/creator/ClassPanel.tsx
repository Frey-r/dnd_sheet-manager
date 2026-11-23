/* Right column of Origen (WoW layout): class tiles with the pixel emblem of the class prop in
   the class colour, the book select when a class has several entries, and the class card.
   Sidekick classes are companion NPC rules (D-0040): players never see them; the NPC creator
   lists them in a "Compañeros" group, followed by "Sin clase". */
import { useId, useMemo, useRef, type CSSProperties } from 'react';
import { UserRound } from 'lucide-react';
import type { SRDClass } from '../../../types/srd';
import { auraForClass, splitSource } from '../../../lib/avatar';
import { LoadingState } from '../../ui/Feedback';
import { BookSelect, ClassDetail } from './CatalogDetails';
import { ClassEmblem } from './ClassEmblem';
import { groupClasses, isSidekickClass, preferredClass, type ClassGroup } from './catalog';
import { useRevealPressed } from './useRevealPressed';

/** NPC creator mode: the "Compañeros" group and the "Sin clase" choice (no aura, no prop). */
export interface NPCClassOptions {
  noClass: boolean;
  onNoClass: () => void;
}

export function ClassPanel({ classes, loading, klass, onChoose, npc }: {
  classes: SRDClass[];
  loading: boolean;
  klass: SRDClass | null;
  onChoose: (c: SRDClass) => void;
  npc?: NPCClassOptions;
}) {
  const headingId = useId();
  const companionsId = useId();
  const [groups, sidekicks] = useMemo(() => {
    const all = groupClasses(classes);
    return [all.filter((g) => !isSidekickClass(g.base)), all.filter((g) => isSidekickClass(g.base))];
  }, [classes]);
  const companions = npc ? sidekicks : [];
  const selectedBase = klass ? splitSource(klass.name).base.toLowerCase() : '';
  const current = [...groups, ...companions].find((g) => g.base.toLowerCase() === selectedBase);
  const grid = useRef<HTMLDivElement>(null);
  // The class card grows under the grid when a class is chosen: keep the chosen tile in view.
  useRevealPressed(grid, selectedBase);

  const tile = (g: ClassGroup) => {
    const entry = preferredClass(g);
    const active = g.base.toLowerCase() === selectedBase;
    return (
      <button
        key={g.base}
        type="button"
        aria-pressed={active}
        onClick={() => onChoose(active && klass ? klass : entry)}
        className="cc-tile cc-class-tile"
        style={{ '--cls': auraForClass(entry.name) ?? 'var(--line-strong)' } as CSSProperties}
      >
        <span className="cc-class-tile__emblem"><ClassEmblem klass={entry.name} scale={3} /></span>
        <span className="cc-tile__name">{g.base}</span>
      </button>
    );
  };

  return (
    <section aria-labelledby={headingId} className="cc-panel cc-classes">
      <header className="cc-panel__head">
        <h2 id={headingId} className="cc-panel__title">Clases</h2>
        <span className="cc-panel__meta">{groups.length + companions.length || ''}</span>
      </header>

      <div ref={grid} className="cc-class-grid">
        {loading && <LoadingState />}
        {groups.map(tile)}
        {companions.length > 0 && (
          <div role="group" aria-labelledby={companionsId} className="cc-class-group">
            <h3 id={companionsId} className="cc-class-group__title">Compañeros</h3>
            {companions.map(tile)}
          </div>
        )}
        {npc && (
          <button type="button" aria-pressed={npc.noClass} onClick={npc.onNoClass} className="cc-tile cc-class-tile cc-class-tile--none">
            <span className="cc-class-tile__emblem"><UserRound size={26} strokeWidth={1.75} aria-hidden /></span>
            <span className="cc-tile__name">Sin clase</span>
          </button>
        )}
        {!loading && groups.length === 0 && <p className="cc-empty">Sin clases en el catálogo.</p>}
      </div>

      <ClassDetail
        klass={klass}
        empty={npc?.noClass ? 'Sin clase: sin aura ni objeto en la mano. PG sugeridos: 4 + mod. CON.' : undefined}
        picker={current && current.entries.length > 1 ? <BookSelect base={current.base} entries={current.entries} value={klass} onChange={onChoose} /> : null}
      />
    </section>
  );
}
