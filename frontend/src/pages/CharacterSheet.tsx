import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { characterApi } from '../services/api';
import type { Character } from '../types';

export function CharacterSheet() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!characterId) return;
    setLoading(true);
    characterApi.get(characterId)
      .then(r => setCharacter(r.data))
      .catch(() => setCharacter(null))
      .finally(() => setLoading(false));
  }, [characterId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando personaje...</div></div>;
  }
  if (!character) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="font-body-lg text-secondary">Personaje no encontrado</div>
        <Link to={`/campaign/${campaignId}`} className="text-primary font-label-bold">Volver</Link>
      </div>
    );
  }

  const stats = [
    { name: 'STR', mod: calcMod(character.str_score), score: character.str_score },
    { name: 'DEX', mod: calcMod(character.dex_score), score: character.dex_score },
    { name: 'CON', mod: calcMod(character.con_score), score: character.con_score },
    { name: 'INT', mod: calcMod(character.int_score), score: character.int_score, highlight: character.spellcasting_ability === 'INT' },
    { name: 'WIS', mod: calcMod(character.wis_score), score: character.wis_score, highlight: character.spellcasting_ability === 'WIS' },
    { name: 'CHA', mod: calcMod(character.cha_score), score: character.cha_score, highlight: character.spellcasting_ability === 'CHA' },
  ];

  const hpPercent = Math.min((character.current_hp / character.max_hp) * 100, 100);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container text-sm">person</span>
          </div>
          <h1 className="font-headline-md text-on-surface font-bold">{character.name}</h1>
        </div>
      </header>

      <nav className="bg-surface border-b border-border-low-contrast sticky top-16 z-30">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-4">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="py-3 border-b-2 border-primary text-primary font-label-bold whitespace-nowrap">Stats</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/spells`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Spells</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/inventory`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Inventory</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/bio`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Bio</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/features`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Features</Link>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <section className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary-container flex items-center justify-center border border-border-low-contrast shrink-0 relative">
            <span className="material-symbols-outlined text-on-primary-container text-3xl">person</span>
            <div className="absolute bottom-0 right-0 bg-primary text-on-primary font-label-bold px-1 rounded-tl">L{character.level}</div>
          </div>
          <div>
            <h2 className="font-headline-lg text-on-surface leading-tight">{character.name}</h2>
            <p className="font-body-md text-on-surface-variant">{character.race} {character.class}</p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-3 flex flex-col items-center">
            <span className="font-label-sm text-secondary uppercase tracking-widest mb-1">Armor</span>
            <span className="font-headline-md text-on-surface">{character.ac}</span>
          </div>
          <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-3 flex flex-col items-center">
            <span className="font-label-sm text-secondary uppercase tracking-widest mb-1">Init</span>
            <span className="font-headline-md text-on-surface">{formatMod(character.initiative_bonus)}</span>
          </div>
          <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-3 flex flex-col items-center">
            <span className="font-label-sm text-secondary uppercase tracking-widest mb-1">Speed</span>
            <span className="font-headline-md text-on-surface">{character.speed}<span className="text-sm font-normal text-secondary ml-1">ft</span></span>
          </div>
        </section>

        <section className="bg-surface border border-border-low-contrast rounded-xl p-4 flex flex-col gap-3 shadow-sm">
          <div className="flex justify-between items-end">
            <div>
              <span className="font-label-bold text-on-surface-variant uppercase tracking-wider">Hit Points</span>
              <div className="flex items-baseline gap-1">
                <span className="font-stat-number text-on-surface">{character.current_hp}</span>
                <span className="font-body-lg text-secondary">/ {character.max_hp}</span>
              </div>
            </div>
          </div>
          <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden border border-border-low-contrast">
            <div className={`h-full rounded-full ${hpPercent < 30 ? 'bg-hp-danger' : hpPercent < 70 ? 'bg-gm-amber' : 'bg-success-active'}`} style={{ width: `${hpPercent}%` }} />
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className={`bg-surface border rounded-lg p-3 flex flex-col items-center shadow-sm ${stat.highlight ? 'border-primary' : 'border-border-low-contrast'}`}
            >
              <span className={`font-label-bold uppercase mb-2 ${stat.highlight ? 'text-primary' : 'text-on-surface-variant'}`}>{stat.name}</span>
              <span className={`font-stat-number text-headline-md leading-none mb-1 ${stat.highlight ? 'text-primary' : 'text-on-surface'}`}>{stat.mod}</span>
              <div className={`px-2 py-0.5 rounded text-secondary font-label-sm border ${stat.highlight ? 'bg-primary-fixed border-inverse-primary' : 'bg-surface-container border-border-low-contrast'}`}>
                {stat.score}
              </div>
            </div>
          ))}
        </section>

        <section className="bg-surface border border-border-low-contrast rounded-xl overflow-hidden shadow-sm">
          <div className="bg-surface-subtle px-4 py-3 border-b border-border-low-contrast">
            <h3 className="font-label-bold text-on-surface uppercase tracking-wider">Proficiencies</h3>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-low-contrast hover:bg-surface-container-lowest transition-colors">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">circle</span>
                <span className="font-body-md text-on-surface">Passive Perception</span>
              </div>
              <span className="font-headline-md text-body-md text-on-surface font-semibold">{character.passive_perception}</span>
            </div>
          </div>
        </section>
      </main>

      <Link
        to={`/campaign/${campaignId}/gm/combat`}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center shadow-md hover:bg-surface-tint transition-colors"
      >
        <span className="font-headline-md font-bold leading-none mt-1">20</span>
      </Link>
    </div>
  );
}

function calcMod(score: number): string {
  return formatMod(Math.floor((score - 10) / 2));
}
function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
