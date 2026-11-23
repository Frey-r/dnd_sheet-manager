/* Left column of Origen (WoW layout): body type on top, then the race portrait grid
   (common races first, search, one tile per base race), the book select and the race card. */
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Layers, Search } from 'lucide-react';
import type { SRDRace } from '../../../types/srd';
import { BODIES, splitSource } from '../../../lib/avatar';
import { groupRaces, preferredEntry } from '../../../lib/avatar/raceGroups';
import { PixelAvatar } from '../../avatar/PixelAvatar';
import { LoadingState } from '../../ui/Feedback';
import { BookSelect, RaceDetail } from './CatalogDetails';
import { raceThumbLook } from './raceThumbs';
import { useRevealPressed } from './useRevealPressed';

const supportsObserver = typeof IntersectionObserver !== 'undefined';

/** One IntersectionObserver for the whole grid: a tile draws its portrait only while near view. */
function createTileWatcher() {
  let observer: IntersectionObserver | null = null;
  const listeners = new Map<Element, (visible: boolean) => void>();
  return {
    /** `el` is observed against the closest `[data-tile-root]` (the scrolling grid). */
    watch(el: Element, onChange: (visible: boolean) => void) {
      if (!supportsObserver) return () => {};
      observer ??= new IntersectionObserver(
        (entries) => { for (const e of entries) listeners.get(e.target)?.(e.isIntersecting); },
        { root: el.closest('[data-tile-root]'), rootMargin: '160px 0px' },
      );
      listeners.set(el, onChange);
      observer.observe(el);
      return () => { listeners.delete(el); observer?.unobserve(el); };
    },
    disconnect() { observer?.disconnect(); observer = null; listeners.clear(); },
  };
}
type TileWatcher = ReturnType<typeof createTileWatcher>;

const RaceTile = memo(function RaceTile({ base, entry, versions, body, active, watcher, onPick }: {
  base: string;
  entry: SRDRace;
  versions: number;
  body: 0 | 1;
  active: boolean;
  watcher: TileWatcher;
  onPick: (base: string) => void;
}) {
  const portrait = useRef<HTMLSpanElement>(null);
  // Without IntersectionObserver (tests, old browsers) every portrait is drawn.
  const [near, setNear] = useState(!supportsObserver);
  useEffect(() => (portrait.current ? watcher.watch(portrait.current, setNear) : undefined), [watcher]);
  return (
    <button type="button" aria-pressed={active} onClick={() => onPick(base)} className="cc-tile cc-race-tile">
      <span ref={portrait} className="cc-race-tile__portrait">
        {near && <PixelAvatar appearance={raceThumbLook(base, entry, body)} race={entry.name} raceSize={entry.size} crop="bust" scale={3} decorative />}
      </span>
      <span className="cc-tile__name">{base}</span>
      {versions > 1 && <span className="cc-tile__badge" aria-hidden title={`${versions} versiones`}><Layers size={10} />{versions}</span>}
    </button>
  );
});

/** Stand-in for the body previews before a race is chosen. */
const NO_RACE = { id: 0, name: 'Human' };

export function RacePanel({ races, loading, race, body, onChoose, onBody }: {
  races: SRDRace[];
  loading: boolean;
  race: SRDRace | null;
  body: 0 | 1;
  onChoose: (r: SRDRace) => void;
  onBody: (body: 0 | 1) => void;
}) {
  const headingId = useId();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupRaces(races), [races]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groups.filter((g) => g.base.toLowerCase().includes(q)) : groups;
  }, [groups, query]);
  const selectedBase = race ? splitSource(race.name).base.toLowerCase() : '';
  const current = groups.find((g) => g.base.toLowerCase() === selectedBase);
  const grid = useRef<HTMLDivElement>(null);
  const [watcher] = useState(createTileWatcher);
  useEffect(() => () => watcher.disconnect(), [watcher]);
  // The race card grows under the grid when a race is chosen: keep the chosen tile in view.
  useRevealPressed(grid, selectedBase);
  // The body previews show the chosen race's portrait look in each body: they depend on the race
  // only, so customizing (hair, colours…) never redraws them while this panel is hidden (RG-1).
  const bodyLooks = useMemo(() => {
    const entry = race ?? NO_RACE;
    const base = splitSource(entry.name).base;
    return [raceThumbLook(base, entry, 0), raceThumbLook(base, entry, 1)];
  }, [race]);
  // Re-picking the chosen race keeps its book; tiles are memoised, so the callback reads fresh props.
  const pick = useMemo(() => {
    const byBase = new Map(groups.map((g) => [g.base, g]));
    return (base: string) => {
      const g = byBase.get(base);
      if (!g) return;
      onChoose(race && splitSource(race.name).base === base ? race : preferredEntry(g));
    };
  }, [groups, race, onChoose]);

  return (
    <section aria-labelledby={headingId} className="cc-panel cc-races">
      <header className="cc-panel__head">
        <h2 id={headingId} className="cc-panel__title">Razas</h2>
        <span className="cc-panel__meta">{groups.length || ''}</span>
      </header>

      <div role="group" aria-label="Tipo de cuerpo" className="cc-body-toggle">
        {BODIES.map((label, i) => (
          <button key={label} type="button" aria-pressed={body === i} onClick={() => onBody(i === 1 ? 1 : 0)} className="cc-body-btn">
            <PixelAvatar appearance={bodyLooks[i]} race={race?.name ?? 'Human'} raceSize={race?.size} scale={1} decorative />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <label className="cc-search">
        <Search size={15} aria-hidden />
        <input type="search" aria-label="Buscar raza" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar raza…" />
      </label>

      <div ref={grid} data-tile-root className="cc-scroll cc-race-grid">
        {loading && <LoadingState />}
        {visible.map((g) => (
          <RaceTile key={g.base} base={g.base} entry={preferredEntry(g)} versions={g.entries.length} body={body} active={g.base.toLowerCase() === selectedBase} watcher={watcher} onPick={pick} />
        ))}
        {!loading && visible.length === 0 && <p className="cc-empty">Sin resultados. ¿Está importado el catálogo?</p>}
      </div>

      <RaceDetail
        race={race}
        picker={current && current.entries.length > 1 ? <BookSelect base={current.base} entries={current.entries} value={race} onChange={onChoose} /> : null}
      />
    </section>
  );
}
