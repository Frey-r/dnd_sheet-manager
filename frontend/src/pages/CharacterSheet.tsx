import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi } from '../services/api';
import type { Character } from '../types';
import { PixelAvatar } from '../components/avatar/PixelAvatar';
import { splitSource } from '../lib/avatar';
import { requestRoll } from '../lib/dice';
import { ABILITIES, toAbility } from '../lib/abilities';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { CharacterTabs } from '../components/character/CharacterTabs';
import { HpPanel } from '../components/character/HpPanel';
import { usePassivePerception } from '../lib/raceSkills';

export function CharacterSheet() {
  const { campaignId, characterId = '' } = useParams<{ campaignId: string; characterId: string }>();
  const client = useQueryClient();
  const { data: character, isLoading: loading, error: loadError, refetch } = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((response) => response.data as Character) });
  const passive = usePassivePerception(character);
  const hp = useMutation({ mutationFn: (value: { current_hp: number; temp_hp: number }) => characterApi.updateHP(characterId, value), onSuccess: () => client.invalidateQueries({ queryKey: ['character', characterId] }) });

  if (loading) {
    return <LoadingState label="Cargando personaje…" />;
  }
  if (!character) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        {loadError ? <ErrorState message={getApiError(loadError, 'No se pudo cargar el personaje')} onRetry={() => void refetch()} /> : <div className="font-body-lg text-secondary">Personaje no encontrado</div>}
        <Link to={`/campaign/${campaignId}`} className="text-primary font-label-bold">Volver</Link>
      </div>
    );
  }

  const casting = toAbility(character.spellcasting_ability || '');
  const scores: Record<string, number> = { str: character.str_score, dex: character.dex_score, con: character.con_score, int: character.int_score, wis: character.wis_score, cha: character.cha_score };
  const stats = ABILITIES.map(([key, short]) => ({ name: short, mod: calcMod(scores[key]), score: scores[key], highlight: casting === key }));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container flex items-center justify-center">
            <PixelAvatar appearance={character.appearance} race={character.race} klass={character.class} aura={false} crop="bust" scale={1.34} />
          </div>
          <h1 className="font-headline-md text-on-surface font-bold">{character.name}</h1>
        </div>
      </header>

      <CharacterTabs campaignId={campaignId} characterId={characterId} active="stats" />

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <section className="flex items-center gap-4">
          <div className="avatar-stage relative flex shrink-0 items-end justify-center rounded-xl border border-border-low-contrast px-2 pt-2">
            <PixelAvatar appearance={character.appearance} race={character.race} klass={character.class} pulse scale={3} />
            <div className="absolute bottom-0 right-0 bg-primary text-on-primary font-label-bold px-1 rounded-tl">L{character.level}</div>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-headline-lg text-on-surface leading-tight">{character.name}</h2>
            <p className="font-body-md text-on-surface-variant">{splitSource(character.race).base} · {splitSource(character.class).base}</p>
            <Link to={`/campaign/${campaignId}/character/${characterId}/appearance`} className="mc-btn h-8 w-fit px-3 text-[12.5px]">Editar apariencia</Link>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-3 flex flex-col items-center">
            <span className="font-label-sm text-secondary uppercase tracking-widest mb-1">CA</span>
            <span className="font-headline-md text-on-surface">{character.ac}</span>
          </div>
          <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-3 flex flex-col items-center">
            <span className="font-label-sm text-secondary uppercase tracking-widest mb-1">Iniciativa</span>
            <span className="font-headline-md text-on-surface">{formatMod(character.initiative_bonus)}</span>
          </div>
          <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-3 flex flex-col items-center">
            <span className="font-label-sm text-secondary uppercase tracking-widest mb-1">Velocidad</span>
            <span className="font-headline-md text-on-surface">{character.speed}<span className="text-sm font-normal text-secondary ml-1">pies</span></span>
          </div>
        </section>

        {hp.error && <ErrorState message={getApiError(hp.error, 'No se pudieron guardar los puntos de golpe')} />}
        <HpPanel character={character} pending={hp.isPending} onChange={(value) => hp.mutate(value)} />

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
            <h3 className="font-label-bold text-on-surface uppercase tracking-wider">Sentidos</h3>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-low-contrast hover:bg-surface-container-lowest transition-colors">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">circle</span>
                <span className="font-body-md text-on-surface">Percepción pasiva</span>
              </div>
              <span className="font-headline-md text-body-md text-on-surface font-semibold" title={passive.racial ? 'Incluye la competencia racial en Percepción' : undefined}>{passive.value}</span>
            </div>
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={() => requestRoll('1d20')}
        aria-label="Tirar d20"
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center shadow-md hover:bg-surface-tint transition-colors"
      >
        <span className="font-headline-md font-bold leading-none mt-1">20</span>
      </button>
    </div>
  );
}

function calcMod(score: number): string {
  return formatMod(Math.floor((score - 10) / 2));
}
function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
