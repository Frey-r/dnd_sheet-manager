/* Compact rules cards for the chosen race and class, under each Origen column: the key facts
   always visible, the rest in a collapsible section that stays mounted (readable without a drawer). */
import type { ReactNode } from 'react';
import type { SRDClass, SRDRace } from '../../../types/srd';
import { abilityLabels, catalogList, catalogText, entriesText, parseCatalog, raceBonusLabels, sizeLabel, stripTags } from '../../../lib/abilities';
import { splitSource } from '../../../lib/avatar';
import { bookLabel } from './catalog';

interface Entry { id: number; name: string; source?: string; is_srd?: boolean }

/** Book select for a race or class with several catalogue entries (shown in the card header). */
export function BookSelect<T extends Entry>({ base, entries, value, onChange }: {
  base: string;
  entries: T[];
  value: T | null;
  onChange: (entry: T) => void;
}) {
  return (
    <select
      aria-label={`Versión o libro de ${base}`}
      value={value?.id ?? ''}
      onChange={(e) => { const next = entries.find((x) => x.id === Number(e.target.value)); if (next) onChange(next); }}
      className="cc-book-select"
    >
      {entries.map((e) => <option key={e.id} value={e.id}>{bookLabel(e)}</option>)}
    </select>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="cc-fact">
      <dt>{label}</dt>
      <dd>{Array.isArray(value) ? value.join(', ') : value}</dd>
    </div>
  );
}

/** `picker` (the book select) replaces the book label when the race has several entries. */
export function RaceDetail({ race, picker }: { race: SRDRace | null; picker?: ReactNode }) {
  if (!race) return <p className="cc-detail cc-detail--empty">Elige una raza para ver sus rasgos.</p>;
  const base = splitSource(race.name).base;
  // 5etools traits are { name, entries: [...] }; the old SRD seed used { name, description }.
  const traits = parseCatalog<{ name?: string; description?: string; entries?: unknown }[]>(race.traits, [])
    .filter((t) => t && typeof t === 'object' && t.name);
  return (
    <div className="cc-detail">
      <div className="cc-detail__head">
        <h3 className="cc-detail__title">{base}</h3>
        {picker ?? <span className="cc-detail__book">{bookLabel(race)}</span>}
      </div>
      <dl className="cc-facts">
        <Fact label="Velocidad" value={race.speed ? `${race.speed} pies` : ''} />
        <Fact label="Tamaño" value={sizeLabel(race.size)} />
        <Fact label="Bonos" value={raceBonusLabels(race.ability_bonuses)} />
      </dl>
      <details className="cc-more">
        <summary>Rasgos raciales{traits.length ? ` (${traits.length})` : ''}</summary>
        <div className="cc-more__body">
          <dl className="cc-facts"><Fact label="Idiomas" value={catalogList(race.languages)} /></dl>
          {traits.map((t, i) => (
            <p key={t.name ?? i}><b>{stripTags(String(t.name ?? ''))}.</b> {t.description ? catalogText(t.description) : entriesText(t.entries)}</p>
          ))}
          {/* The flattened description repeats the traits; show it only when there are none. */}
          {traits.length === 0 && race.description && <p>{catalogText(race.description)}</p>}
        </div>
      </details>
    </div>
  );
}

export function ClassDetail({ klass, picker }: { klass: SRDClass | null; picker?: ReactNode }) {
  if (!klass) return <p className="cc-detail cc-detail--empty">Elige una clase para ver sus competencias.</p>;
  const rawSkills = parseCatalog<{ count?: number; options?: unknown[] }>(klass.skill_choices, {});
  const skills = { count: rawSkills?.count ?? 0, options: catalogList(rawSkills?.options ?? []) };
  return (
    <div className="cc-detail">
      <div className="cc-detail__head">
        <h3 className="cc-detail__title">{splitSource(klass.name).base}</h3>
        {picker ?? <span className="cc-detail__book">{bookLabel(klass)}</span>}
      </div>
      <dl className="cc-facts">
        <Fact label="Dado de golpe" value={klass.hit_die ? `d${klass.hit_die}` : ''} />
        <Fact label="Principal" value={abilityLabels(klass.primary_ability)} />
        <Fact label="Salvaciones" value={abilityLabels(klass.saving_throws)} />
      </dl>
      <details className="cc-more">
        <summary>Competencias</summary>
        <div className="cc-more__body">
          <dl className="cc-facts">
            <Fact label="Armaduras" value={catalogList(klass.armor_proficiencies)} />
            <Fact label="Armas" value={catalogList(klass.weapon_proficiencies)} />
            <Fact label="Herramientas" value={catalogList(klass.tool_proficiencies)} />
            <Fact label="Habilidades" value={skills.options.length ? `Elige ${skills.count}: ${skills.options.join(', ')}` : ''} />
            <Fact label="Conjuros" value={klass.spellcasting_ability ? klass.spellcasting_ability.toUpperCase() : ''} />
            <Fact label="Equipo inicial" value={typeof klass.starting_equipment === 'string' ? catalogText(klass.starting_equipment) : ''} />
          </dl>
          {klass.description && <p>{catalogText(klass.description)}</p>}
        </div>
      </details>
    </div>
  );
}
