/* Ability scores for a new character: standard array, point buy, server rolls (4d6 drop lowest)
   or manual, plus +2/+1 or +1/+1/+1 increases (characters.md, "Character Creation"). */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ABILITIES, abilityMod, signed, type Ability, type Method, type Scores, type StatRoll } from '../../lib/abilities';

const STANDARD = [15, 14, 13, 12, 10, 8];
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINTS = 27;

export interface AbilityState {
  method: Method;
  base: Scores;
  final: Scores;
  rollId: number | null;
  valid: boolean;
  problem?: string;
}

const permutationAssign = (setter: React.Dispatch<React.SetStateAction<Record<Ability, number>>>, k: Ability, slot: number) =>
  setter((a) => {
    const other = (Object.keys(a) as Ability[]).find((x) => a[x] === slot && x !== k);
    return other ? { ...a, [k]: slot, [other]: a[k] } : { ...a, [k]: slot };
  });

export function AbilityScores({ campaignId, onChange, suggestion }: {
  campaignId: string;
  onChange: (s: AbilityState) => void;
  suggestion: { plus2: Ability | ''; plus1: Ability | '' } | null;
}) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<Method>('standard');
  const [slots, setSlots] = useState<Record<Ability, number>>({ str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 });
  const [rollSlots, setRollSlots] = useState<Record<Ability, number>>({ str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 });
  const [buy, setBuy] = useState<Scores>({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [manual, setManual] = useState<Scores>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const [incMode, setIncMode] = useState<'21' | '111'>('21');
  const [plus2, setPlus2] = useState<Ability | ''>(suggestion?.plus2 ?? '');
  const [plus1, setPlus1] = useState<Ability | ''>(suggestion?.plus1 ?? '');
  const [triple, setTriple] = useState<Ability[]>([]);
  const [revealed, setRevealed] = useState(6);
  const [lastSuggestion, setLastSuggestion] = useState(suggestion);

  // Adopt a new race suggestion (adjusting state while rendering, React's documented pattern).
  if (suggestion !== lastSuggestion) {
    setLastSuggestion(suggestion);
    if (suggestion) { setIncMode('21'); setPlus2(suggestion.plus2); setPlus1(suggestion.plus1); }
  }

  const rolls = useQuery({
    queryKey: ['stat-rolls', campaignId],
    queryFn: async () => (await api.get<{ current: StatRoll | null }>(`/campaigns/${campaignId}/stat-rolls`)).data.current,
    enabled: method === 'roll',
  });
  const roll = useMutation({
    mutationFn: async () => (await api.post<StatRoll>(`/campaigns/${campaignId}/stat-rolls`)).data,
    onSuccess: (r) => {
      qc.setQueryData(['stat-rolls', campaignId], r);
      setRevealed(0);
      for (let i = 1; i <= 6; i++) setTimeout(() => setRevealed(i), i * 420);
    },
  });
  const current = rolls.data ?? null;

  // ---- derive scores ----
  const pointsSpent = Object.values(buy).reduce((s, v) => s + POINT_COST[v], 0);
  let base: Scores;
  if (method === 'standard') base = Object.fromEntries(ABILITIES.map(([k]) => [k, STANDARD[slots[k]]])) as Scores;
  else if (method === 'pointbuy') base = buy;
  else if (method === 'roll') base = Object.fromEntries(ABILITIES.map(([k]) => [k, current ? current.totals[rollSlots[k]] : 10])) as Scores;
  else base = manual;

  const inc: Partial<Record<Ability, number>> = {};
  if (incMode === '21') {
    if (plus2) inc[plus2] = 2;
    if (plus1 && plus1 !== plus2) inc[plus1] = (inc[plus1] ?? 0) + 1;
  } else for (const a of triple) inc[a] = 1;
  const final = Object.fromEntries(ABILITIES.map(([k]) => [k, Math.min(20, base[k] + (inc[k] ?? 0))])) as Scores;

  let problem: string | undefined;
  if (method === 'pointbuy' && pointsSpent > POINTS) problem = `Te pasaste ${pointsSpent - POINTS} puntos.`;
  if (method === 'manual' && Object.values(manual).some((v) => v < 3 || v > 20)) problem = 'Cada característica debe estar entre 3 y 20.';
  if (method === 'roll' && !current) problem = 'Haz tus tiradas primero.';
  const state: AbilityState = { method, base, final, rollId: method === 'roll' ? current?.id ?? null : null, valid: !problem, problem };
  const key = JSON.stringify(state);
  const notify = useRef(onChange);
  useEffect(() => { notify.current = onChange; });
  useEffect(() => { notify.current(JSON.parse(key) as AbilityState); }, [key]);

  const tabs: [Method, string][] = [['standard', 'Matriz estándar'], ['pointbuy', 'Compra de puntos'], ['roll', 'Tiradas 4d6'], ['manual', 'Manual']];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mc-eyebrow">Características</h2>
        <div className="mc-seg ml-auto flex-wrap" role="group" aria-label="Método">
          {tabs.map(([m, t]) => <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>{t}</button>)}
        </div>
      </div>

      {method === 'roll' && (
        <div className="rounded-xl border border-line bg-card-2 p-3">
          {!current ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-[13.5px] text-muted">Tira 4d6 seis veces y se suman los tres dados más altos de cada tirada. Las tiradas las hace el servidor y quedan guardadas: no se pueden repetir recargando.</p>
              <button type="button" className="mc-btn mc-btn-primary" disabled={roll.isPending || rolls.isLoading} onClick={() => roll.mutate()}>
                <span className="material-symbols-outlined text-[18px]">casino</span>{roll.isPending ? 'Tirando…' : 'Tirar 4d6 × 6'}
              </button>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {current.dice.map((set, i) => {
                  const shown = i < revealed;
                  const drop = set.indexOf(Math.min(...set));
                  return (
                    <li key={i} className={`flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-2 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}>
                      <span className="flex gap-1">
                        {set.map((d, j) => (
                          <span key={j} className={`grid h-7 w-7 place-items-center rounded-md border font-mono text-[13px] ${j === drop ? 'border-line text-faint line-through' : 'border-line-strong bg-card-2 text-ink'}`}>{d}</span>
                        ))}
                      </span>
                      <span className="ml-auto font-mono text-[18px] font-semibold">{current.totals[i]}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[12.5px] text-muted">Asigna cada resultado a una característica. Si el DM lo permite, puede descartar esta tirada para que vuelvas a tirar.</p>
            </>
          )}
          {roll.isError && <p className="mt-2 text-[13px] text-bad">No se pudo tirar.</p>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map(([k, abbr, full]) => (
          <div key={k} className="flex flex-col items-center rounded-xl border border-line bg-card-2 p-2 text-center" title={full}>
            <div className="text-[11px] font-semibold tracking-wider text-muted">{abbr}</div>
            <div className="font-mono text-2xl font-semibold tracking-tighter">{final[k]}</div>
            <div className="font-mono text-[13px] text-accent">{signed(abilityMod(final[k]))}</div>
            {inc[k] ? <div className="text-[11px] text-ok">base {base[k]} +{inc[k]}</div> : <div className="text-[11px] text-faint">base {base[k]}</div>}
            {method === 'standard' && (
              <select aria-label={full} value={slots[k]} onChange={(e) => permutationAssign(setSlots, k, Number(e.target.value))} className="mt-1 h-8 w-full px-1 text-center font-mono text-sm">
                {STANDARD.map((v, i) => <option key={i} value={i}>{v}</option>)}
              </select>
            )}
            {method === 'roll' && current && (
              <select aria-label={full} value={rollSlots[k]} onChange={(e) => permutationAssign(setRollSlots, k, Number(e.target.value))} className="mt-1 h-8 w-full px-1 text-center font-mono text-sm">
                {current.totals.map((v, i) => <option key={i} value={i}>{v}</option>)}
              </select>
            )}
            {method === 'pointbuy' && (
              <div className="mt-1 flex items-center gap-1">
                <button type="button" className="grid h-7 w-7 place-items-center rounded-md border border-line disabled:opacity-40" aria-label={`Bajar ${full}`} disabled={buy[k] <= 8} onClick={() => setBuy({ ...buy, [k]: buy[k] - 1 })}>−</button>
                <button type="button" className="grid h-7 w-7 place-items-center rounded-md border border-line disabled:opacity-40" aria-label={`Subir ${full}`}
                  disabled={buy[k] >= 15 || pointsSpent - POINT_COST[buy[k]] + POINT_COST[buy[k] + 1] > POINTS} onClick={() => setBuy({ ...buy, [k]: buy[k] + 1 })}>+</button>
              </div>
            )}
            {method === 'manual' && (
              <input aria-label={full} type="number" min={3} max={20} value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: Number(e.target.value) })} className="mt-1 h-8 w-full px-1 text-center font-mono text-sm" />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        {method === 'standard' && 'Reparte 15, 14, 13, 12, 10 y 8.'}
        {method === 'pointbuy' && `Puntos: ${POINTS - pointsSpent} de ${POINTS} disponibles · cada característica entre 8 y 15 (14 y 15 cuestan 2 puntos por paso).`}
        {method === 'manual' && 'Valores entre 3 y 20, por ejemplo tiradas hechas en la mesa.'}
        {method === 'roll' && current && 'Cada resultado se usa una vez.'}
      </p>

      <div className="rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-semibold">Mejoras de característica</h3>
          <div className="mc-seg ml-auto" role="group" aria-label="Tipo de mejora">
            <button type="button" aria-pressed={incMode === '21'} onClick={() => setIncMode('21')}>+2 / +1</button>
            <button type="button" aria-pressed={incMode === '111'} onClick={() => setIncMode('111')}>+1 / +1 / +1</button>
          </div>
        </div>
        {incMode === '21' ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">+2 a
              <select value={plus2} onChange={(e) => setPlus2(e.target.value as Ability | '')} className="h-9 px-2">
                <option value="">—</option>{ABILITIES.map(([k, , full]) => <option key={k} value={k}>{full}</option>)}
              </select></label>
            <label className="flex flex-col gap-1 text-[12.5px] text-ink-2">+1 a
              <select value={plus1} onChange={(e) => setPlus1(e.target.value as Ability | '')} className="h-9 px-2">
                <option value="">—</option>{ABILITIES.filter(([k]) => k !== plus2).map(([k, , full]) => <option key={k} value={k}>{full}</option>)}
              </select></label>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ABILITIES.map(([k, abbr]) => {
              const on = triple.includes(k);
              return <button key={k} type="button" aria-pressed={on} className={`mc-badge cursor-pointer ${on ? 'border-accent text-accent' : ''}`}
                onClick={() => setTriple(on ? triple.filter((x) => x !== k) : triple.length < 3 ? [...triple, k] : triple)}>{abbr}</button>;
            })}
          </div>
        )}
        <p className="mt-2 text-[12px] text-muted">Reglas 2024: las da el trasfondo. Reglas 2014: las de tu raza (se proponen solas si el catálogo las trae). Máximo 20.</p>
      </div>
      {problem && <p className="text-[13px] text-bad">{problem}</p>}
    </section>
  );
}
