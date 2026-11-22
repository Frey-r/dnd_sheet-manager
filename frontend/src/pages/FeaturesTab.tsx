import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { characterApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { CharacterTabs } from '../components/character/CharacterTabs';
import type { Character, CharacterFeature } from '../types';
import { raceEntryFor, usePassivePerception } from '../lib/raceSkills';
import { splitSource } from '../lib/avatar';
import { getClass, listRaces } from '../services/srdService';
import { abilityLabels, catalogList, catalogText } from '../lib/abilities';
import { passiveOf, useSkillRows } from '../lib/skills';

const TYPE_LABEL: Record<string, string> = { class: 'Clase', racial: 'Racial', feat: 'Dote' };
const REST_LABEL: Record<string, string> = { short: 'descanso corto', long: 'descanso largo' };
// Features are listed in groups: class features, racial traits, then feats.
const GROUPS: [string, string][] = [['class', 'Rasgos de clase'], ['racial', 'Rasgos raciales'], ['feat', 'Dotes']];

export function FeaturesTab() {
  const { campaignId, characterId = '' } = useParams<{ campaignId: string; characterId: string }>();
  const characterQuery = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((response) => response.data as Character) });
  const featuresQuery = useQuery({ queryKey: ['features', characterId], queryFn: () => characterApi.features(characterId).then((response) => (response.data ?? []) as CharacterFeature[]) });
  const character = characterQuery.data;
  const features = featuresQuery.data ?? [];
  const passive = usePassivePerception(character);
  const skills = useSkillRows(character);
  // Catalogue class (srd-integration.md): hit die, saving throws, proficiencies and the class
  // features up to the character's level, shown next to the character's own copy.
  const className = character ? splitSource(character.class).base : '';
  const catalogClass = useQuery({ queryKey: ['srd-class', className], enabled: Boolean(className), staleTime: 300_000, retry: false, queryFn: () => getClass(className) });
  const races = useQuery({ queryKey: ['srd-races'], queryFn: async () => (await listRaces()).data ?? [], staleTime: 300_000, enabled: Boolean(character) });
  const race = character ? raceEntryFor(races.data ?? [], character.race) : undefined;

  if (characterQuery.isLoading) return <LoadingState label="Cargando rasgos…" />;
  if (characterQuery.error || !character) return <div className="p-8"><ErrorState message={getApiError(characterQuery.error, 'No se pudo cargar el personaje')} onRetry={() => void characterQuery.refetch()} /></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex justify-between items-center px-4">
        <div className="flex items-center gap-2">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">{character.name}</h1>
        </div>
      </header>

      <CharacterTabs campaignId={campaignId} characterId={characterId} active="features" />

      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-2 py-1 bg-surface-variant text-on-surface rounded font-label-sm">{splitSource(character.race).base} {splitSource(character.class).base} Nv {character.level}</span>
          {character.background && <span className="px-2 py-1 bg-surface-variant text-on-surface rounded font-label-sm">{character.background}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              <h3 className="font-label-bold text-on-surface uppercase tracking-wider mb-4">Sentidos pasivos</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center bg-surface-subtle p-3 rounded border border-border-low-contrast">
                  <span className="font-body-md text-on-surface">Percepción pasiva</span>
                  <span className="font-headline-md text-on-background" title={passive.racial ? 'Incluye la competencia racial en Percepción' : undefined}>{passive.value}</span>
                </div>
                {([['investigation', 'Investigación pasiva'], ['insight', 'Perspicacia pasiva']] as const).map(([key, label]) => <div key={key} className="flex justify-between items-center bg-surface-subtle p-3 rounded border border-border-low-contrast">
                  <span className="font-body-md text-on-surface">{label}</span>
                  <span className="font-headline-md text-on-background">{passiveOf(skills, key)}</span>
                </div>)}
              </div>
            </div>
            {catalogClass.data && <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              <h3 className="font-label-bold text-on-surface uppercase tracking-wider mb-3">Clase según el compendio</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-secondary">Dado de golpe</dt><dd>d{catalogClass.data.hit_die}</dd>
                <dt className="text-secondary">Salvaciones</dt><dd>{abilityLabels(catalogClass.data.saving_throws).join(', ') || '—'}</dd>
                <dt className="text-secondary">Armaduras</dt><dd>{catalogList(catalogClass.data.armor_proficiencies).join(', ') || '—'}</dd>
                <dt className="text-secondary">Armas</dt><dd>{catalogList(catalogClass.data.weapon_proficiencies).join(', ') || '—'}</dd>
                {catalogList(catalogClass.data.tool_proficiencies).length > 0 && <><dt className="text-secondary">Herramientas</dt><dd>{catalogList(catalogClass.data.tool_proficiencies).join(', ')}</dd></>}
                {race && catalogList(race.languages).length > 0 && <><dt className="text-secondary">Idiomas</dt><dd>{catalogList(race.languages).join(', ')}</dd></>}
              </dl>
            </div>}
          </div>

          <div className="md:col-span-8 flex flex-col gap-6">
            {featuresQuery.error ? <ErrorState message={getApiError(featuresQuery.error, 'No se pudieron cargar los rasgos')} onRetry={() => void featuresQuery.refetch()} /> : featuresQuery.isLoading ? <LoadingState /> : features.length > 0 ? (
              <>{[...GROUPS, ...[...new Set(features.map((f) => f.type))].filter((type) => !GROUPS.some(([key]) => key === type)).map((type): [string, string] => [type, TYPE_LABEL[type] ?? type])].map(([type, title]) => { const group = features.filter((f) => f.type === type); return group.length === 0 ? null : <section key={type}>
                <h3 className="font-label-bold text-on-surface uppercase tracking-wider border-b border-border-low-contrast pb-2 mb-4">{title}</h3>
                <div className="flex flex-col gap-4">
                  {group.map((f) => (
                    <div key={f.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 border-l-4 border-l-primary">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-body-lg text-on-background font-bold">{f.name}</h4>
                        <span className="px-2 py-1 bg-surface-variant text-secondary rounded text-[10px] uppercase font-bold">{TYPE_LABEL[f.type] ?? f.type}</span>
                      </div>
                      <p className="font-body-md text-on-surface-variant">{f.description}</p>
                      {f.uses_per_rest != null && f.uses_per_rest > 0 && (
                        <div className="mt-2 font-label-sm text-secondary">Usos: {f.uses_per_rest} por {REST_LABEL[f.rest_type] ?? 'descanso'}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>; })}</>
            ) : (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-4xl text-outline mb-3 block">auto_awesome</span>
                <p className="font-body-lg text-secondary">Este personaje aún no tiene rasgos.</p>
              </div>
            )}
            {catalogClass.data?.features && catalogClass.data.features.some((f) => f.level <= character.level) && <section>
              <h3 className="font-label-bold text-on-surface uppercase tracking-wider border-b border-border-low-contrast pb-2 mb-4">Rasgos de {className} hasta el nivel {character.level} (compendio)</h3>
              <div className="flex flex-col gap-3">{catalogClass.data.features.filter((f) => f.level <= character.level).map((f) => <details key={f.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-3"><summary className="cursor-pointer font-label-bold">Nv {f.level} · {f.name}</summary><p className="mt-2 text-sm text-on-surface-variant whitespace-pre-wrap">{catalogText(f.description)}</p></details>)}</div>
            </section>}
          </div>
        </div>
      </main>
    </div>
  );
}
