/* NPC creator panels (character-appearance.md § NPC creator): Estadísticas, typed by the GM (an empty
   field shows its suggestion and keeps it), and Identidad (trade or role, relationship, notes). */
import { useId } from 'react';
import { ABILITIES, abilityMod, signed } from '../../../lib/abilities';
import { COMBAT_STATS, RELATIONS, statValues, type StatKey, type Stats } from './rules';

function StatField({ id, label, value, suggestion, min, max, note, onChange }: {
  id: string;
  label: string;
  value: string;
  suggestion: number;
  min: number;
  max: number;
  note: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="cc-statfield">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        placeholder={String(suggestion)}
        aria-describedby={`${id}-note`}
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={`${id}-note`} className="cc-statfield__note">{note}</span>
    </div>
  );
}

export function StatsPanel({ draft, suggested, hints, onChange }: {
  draft: Stats<string>;
  suggested: Stats<number>;
  /** Where the HP and speed suggestions come from ("d8 + mod. CON", "Mediano"). */
  hints: { hp: string; speed: string };
  onChange: (key: StatKey, value: string) => void;
}) {
  const id = useId();
  const values = statValues(draft, suggested);
  const notes: Partial<Stats<string>> = { ac: 'Base sin armadura: 10', ...hints };
  return (
    <section aria-labelledby={`${id}-title`} className="cc-panel cc-abilities">
      <header className="cc-panel__head">
        <h2 id={`${id}-title`} className="cc-panel__title">Estadísticas</h2>
        <span className="cc-panel__meta">Vacío = sugerido</span>
      </header>
      <div className="cc-scroll cc-npcstats">
        <div className="cc-npcstats__grid">
          {ABILITIES.map(([key, , label]) => (
            <StatField key={key} id={`${id}-${key}`} label={label} value={draft[key]} suggestion={suggested[key]} min={1} max={30} note={`Mod. ${signed(abilityMod(values[key]))}`} onChange={(v) => onChange(key, v)} />
          ))}
        </div>
        <div className="cc-npcstats__grid">
          {COMBAT_STATS.map(([key, label, min, max]) => (
            <StatField key={key} id={`${id}-${key}`} label={label} value={draft[key]} suggestion={suggested[key]} min={min} max={max} note={notes[key] ?? ''} onChange={(v) => onChange(key, v)} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function IdentityPanel({ role, status, description, onRole, onStatus, onDescription }: {
  role: string;
  status: string;
  description: string;
  onRole: (v: string) => void;
  onStatus: (v: string) => void;
  onDescription: (v: string) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="cc-panel cc-identity">
      <header className="cc-panel__head"><h2 id={headingId} className="cc-panel__title">Identidad</h2></header>
      <label className="cc-field">
        <span>Oficio o rol</span>
        <input value={role} onChange={(e) => onRole(e.target.value)} maxLength={100} placeholder="Tabernera, capitán de la guardia…" />
      </label>
      <div role="group" aria-label="Relación" className="cc-field">
        <span aria-hidden>Relación</span>
        <div className="cc-relation">
          {RELATIONS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={status === value} data-relation={value} onClick={() => onStatus(value)} className="cc-align__cell">{label}</button>
          ))}
        </div>
      </div>
      <label className="cc-field cc-identity__notes">
        <span>Descripción y notas</span>
        <textarea value={description} onChange={(e) => onDescription(e.target.value)} rows={7} placeholder="Aspecto, motivaciones, secretos…" />
      </label>
    </section>
  );
}
