/* Rules panels for the chosen catalogue race and class. */
import type { SRDClass, SRDRace } from '../../../types/srd';
import { abilityLabels, catalogList, catalogText, entriesText, parseCatalog, raceBonusLabels, sizeLabel, stripTags } from '../../../lib/abilities';
import { splitSource } from '../../../lib/avatar';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  return <div className="flex gap-2 text-[13.5px]"><span className="w-32 shrink-0 text-muted">{label}</span><span className="min-w-0">{Array.isArray(value) ? value.join(', ') : value}</span></div>;
}

export function RaceDetail({ race }: { race: SRDRace | null }) {
  if (!race) return <section className="mc-card p-5 text-muted">Selecciona una raza para ver sus rasgos.</section>;
  const parsed = splitSource(race.name);
  const base = parsed.base;
  const source = parsed.source || race.source || '';
  const bonuses = raceBonusLabels(race.ability_bonuses);
  // 5etools traits are { name, entries: [...] }; the old SRD seed used { name, description }.
  const traits = parseCatalog<{ name?: string; description?: string; entries?: unknown }[]>(race.traits, [])
    .filter((t) => t && typeof t === 'object' && t.name);
  return (
    <section className="mc-card flex max-h-[34rem] flex-col gap-2 overflow-y-auto p-5">
      <div><h2 className="font-display text-[20px]">{base}</h2><p className="text-[12.5px] text-muted">{source || 'Catálogo'}{race.is_srd ? ' · SRD' : ''}</p></div>
      <Fact label="Velocidad" value={race.speed ? `${race.speed} pies` : ''} />
      <Fact label="Tamaño" value={sizeLabel(race.size)} />
      <Fact label="Bonificadores" value={bonuses} />
      <Fact label="Idiomas" value={catalogList(race.languages)} />
      {Array.isArray(traits) && traits.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          {traits.map((t, i) => <div key={t.name ?? i} className="whitespace-pre-line text-[13.5px]"><b>{stripTags(String(t.name ?? ''))}.</b> <span className="text-ink-2">{t.description ? catalogText(t.description) : entriesText(t.entries)}</span></div>)}
        </div>
      )}
      {/* The flattened description repeats the traits; show it only when there are none. */}
      {traits.length === 0 && race.description && <p className="whitespace-pre-line text-[13.5px] text-ink-2">{catalogText(race.description)}</p>}
    </section>
  );
}

export function ClassDetail({ klass }: { klass: SRDClass | null }) {
  if (!klass) return <section className="mc-card p-5 text-muted">Selecciona una clase para ver sus competencias.</section>;
  const rawSkills = parseCatalog<{ count?: number; options?: unknown[] }>(klass.skill_choices, {});
  const skills = { count: rawSkills?.count ?? 0, options: catalogList(rawSkills?.options ?? []) };
  return (
    <section className="mc-card flex max-h-[34rem] flex-col gap-2 overflow-y-auto p-5">
      <div><h2 className="font-display text-[20px]">{klass.name}</h2>{klass.source && <p className="text-[12.5px] text-muted">{klass.source}</p>}</div>
      <Fact label="Dado de golpe" value={klass.hit_die ? `d${klass.hit_die}` : ''} />
      <Fact label="Característica principal" value={abilityLabels(klass.primary_ability)} />
      <Fact label="Salvaciones" value={abilityLabels(klass.saving_throws)} />
      <Fact label="Armaduras" value={catalogList(klass.armor_proficiencies)} />
      <Fact label="Armas" value={catalogList(klass.weapon_proficiencies)} />
      <Fact label="Herramientas" value={catalogList(klass.tool_proficiencies)} />
      <Fact label="Habilidades" value={skills.options.length ? `Elige ${skills.count}: ${skills.options.join(', ')}` : ''} />
      <Fact label="Lanzamiento" value={klass.spellcasting_ability ? klass.spellcasting_ability.toUpperCase() : ''} />
      <Fact label="Equipo inicial" value={typeof klass.starting_equipment === 'string' ? <span className="whitespace-pre-line">{catalogText(klass.starting_equipment)}</span> : ''} />
      {klass.description && <p className="whitespace-pre-line text-[13.5px] text-ink-2">{catalogText(klass.description)}</p>}
    </section>
  );
}
