import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { combatApi, homebrewApi } from '../services/api';
import { getApiError } from '../services/errors';
import { HomebrewMonsterForm } from '../components/content/HomebrewMonsterForm';
import { getMonster, abilityModifier, formatModifier } from '../services/srdService';
import { CRBadge } from '../components/ui/CRBadge';
import { useAuth } from '../lib/hooks';
import type { SRDMonster, MonsterAction } from '../types/srd';
import { catalogText, entriesText } from '../lib/abilities';

/** Text of a stat-block entry: homebrew creatures use `desc`, catalog ones 5etools `entries`. */
const actionText = (entry: MonsterAction) => entry.desc ? catalogText(entry.desc) : entriesText(entry.entries ?? '');

/** One speed value: a number, or a 5etools `{number, condition}` object. */
function speedValue(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string') return `${value} ft.`;
  if (value && typeof value === 'object') {
    const o = value as { number?: number; condition?: string };
    return `${o.number ?? ''} ft.${o.condition ? ` ${catalogText(o.condition)}` : ''}`;
  }
  return '';
}

/** Saves and skills are numbers (homebrew) or signed strings such as "+5" (catalog). */
const bonus = (value: unknown) => typeof value === 'number' ? formatModifier(value) : String(value);

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
  const [added, setAdded] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!creatureId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar
    setLoading(true);
    getMonster(Number(creatureId))
      .then(setMonster)
      .catch(() => setMonster(null))
      .finally(() => setLoading(false));
  }, [creatureId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-body-lg text-secondary">Cargando ficha de criatura…</div>
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

  // Imported catalog content is read-only; only the creator of a homebrew creature (or an admin) may change it.
  const canEdit = monster.is_homebrew && (monster.created_by === user?.id || user?.role === 'admin');

  const abilities = [
    { name: 'FUE', score: monster.str },
    { name: 'DES', score: monster.dex },
    { name: 'CON', score: monster.con },
    { name: 'INT', score: monster.int },
    { name: 'SAB', score: monster.wis },
    { name: 'CAR', score: monster.cha },
  ];

  const traits = parseJSON<MonsterAction>(monster.traits, []);
  const addToCombat = async () => {
    if (!campaignId) return;
    try {
      // The server resolves HP, AC and initiative from the stat block (srd-integration.md, combat).
      await combatApi.addEncounter(campaignId, [{ monster_id: monster.id, count: 1 }]);
      setAdded('Añadido al combate');
    } catch {
      setAdded('No se pudo añadir');
    }
  };

  const actions = parseJSON<MonsterAction>(monster.actions, []);
  const legendaryActions = parseJSON<MonsterAction>(monster.legendary_actions, []);
  const legendaryCount = legendaryActions.map((entry) => /(\d+)\s+legendary actions?/i.exec(actionText(entry))?.[1]).find(Boolean) ?? '3';
  const reactions = parseJSON<MonsterAction>(monster.reactions, []);
  const speed = parseJSONObj<Record<string, unknown>>(monster.speed as unknown as string, {});
  const savingThrows = parseJSONObj<Record<string, unknown>>(monster.saving_throws as unknown as string, {});
  const skills = parseJSONObj<Record<string, unknown>>(monster.skills as unknown as string, {});

  const speedStr = Object.entries(speed)
    .filter(([k, v]) => k !== 'canHover' && typeof v !== 'boolean')
    .map(([k, v]) => k === 'walk' ? speedValue(v) : `${k} ${speedValue(v)}`)
    .join(', ') || '30 ft.';

  const savesStr = Object.entries(savingThrows)
    .map(([k, v]) => `${k.toUpperCase()} ${bonus(v)}`)
    .join(', ');

  const skillsStr = Object.entries(skills)
    .map(([k, v]) => `${k} ${bonus(v)}`)
    .join(', ');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <Link to={`/campaign/${campaignId}/gm/bestiary`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold">{monster.name}</h1>
        <div className="flex gap-2">
          <span className="bg-primary-fixed text-on-primary-fixed font-label-bold text-[10px] px-2 py-1 rounded-full self-center" title={monster.is_homebrew ? 'Criatura propia' : `Libro: ${monster.source}`}>
            {monster.is_homebrew ? 'Propia' : monster.source}
          </span>
          {canEdit && <>
            <button type="button" aria-label="Editar criatura" onClick={() => setEditing(true)} className="p-2 rounded-full hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button type="button" aria-label="Eliminar criatura" onClick={() => { if (window.confirm(`¿Eliminar "${monster.name}"?`)) homebrewApi.remove(monster.id).then(() => navigate(`/campaign/${campaignId}/gm/bestiary`)).catch((reason: unknown) => setActionError(getApiError(reason, 'No se pudo eliminar la criatura'))); }} className="p-2 rounded-full hover:bg-surface-container transition-colors text-hp-danger">
              <span className="material-symbols-outlined">delete</span>
            </button>
          </>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto px-4 md:px-10 py-lg space-y-lg">
        {actionError && <div role="alert" className="p-4 rounded-lg bg-error-container text-on-error-container">{actionError}</div>}
        {/* Header Section */}
        <section className="bg-surface-container-lowest p-lg rounded-lg border border-border-low-contrast space-y-sm">
          <h2 className="font-display-lg text-display-lg text-on-surface">{monster.name}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant italic">
            {monster.size} {monster.type}{monster.subtype ? ` (${monster.subtype})` : ''}, {monster.alignment}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-sm mt-md pt-md border-t border-border-low-contrast">
            <div className="bg-surface-subtle p-sm rounded border border-border-low-contrast flex flex-col justify-center items-center">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Clase de armadura</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-stat-number text-on-surface">{monster.ac}</span>
                {monster.ac_type && <span className="font-body-md text-on-surface-variant">({monster.ac_type})</span>}
              </div>
            </div>
            <div className="bg-surface-subtle p-sm rounded border border-border-low-contrast flex flex-col justify-center items-center">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Puntos de golpe</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-stat-number text-hp-danger">{monster.hp}</span>
                <span className="font-body-md text-on-surface-variant">({monster.hit_dice})</span>
              </div>
            </div>
            <div className="bg-surface-subtle p-sm rounded border border-border-low-contrast flex flex-col justify-center items-center col-span-2 md:col-span-1">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Velocidad</span>
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
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Salvaciones</dt>
                <dd className="w-2/3">{savesStr}</dd>
              </div>
            )}
            {skillsStr && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Habilidades</dt>
                <dd className="w-2/3">{skillsStr}</dd>
              </div>
            )}
            {monster.resistances && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Resistencias</dt>
                <dd className="w-2/3">{monster.resistances}</dd>
              </div>
            )}
            {monster.immunities && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Inmunidades</dt>
                <dd className="w-2/3">{monster.immunities}</dd>
              </div>
            )}
            {monster.vulnerabilities && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Vulnerabilidades</dt>
                <dd className="w-2/3">{monster.vulnerabilities}</dd>
              </div>
            )}
            {monster.condition_immunities && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Inmunidades a condiciones</dt>
                <dd className="w-2/3">{monster.condition_immunities}</dd>
              </div>
            )}
            {monster.senses && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Sentidos</dt>
                <dd className="w-2/3">{monster.senses}</dd>
              </div>
            )}
            {monster.languages && (
              <div className="flex border-b border-border-low-contrast pb-sm">
                <dt className="font-label-bold w-1/3 text-on-surface-variant">Idiomas</dt>
                <dd className="w-2/3">{monster.languages}</dd>
              </div>
            )}
            <div className="flex pt-sm">
              <dt className="font-label-bold w-1/3 text-on-surface-variant">Desafío</dt>
              <dd className="w-2/3"><CRBadge cr={monster.cr} className="mr-2" />({monster.xp.toLocaleString()} XP)</dd>
            </div>
          </dl>
        </section>

        {/* Traits */}
        {traits.length > 0 && (
          <section className="space-y-sm">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Rasgos</h3>
            {traits.map((trait, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{trait.name}</h4>
                <p className="font-body-md text-on-surface whitespace-pre-line">{actionText(trait)}</p>
              </div>
            ))}
          </section>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <section className="space-y-md">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Acciones</h3>
            {actions.map((action, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{action.name}</h4>
                <p className="font-body-md text-on-surface whitespace-pre-line">{actionText(action)}</p>
              </div>
            ))}
          </section>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <section className="space-y-sm">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Reacciones</h3>
            {reactions.map((reaction, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{reaction.name}</h4>
                <p className="font-body-md text-on-surface whitespace-pre-line">{actionText(reaction)}</p>
              </div>
            ))}
          </section>
        )}

        {/* Legendary Actions */}
        {legendaryActions.length > 0 && (
          <section className="space-y-sm mb-xl">
            <h3 className="font-headline-md text-on-surface border-b border-border-low-contrast pb-xs">Acciones legendarias</h3>
            <p className="font-body-md text-on-surface mb-sm">
              {monster.name} puede realizar {legendaryCount} acciones legendarias, a elegir entre las siguientes opciones. Solo puede usar una a la vez y únicamente al final del turno de otra criatura.
            </p>
            {legendaryActions.map((la, i) => (
              <div key={i} className="bg-surface-subtle p-md rounded border border-border-low-contrast">
                <h4 className="font-label-bold text-primary mb-xs">{la.name}</h4>
                <p className="font-body-md text-on-surface whitespace-pre-line">{actionText(la)}</p>
              </div>
            ))}
          </section>
        )}

        {/* Add to Combat Button */}
        <div className="sticky bottom-4 flex justify-center">
          <button type="button" onClick={addToCombat} disabled={!campaignId} className="px-6 py-3 bg-primary text-on-primary rounded-full font-label-bold shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">swords</span>
            {added ?? 'Añadir a Combate'}
          </button>
        </div>
      </main>
      {editing && <HomebrewMonsterForm initial={monster} onClose={() => setEditing(false)} onSaved={(saved) => { setMonster(saved); setEditing(false); }} />}
    </div>
  );
}
