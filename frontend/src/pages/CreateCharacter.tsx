/* Character creation with the World of Warcraft layout (character-appearance.md, "Creation
   wizard"; characters.md, "Character Creation"): Origen (races left, stage centre, classes
   right) → Personalización → Características → Detalles, with a bottom action bar. The stage
   stays mounted on every step. */
import { useCallback, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { characterApi } from '../services/api';
import { getApiError } from '../services/errors';
import type { SRDClass, SRDRace } from '../types/srd';
import { ErrorState } from '../components/ui/Feedback';
import { AbilityScores, type AbilityState } from '../components/character/AbilityScores';
import { ClassPanel } from '../components/character/creator/ClassPanel';
import { CreatorFrame } from '../components/character/creator/CreatorFrame';
import { CreatorStage } from '../components/character/creator/CreatorStage';
import { CustomizePanel } from '../components/character/creator/CustomizePanel';
import { BackgroundPanel, NameField, SummaryPanel } from '../components/character/creator/DetailsPanels';
import { RacePanel } from '../components/character/creator/RacePanel';
import { initialLook, lookReducer } from '../components/character/creator/look';
import { originProblem } from '../components/character/creator/rules';
import { TokenPreview } from '../components/character/creator/TokenPreview';
import { useCreatorCatalog } from '../components/character/creator/useCatalog';
import { abilityLabels, abilityMod, raceAbilityBonuses, suggestedIncreases } from '../lib/abilities';
import { resolveRaceVisual, splitSource, type Appearance } from '../lib/avatar';
import { versionedRaceName } from '../lib/raceSkills';

const STEPS = ['Origen', 'Personalización', 'Características', 'Detalles'] as const;
const PRIMARY = ['Personalizar', 'Siguiente', 'Siguiente', 'Crear personaje'] as const;

export function CreateCharacterPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [{ race, appearance }, dispatch] = useReducer(lookReducer, undefined, initialLook);
  const [klass, setKlass] = useState<SRDClass | null>(null);
  const [background, setBackground] = useState('');
  const [alignment, setAlignment] = useState('');
  const [abilities, setAbilities] = useState<AbilityState | null>(null);
  const [error, setError] = useState('');
  // Non-blocking catalog notes from the server (class or race not in the catalog).
  const [created, setCreated] = useState<{ id: number; warnings: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { races, classes } = useCreatorCatalog();
  const suggestion = useMemo(() => suggestedIncreases(raceAbilityBonuses(race?.ability_bonuses)), [race]);
  const visual = useMemo(() => resolveRaceVisual(race?.name ?? 'Human', race?.size), [race]);

  // Stable callbacks, so the memoised race tiles do not re-render on every change of the look.
  const chooseRace = useCallback((r: SRDRace) => dispatch({ type: 'race', race: r }), []);
  const chooseBody = useCallback((body: 0 | 1) => dispatch({ type: 'body', body }), []);
  const setAppearance = useCallback((a: Appearance) => dispatch({ type: 'appearance', appearance: a }), []);

  const final = abilities?.final;
  const preview = final && klass ? {
    hp: Math.max(1, (klass.hit_die || 8) + abilityMod(final.con)),
    ac: 10 + abilityMod(final.dex),
    speed: race?.speed || 30,
    init: abilityMod(final.dex),
  } : null;

  const raceBase = race ? splitSource(race.name).base : '';
  const classBase = klass ? splitSource(klass.name).base : '';
  const caption = `${raceBase || 'Raza'} · ${classBase || 'Clase'}`;

  const stepProblem = [
    originProblem(Boolean(race), Boolean(klass)),
    '',
    abilities?.valid ? '' : (abilities?.problem ?? 'Asigna tus características.'),
    name.trim() ? '' : 'Ponle nombre a tu personaje.',
  ];

  const submit = async () => {
    if (!abilities || !race || !klass) return;
    setSubmitting(true); setError('');
    const f = abilities.final, b = abilities.base;
    try {
      const response = await characterApi.create({
        name: name.trim(), race: versionedRaceName(race), class: klass.name, campaign_id: Number(campaignId),
        background: background.trim(), alignment,
        str_score: f.str, dex_score: f.dex, con_score: f.con, int_score: f.int, wis_score: f.wis, cha_score: f.cha,
        ...(abilities.rollId ? { stat_roll_id: abilities.rollId, base_scores: [b.str, b.dex, b.con, b.int, b.wis, b.cha] } : {}),
        speed: race.speed || undefined,
        appearance,
      });
      void qc.invalidateQueries({ queryKey: ['characters', String(campaignId)] });
      void qc.invalidateQueries({ queryKey: ['stat-rolls', campaignId] });
      const warnings: string[] = response.data.warnings ?? [];
      if (warnings.length) setCreated({ id: response.data.id, warnings });
      else navigate(`/campaign/${campaignId}/character/${response.data.id}`);
    } catch (requestError) {
      setError(getApiError(requestError, 'No se pudo crear el personaje'));
    } finally { setSubmitting(false); }
  };

  return (
    <CreatorFrame
      title="Crear personaje"
      steps={STEPS}
      step={step}
      onStep={setStep}
      problems={stepProblem}
      primaryLabels={PRIMARY}
      busy={submitting}
      busyLabel="Creando…"
      onSubmit={() => void submit()}
      stage={(
        <CreatorStage
          eyebrow={name.trim() || 'Nuevo personaje'}
          caption={caption}
          appearance={appearance}
          race={race?.name ?? 'Human'}
          raceSize={race?.size}
          klass={klass?.name}
          placeholder={!race}
        >
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
          {/* Mounted throughout: it keeps the chosen method and assignment between steps. */}
          <div className="cc-slot" hidden={step !== 2}>
            <section className="cc-panel cc-abilities" aria-label="Características">
              {klass && (
                <p className="cc-note">
                  <Sparkles size={14} aria-hidden /> {classBase}: característica principal {abilityLabels(klass.primary_ability).join(' o ') || '—'} · salvaciones {abilityLabels(klass.saving_throws).join(', ') || '—'}
                </p>
              )}
              <div className="cc-scroll"><AbilityScores campaignId={campaignId} suggestion={suggestion} onChange={setAbilities} /></div>
            </section>
          </div>
          {step === 3 && <BackgroundPanel background={background} alignment={alignment} onBackground={setBackground} onAlignment={setAlignment} />}
        </>
      )}
      end={(
        <>
          <div className="cc-slot" hidden={step !== 0}>
            <ClassPanel classes={classes.data ?? []} loading={classes.isLoading} klass={klass} onChoose={setKlass} />
          </div>
          {step === 1 && (
            <TokenPreview appearance={appearance} race={race?.name ?? 'Human'} raceSize={race?.size} klass={klass?.name} name={name.trim() || 'Nuevo personaje'} meta={`${caption} · Nivel 1`} />
          )}
          {step === 3 && <SummaryPanel preview={preview} caption={caption} />}
        </>
      )}
    >
      {error && <ErrorState message={error} />}
      {created && (
        <section role="status" className="rounded-lg border border-warn bg-warn-soft p-4 space-y-2">
          <p className="font-label-bold">Personaje creado con avisos</p>
          <ul className="list-disc pl-5 text-sm">{created.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <button type="button" onClick={() => navigate(`/campaign/${campaignId}/character/${created.id}`)} className="mc-btn mc-btn-primary">Ir a la ficha</button>
        </section>
      )}
      {(races.error || classes.error) && <ErrorState message="No se pudo cargar el catálogo de razas y clases" />}
    </CreatorFrame>
  );
}
