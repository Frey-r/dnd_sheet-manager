/* Character creation wizard (openspec/specs/characters.md "Character Creation" and
   character-appearance.md): race → appearance → class → ability scores → details,
   with the pixel-art avatar always on stage. */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { characterApi } from '../services/api';
import { getApiError } from '../services/errors';
import { listClasses, listRaces } from '../services/srdService';
import type { SRDClass, SRDRace } from '../types/srd';
import { ErrorState } from '../components/ui/Feedback';
import { AbilityScores, type AbilityState } from '../components/character/AbilityScores';
import { AppearanceEditor } from '../components/character/creator/AppearanceEditor';
import { ClassDetail, RaceDetail } from '../components/character/creator/CatalogDetails';
import { ClassStep } from '../components/character/creator/ClassStep';
import { RaceStep } from '../components/character/creator/RaceStep';
import { PixelAvatar } from '../components/avatar/PixelAvatar';
import { abilityMod, raceAbilityBonuses, signed, suggestedIncreases } from '../lib/abilities';
import { defaultAppearance, normalizeAppearance, resolveRaceVisual, splitSource, type Appearance } from '../lib/avatar';
import { versionedRaceName } from '../lib/raceSkills';

const ALIGNMENTS = ['Legal bueno', 'Neutral bueno', 'Caótico bueno', 'Legal neutral', 'Neutral', 'Caótico neutral', 'Legal malvado', 'Neutral malvado', 'Caótico malvado'];
const STEPS = ['Raza', 'Apariencia', 'Clase', 'Características', 'Detalles'] as const;

export function CreateCharacterPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [race, setRace] = useState<SRDRace | null>(null);
  const [klass, setKlass] = useState<SRDClass | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(() => defaultAppearance(resolveRaceVisual('Human')));
  const [background, setBackground] = useState('');
  const [alignment, setAlignment] = useState('');
  const [abilities, setAbilities] = useState<AbilityState | null>(null);
  const [error, setError] = useState('');
  // Non-blocking catalog notes from the server (class or race not in the catalog).
  const [created, setCreated] = useState<{ id: number; warnings: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const races = useQuery({ queryKey: ['srd-races'], queryFn: async () => (await listRaces()).data ?? [], staleTime: 300_000 });
  const classes = useQuery({ queryKey: ['srd-classes'], queryFn: async () => (await listClasses()).data ?? [], staleTime: 300_000 });
  const suggestion = useMemo(() => suggestedIncreases(raceAbilityBonuses(race?.ability_bonuses)), [race]);
  const visual = useMemo(() => resolveRaceVisual(race?.name ?? 'Human', race?.size), [race]);

  const chooseRace = (next: SRDRace) => {
    const nextVisual = resolveRaceVisual(next.name, next.size);
    if (nextVisual.key !== visual.key) {
      // New body family: keep clothes, hair and eyes; take the race's skin and option defaults.
      setAppearance((prev) => {
        const kept = normalizeAppearance(prev, nextVisual, true);
        const d = defaultAppearance(nextVisual);
        return { ...kept, feature: d.feature, ...(nextVisual.hair ? {} : { hairColor: d.hairColor }), skin: nextVisual.defaults?.skin ?? kept.skin };
      });
    }
    setRace(next);
  };

  const final = abilities?.final;
  const preview = final && klass ? {
    hp: Math.max(1, (klass.hit_die || 8) + abilityMod(final.con)),
    ac: 10 + abilityMod(final.dex),
    speed: race?.speed || 30,
    init: abilityMod(final.dex),
  } : null;

  const stepProblem = [
    race ? '' : 'Elige una raza.',
    '',
    klass ? '' : 'Elige una clase.',
    abilities?.valid ? '' : (abilities?.problem ?? 'Asigna tus características.'),
    name.trim() ? '' : 'Ponle nombre a tu personaje.',
  ];
  const firstBlocked = stepProblem.findIndex(Boolean);
  const canReach = (i: number) => firstBlocked === -1 || i <= firstBlocked;
  const ready = firstBlocked === -1;

  const submit = async () => {
    if (!ready || !abilities || !race || !klass) return;
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

  const next = () => (step === STEPS.length - 1 ? void submit() : setStep((s) => Math.min(STEPS.length - 1, s + 1)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline-lg">Crear personaje</h1>
          <p className="mt-1 text-muted">Elige tu raza, dale forma y color, y luego reparte sus características.</p>
        </div>
        <ol className="flex flex-wrap gap-1.5" aria-label="Pasos">
          {STEPS.map((label, i) => {
            const done = i < step && !stepProblem[i];
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!canReach(i)}
                  onClick={() => setStep(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors disabled:opacity-40 ${i === step ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-card-2'}`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${i === step ? 'bg-accent text-accent-ink' : 'bg-card-3'}`}>{done ? <Check size={12} /> : i + 1}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {error && <ErrorState message={error} />}
      {created && <section role="status" className="rounded-lg border border-warn bg-warn-soft p-4 space-y-2"><p className="font-label-bold">Personaje creado con avisos</p><ul className="list-disc pl-5 text-sm">{created.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><button type="button" onClick={() => navigate(`/campaign/${campaignId}/character/${created.id}`)} className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-bold">Ir a la ficha</button></section>}
      {(races.error || classes.error) && <ErrorState message="No se pudo cargar el catálogo de razas y clases" />}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_auto_minmax(0,1fr)]">
        {/* Stage first on mobile, centre column on desktop. */}
        <section className="avatar-stage order-first flex flex-col items-center gap-3 rounded-2xl border border-line px-6 pb-5 pt-6 lg:sticky lg:top-20 lg:order-none lg:col-start-2 lg:row-start-1">
          <PixelAvatar appearance={appearance} race={race?.name ?? 'Human'} raceSize={race?.size} klass={klass?.name} pulse scale={6} className="max-w-full" />
          <div className="text-center">
            <div className="font-display text-[20px] leading-tight">{name.trim() || 'Sin nombre'}</div>
            <div className="text-[12.5px] text-muted">{race ? splitSource(race.name).base : 'Raza'} · {klass ? splitSource(klass.name).base : 'Clase'}</div>
          </div>
        </section>

        <div className="mc-card flex flex-col gap-4 p-5 lg:col-start-1 lg:row-start-1">
          <div hidden={step !== 0}><RaceStep races={races.data ?? []} loading={races.isLoading} race={race} onChoose={chooseRace} /></div>
          <div hidden={step !== 1}><AppearanceEditor value={appearance} visual={visual} onChange={setAppearance} /></div>
          <div hidden={step !== 2}><ClassStep classes={classes.data ?? []} loading={classes.isLoading} klass={klass} onChoose={setKlass} /></div>
          <div hidden={step !== 3}><AbilityScores campaignId={campaignId} suggestion={suggestion} onChange={setAbilities} /></div>
          <div hidden={step !== 4} className="flex flex-col gap-3">
            <h2 className="mc-eyebrow">Detalles</h2>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className="h-10 px-3" /></label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Trasfondo
              <input value={background} onChange={(e) => setBackground(e.target.value)} maxLength={100} placeholder="Sabio, Soldado, Acólito…" className="h-10 px-3" /></label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Alineamiento
              <select value={alignment} onChange={(e) => setAlignment(e.target.value)} className="h-10 px-2">
                <option value="">—</option>{ALIGNMENTS.map((a) => <option key={a}>{a}</option>)}
              </select></label>
            {preview && (
              <div className="grid grid-cols-4 gap-2 rounded-xl border border-line p-3 text-center">
                {[['PG', preview.hp], ['CA', preview.ac], ['Velocidad', `${preview.speed} pies`], ['Iniciativa', signed(preview.init)]].map(([k, v]) => (
                  <div key={k as string}><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</div><div className="font-mono text-lg font-semibold">{v}</div></div>
                ))}
              </div>
            )}
            <p className="text-[12.5px] text-muted">PG, CA y velocidad se calculan al crear según las reglas de nivel 1.</p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="mc-btn h-10 gap-1 px-4"><ChevronLeft size={16} /> Atrás</button>
            <span className="text-center text-[12.5px] text-muted">{stepProblem[step]}</span>
            <button type="button" onClick={next} disabled={Boolean(stepProblem[step]) || submitting || (step === STEPS.length - 1 && !ready)} className="mc-btn mc-btn-primary h-10 gap-1 px-4">
              {step === STEPS.length - 1 ? (submitting ? 'Creando…' : 'Crear personaje') : <>Siguiente <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-start-3 lg:row-start-1">
          {step === 2 ? <ClassDetail klass={klass} /> : step === 0 || step === 1 ? <RaceDetail race={race} /> : (
            <>
              <RaceDetail race={race} />
              <ClassDetail klass={klass} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
