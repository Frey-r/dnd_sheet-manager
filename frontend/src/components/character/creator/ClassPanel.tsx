/* Right column of Origen (WoW layout): class tiles with the pixel emblem of the class prop in
   the class colour, the book select when a class has several entries, and the class card. */
import { useId, useMemo, useRef, type CSSProperties } from 'react';
import type { SRDClass } from '../../../types/srd';
import { auraForClass, splitSource } from '../../../lib/avatar';
import { LoadingState } from '../../ui/Feedback';
import { BookSelect, ClassDetail } from './CatalogDetails';
import { ClassEmblem } from './ClassEmblem';
import { groupClasses, preferredClass } from './catalog';
import { useRevealPressed } from './useRevealPressed';

export function ClassPanel({ classes, loading, klass, onChoose }: {
  classes: SRDClass[];
  loading: boolean;
  klass: SRDClass | null;
  onChoose: (c: SRDClass) => void;
}) {
  const headingId = useId();
  const groups = useMemo(() => groupClasses(classes), [classes]);
  const selectedBase = klass ? splitSource(klass.name).base.toLowerCase() : '';
  const current = groups.find((g) => g.base.toLowerCase() === selectedBase);
  const grid = useRef<HTMLDivElement>(null);
  // The class card grows under the grid when a class is chosen: keep the chosen tile in view.
  useRevealPressed(grid, selectedBase);

  return (
    <section aria-labelledby={headingId} className="cc-panel cc-classes">
      <header className="cc-panel__head">
        <h2 id={headingId} className="cc-panel__title">Clases</h2>
        <span className="cc-panel__meta">{groups.length || ''}</span>
      </header>

      <div ref={grid} className="cc-class-grid">
        {loading && <LoadingState />}
        {groups.map((g) => {
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
        })}
        {!loading && groups.length === 0 && <p className="cc-empty">Sin clases en el catálogo.</p>}
      </div>

      <ClassDetail
        klass={klass}
        picker={current && current.entries.length > 1 ? <BookSelect base={current.base} entries={current.entries} value={klass} onChange={onChoose} /> : null}
      />
    </section>
  );
}
