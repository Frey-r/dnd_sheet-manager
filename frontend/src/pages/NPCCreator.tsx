/* NPC creator with the player creator's World of Warcraft layout (character-appearance.md § NPC creator,
   contratos/T-14-npc-creador.md, D-0040, D-0041): /campaign/:campaignId/gm/npcs/new creates and
   /campaign/:campaignId/gm/npcs/:npcId/edit edits, both GM-only. Origen (races left, stage centre,
   classes with "Compañeros" and "Sin clase" right) → Personalización → Estadísticas → Detalles. */
import { useCallback, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { npcApi } from '../services/api';
import { getApiError } from '../services/errors';
import type { NPC, NPCInput } from '../types';
import type { SRDClass, SRDRace } from '../types/srd';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { ClassPanel } from '../components/character/creator/ClassPanel';
import { CreatorFrame } from '../components/character/creator/CreatorFrame';
import { CreatorStage } from '../components/character/creator/CreatorStage';
import { CustomizePanel } from '../components/character/creator/CustomizePanel';
import { NameField, SummaryPanel } from '../components/character/creator/DetailsPanels';
import { IdentityPanel, StatsPanel } from '../components/character/creator/NPCPanels';
import { STAT_KEYS, originProblem, statValues, suggestedStats, type StatKey, type Stats } from '../components/character/creator/rules';
import { RacePanel } from '../components/character/creator/RacePanel';
import { initialLook, lookReducer } from '../components/character/creator/look';
import { TokenPreview } from '../components/character/creator/TokenPreview';
import { useCreatorCatalog } from '../components/character/creator/useCatalog';
import { abilityMod } from '../lib/abilities';
import { resolveRaceVisual, splitSource, type Appearance } from '../lib/avatar';
import { versionedRaceName } from '../lib/raceSkills';

const STEPS = ['Origen', 'Personalización', 'Estadísticas', 'Detalles'] as const;
const NPC_HINTS = ['Así se verá su ficha en la mesa.', 'Y así en la lista de PNJ.'] as const;
/** Hit die of an NPC without class (a commoner's d4 + CON). */
const NO_CLASS_HIT_DIE = 4;
const DEFAULT_SPEED = 30;

/** A sidekick or player class, "Sin clase" or nothing chosen yet. */
type ClassChoice = SRDClass | 'none' | null;

interface Draft {
  race: SRDRace | null;
  appearance: unknown;
  klass: ClassChoice;
  stats: Stats<string>;
  name: string;
  role: string;
  status: string;
  description: string;
  /** Stats keys the creator does not edit (the stat-block profile: type, size, CR, traits, actions). */
  extra: Record<string, unknown>;
}

const EMPTY_STATS = Object.fromEntries(STAT_KEYS.map((key) => [key, ''])) as Stats<string>;
const BLANK: Draft = { race: null, appearance: null, klass: null, stats: EMPTY_STATS, name: '', role: '', status: 'neutral', description: '', extra: {} };

/** The editor's starting point: the stored NPC matched against the catalogue. */
function draftOf(npc: NPC, races: SRDRace[], classes: SRDClass[]): Draft {
  const stats = npc.stats ?? {};
  const typed = (key: StatKey) => (stats[key] == null ? '' : String(stats[key]));
  return {
    race: races.find((r) => versionedRaceName(r) === npc.race) ?? null,
    appearance: npc.appearance,
    klass: npc.class ? classes.find((c) => c.name === npc.class) ?? null : 'none',
    stats: Object.fromEntries(STAT_KEYS.map((key) => [key, typed(key)])) as Stats<string>,
    name: npc.name,
    role: npc.role,
    status: npc.status,
    description: npc.description,
    extra: stats,
  };
}

export function NPCCreatorPage() {
  const { campaignId = '', npcId } = useParams<{ campaignId: string; npcId?: string }>();
  const { races, classes } = useCreatorCatalog();
  const npc = useQuery({
    queryKey: ['npcs', campaignId, npcId],
    queryFn: async () => (await npcApi.get(campaignId, npcId as string)).data,
    enabled: Boolean(npcId),
  });

  if (!npcId) return <NPCForm campaignId={campaignId} initial={BLANK} races={races} classes={classes} />;
  const failed = npc.error ?? races.error ?? classes.error;
  if (failed) return <ErrorState message={getApiError(failed, 'No se pudo cargar el PNJ')} />;
  if (!npc.data || !races.data || !classes.data) return <LoadingState />;
  return <NPCForm campaignId={campaignId} npcId={npcId} initial={draftOf(npc.data, races.data, classes.data)} races={races} classes={classes} />;
}

type Catalog = ReturnType<typeof useCreatorCatalog>;

function NPCForm({ campaignId, npcId, initial, races, classes }: {
  campaignId: string;
  npcId?: string;
  initial: Draft;
  races: Catalog['races'];
  classes: Catalog['classes'];
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [{ race, appearance }, dispatch] = useReducer(lookReducer, initial, (d) => initialLook(d.race, d.appearance));
  const [choice, setChoice] = useState<ClassChoice>(initial.klass);
  const [stats, setStats] = useState(initial.stats);
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);
  const [status, setStatus] = useState(initial.status);
  const [description, setDescription] = useState(initial.description);

  const klass = choice === 'none' ? null : choice;
  const visual = useMemo(() => resolveRaceVisual(race?.name ?? 'Human', race?.size), [race]);
  const chooseRace = useCallback((r: SRDRace) => dispatch({ type: 'race', race: r }), []);
  const chooseBody = useCallback((body: 0 | 1) => dispatch({ type: 'body', body }), []);
  const setAppearance = useCallback((a: Appearance) => dispatch({ type: 'appearance', appearance: a }), []);
  const npcClass = useMemo(() => ({ noClass: choice === 'none', onNoClass: () => setChoice('none') }), [choice]);

  const hitDie = klass ? klass.hit_die : NO_CLASS_HIT_DIE;
  const suggested = suggestedStats(stats, hitDie, race?.speed || DEFAULT_SPEED);
  const values = statValues(stats, suggested);
  const raceBase = race ? splitSource(race.name).base : '';
  const classLabel = choice === 'none' ? 'Sin clase' : klass ? splitSource(klass.name).base : 'Clase';
  const caption = `${raceBase || 'Raza'} · ${classLabel}`;
  const label = name.trim() || 'Nuevo PNJ';

  const problems = [originProblem(Boolean(race), choice !== null), '', '', name.trim() ? '' : 'Ponle nombre al PNJ.'];

  const save = useMutation({
    mutationFn: (payload: NPCInput) => (npcId ? npcApi.update(campaignId, npcId, payload) : npcApi.create(campaignId, payload)),
    onSuccess: (response) => {
      void qc.invalidateQueries({ queryKey: ['npcs', campaignId] });
      navigate(`/campaign/${campaignId}/gm/npcs/${npcId ?? response.data.id}`);
    },
  });
  const submit = () => save.mutate({
    name: name.trim(),
    role: role.trim(),
    status,
    description,
    race: race ? versionedRaceName(race) : '',
    class: klass?.name ?? '',
    appearance,
    stats: { ...initial.extra, ...values },
  });

  return (
    <CreatorFrame
      title={npcId ? 'Editar PNJ' : 'Crear PNJ'}
      steps={STEPS}
      step={step}
      onStep={setStep}
      problems={problems}
      primaryLabels={['Personalizar', 'Siguiente', 'Siguiente', npcId ? 'Guardar PNJ' : 'Crear PNJ']}
      busy={save.isPending}
      busyLabel="Guardando…"
      onSubmit={submit}
      stage={(
        <CreatorStage eyebrow={label} caption={caption} appearance={appearance} race={race?.name ?? 'Human'} raceSize={race?.size} klass={klass?.name} placeholder={!race}>
          {step === 3 && <NameField value={name} onChange={setName} />}
        </CreatorStage>
      )}
      start={(
        <>
          {/* Origen panels stay mounted (search, scroll and race portraits survive the steps). */}
          <div className="cc-slot" hidden={step !== 0}>
            <RacePanel races={races.data ?? []} loading={races.isLoading} race={race} body={appearance.body} onChoose={chooseRace} onBody={chooseBody} />
          </div>
          {step === 1 && <CustomizePanel value={appearance} visual={visual} onChange={setAppearance} />}
          {step === 2 && (
            <StatsPanel
              draft={stats}
              suggested={suggested}
              hints={{ hp: `Sugeridos: d${hitDie} + mod. CON`, speed: raceBase ? `Sugerida: la de ${raceBase}` : '' }}
              onChange={(key, v) => setStats((s) => ({ ...s, [key]: v }))}
            />
          )}
          {step === 3 && <IdentityPanel role={role} status={status} description={description} onRole={setRole} onStatus={setStatus} onDescription={setDescription} />}
        </>
      )}
      end={(
        <>
          <div className="cc-slot" hidden={step !== 0}>
            <ClassPanel classes={classes.data ?? []} loading={classes.isLoading} klass={klass} onChoose={setChoice} npc={npcClass} />
          </div>
          {step === 1 && <TokenPreview appearance={appearance} race={race?.name ?? 'Human'} raceSize={race?.size} klass={klass?.name} name={label} meta={caption} hints={NPC_HINTS} />}
          {step === 3 && (
            <SummaryPanel
              title="Resumen"
              caption={caption}
              preview={{ hp: values.hp, ac: values.ac, speed: values.speed, init: abilityMod(values.dex) }}
              note="Se cambian en Estadísticas."
            />
          )}
        </>
      )}
    >
      {save.error && <ErrorState message={getApiError(save.error, 'No se pudo guardar el PNJ')} />}
      {(races.error || classes.error) && <ErrorState message="No se pudo cargar el catálogo de razas y clases" />}
    </CreatorFrame>
  );
}
