import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMonster, abilityModifier, formatModifier } from '../services/srdService';
import type { SRDMonster, MonsterAction } from '../types/srd';

function parseJSON<T>(value: string | T[] | null | undefined, fallback: T[]): T[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value as string); } catch { return fallback; }
}

function parseJSONObj<T>(value: string | T | null | undefined, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try { return JSON.parse(value as string); } catch { return fallback; }
}

export function CreatureDetail() {
  const { campaignId, creatureId } = useParams();
  const [monster, setMonster] = useState<SRDMonster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatureId) return;
    setLoading(true);
    getMonster(Number(creatureId))
      .then(setMonster)
      .catch(() => setMonster(null))
      .finally(() => setLoading(false));
  }, [creatureId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-body-lg text-secondary">Cargando stat block...</div>
      </div>
    );
  }

  if (!monster) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-body-lg text-secondary">Criatura no encontrada.</div>
      </div>
    );
  }

  const abilities = [
    { name: 'STR', score: monster.str },
    { name: 'DEX', score: monster.dex },
    { name: 'CON', score: monster.con },
    { name: 'INT', score: monster.int },
    { name: 'WIS', score: monster.wis },
    { name: 'CHA', score: monster.cha },
  ];

  const traits = parseJSON<MonsterAction>(monster.traits, []);
  const actions = parseJSON<MonsterAction>(monster.actions, []);
  const legendaryActions = parseJSON<MonsterAction>(monster.legendary_actions, []);
  const reactions = parseJSON<MonsterAction>(monster.reactions, []);
  const speed = parseJSONObj<Record<string, string | number>>(monster.speed as any, {});
  const savingThrows = parseJSONObj<Record<string, number>>(monster.saving_throws as any, {});
  const skills = parseJSONObj<Record<string, number>>(monster.skills as any, {});

  const speedStr = Object.entries(speed)
    .map(([k, v]) => k === 'walk' ? `${v} ft.` : `${k} ${v} ft.`)
    .join(', ') || '30 ft.';

  const savesStr = Object.entries(savingThrows)
    .map(([k, v]) => `${k.toUpperCase()} ${formatModifier(v)}`)
    .join(', ');

  const skillsStr = Object.entries(skills)
    .map(([k, v]) => `${k} ${formatModifier(v)}`)
    .join(', ');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <Link to={`/campaign/${campaignId}/gm/bestiary`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold">{monster.name}</h1>
        <div className="flex gap-2">
          {monster.is_srd && (
            <span className="bg-primary-fixed text-on-primary-fixed font-label-bold text-[10px] px-2 py-1 rounded-full self-center">SRD</span>
          )}
          <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">edit</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto px-4 md:px-10 py-lg space-y-lg">
        {/* Header Section */}
        <section className="bg-surface-container-lowest p-lg rounded-lg border border-border-low-contrast space-y-sm">
          <h2 className="font-display-lg text-display-lg text-on-surface">{monster.name}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant italic">
            {monster.size} {monster.type}{monster.subtype ? ` (${monster.subtype})` : ''}, {monster.alignment}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-sm mt-md pt-md border-t border-border-low-contrast">
            <div className="bg-surface-subtle p-sm rounded border border-border-low-contrast flex flex-col justify-center items-center">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Armor Class</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-stat-number text-on-surface">{monster.ac}</span>
                {monster.ac_type && <span className="font-body-md text-on-surface-variant">({monster.ac_type})</span>}
              </div>
            </div>
            <div className="bg-surface-subtle p-sm rounded border border-border-low-contrast flex flex-col justify-center items-center">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Hit Points</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-stat-number text-hp-danger">{monster.hp}</span>
                <span className="font-body-md text-on-surface-variant">({monster.hit_dice})</span>
              </div>
            </div>
            <div className="bg-surface-subtle p-sm rounded border border-border-low-contrast flex flex-col justify-center items-center col-span-2 md:col-span-1">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Speed</span>
              <span className="font-body-md text-on-surface">{speedStr}</span>
            </div>
          </div>
        </section>

        {/* Ability Scores */}
        <section className="grid grid-cols-3 md:grid-cols-6 gap-xs">
          {abilities.map((stat) => (
            <div key={stat.name} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-sm flex flex-col items-center text-center">
              <span className="font-label-bold text-on-surface">{stat.name}</span>
              <span className="font-stat-number text-on-surface leading-none mt-xs">{stat.score}</span>
              <span className="font-label-sm text-on-surface-variant mt-unit">({formatModifier(abilityModifier(stat.score))})</span>
            </div>
          ))}
        </section>

        {/* Info Block */}
        <section className="bg-surface-container-lowest rounded-lg border border-border-low-contrast p-lg">
          <dl className="space-y-sm font-body-md text-on-surface">
            {savesStr && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Saving Throws</dt>
                <dd className="w-2/3">{savesStr}</dd>
              </div>
            )}
            {skillsStr && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Skills</dt>
                <dd className="w-2/3">{skillsStr}</dd>
              </div>
            )}
            {monster.resistances && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Resistances</dt>
                <dd className="w-2/3">{monster.resistances}</dd>
              </div>
            )}
            {monster.immunities && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Immunities</dt>
                <dd className="w-2/3">{monster.immunities}</dd>
              </div>
            )}
            {monster.vulnerabilities && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Vulnerabilities</dt>
                <dd className="w-2/3">{monster.vulnerabilities}</dd>
              </div>
            )}
            {monster.condition_immunities && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Condition Immunities</dt>
                <dd className="w-2/3">{monster.condition_immunities}</dd>
              </div>
            )}
            {monster.senses && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Senses</dt>
                <dd className="w-2/3">{monster.senses}</dd>
              </div>
            )}
            {monster.languages && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Languages</dt>
                <dd className="w-2/3">{monster.languages}</dd>
              </div>
            )}
            <div className="flex pt-sm">
              <dt className="font-label-bold w-1/3 text-on-surface-variant">Challenge</dt>
              <dd className="w-2/3">{monster.cr} ({monster.xp.toLocaleString()} XP)</dd>
            </div>
          </dl>
        </section>

        {/* Traits */}
        {traits.length > 0 && (
          <section className="space-y-sm">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Traits</h3>
            {traits.map((trait, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{trait.name}</h4>
                <p className="font-body-md text-on-surface">{trait.desc}</p>
              </div>
            ))}
          </section>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <section className="space-y-md">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Actions</h3>
            {actions.map((action, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{action.name}</h4>
                <p className="font-body-md text-on-surface">{action.desc}</p>
              </div>
            ))}
          </section>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <section className="space-y-sm">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Reactions</h3>
            {reactions.map((reaction, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{reaction.name}</h4>
                <p className="font-body-md text-on-surface">{reaction.desc}</p>
              </div>
            ))}
          </section>
        )}

        {/* Legendary Actions */}
        {legendaryActions.length > 0 && (
          <section className="space-y-sm mb-xl">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Legendary Actions</h3>
            <p className="font-body-md text-on-surface mb-sm">
              The {monster.name.toLowerCase()} can take 3 legendary actions, choosing from the options below.
            </p>
            {legendaryActions.map((la, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{la.name}</h4>
                <p className="font-body-md text-on-surface">{la.desc}</p>
              </div>
            ))}
          </section>
        )}

        {/* Add to Combat Button */}
        <div className="sticky bottom-4 flex justify-center">
          <button className="px-6 py-3 bg-primary text-on-primary rounded-full font-label-bold shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">swords</span>
            Añadir a Combate
          </button>
        </div>
      </main>
    </div>
  );
}
