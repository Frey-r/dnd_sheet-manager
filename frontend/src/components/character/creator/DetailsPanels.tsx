/* Detalles (last creator step): the name under the stage, background and alignment on the left,
   the level 1 preview on the right. */
import { useId } from 'react';
import { signed } from '../../../lib/abilities';

const ALIGNMENTS = [
  ['Legal bueno', 'Neutral bueno', 'Caótico bueno'],
  ['Legal neutral', 'Neutral', 'Caótico neutral'],
  ['Legal malvado', 'Neutral malvado', 'Caótico malvado'],
] as const;

/** Centred under the stage; focused when the step opens, as WoW does with the name box. */
export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="cc-name">
      <label htmlFor={id} className="cc-name__label">Nombre</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        maxLength={100}
        autoComplete="off"
        placeholder="¿Cómo se llama?"
        autoFocus
        className="cc-name__input"
      />
    </div>
  );
}

export function BackgroundPanel({ background, alignment, onBackground, onAlignment }: {
  background: string;
  alignment: string;
  onBackground: (v: string) => void;
  onAlignment: (v: string) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="cc-panel">
      <header className="cc-panel__head"><h2 id={headingId} className="cc-panel__title">Historia</h2></header>
      <label className="cc-field">
        <span>Trasfondo</span>
        <input value={background} onChange={(e) => onBackground(e.target.value)} maxLength={100} placeholder="Sabio, Soldado, Acólito…" />
      </label>
      <div role="group" aria-label="Alineamiento" className="cc-field">
        <span aria-hidden>Alineamiento</span>
        <div className="cc-align">
          {ALIGNMENTS.flat().map((a) => (
            <button key={a} type="button" aria-pressed={alignment === a} onClick={() => onAlignment(alignment === a ? '' : a)} className="cc-align__cell">{a}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SummaryPanel({ preview, caption }: {
  preview: { hp: number; ac: number; speed: number; init: number } | null;
  caption: string;
}) {
  const headingId = useId();
  const stats: [string, string][] = preview
    ? [['PG', String(preview.hp)], ['CA', String(preview.ac)], ['Velocidad', `${preview.speed} pies`], ['Iniciativa', signed(preview.init)]]
    : [];
  return (
    <section aria-labelledby={headingId} className="cc-panel">
      <header className="cc-panel__head">
        <h2 id={headingId} className="cc-panel__title">Nivel 1</h2>
        <span className="cc-panel__meta">{caption}</span>
      </header>
      {preview ? (
        <dl className="cc-stats">
          {stats.map(([k, v]) => <div key={k} className="cc-stat"><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      ) : <p className="cc-empty">Completa los pasos anteriores para ver PG y CA.</p>}
      <p className="cc-note">PG, CA y velocidad se calculan al crear según las reglas de nivel 1.</p>
    </section>
  );
}
