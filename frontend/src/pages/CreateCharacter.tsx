import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, contentApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ContentEntries } from '../components/content/ContentEntries';
import { ErrorState, LoadingState } from '../components/ui/Feedback';

type ContentSummary = { id: number; name: string; source: string; is_srd: boolean; type: string };
type ContentDetail = ContentSummary & { data: Record<string, unknown> };
type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

const ABILITIES: [Ability, string, string][] = [['str', 'FUE', 'Fuerza'], ['dex', 'DES', 'Destreza'], ['con', 'CON', 'Constitución'], ['int', 'INT', 'Inteligencia'], ['wis', 'SAB', 'Sabiduría'], ['cha', 'CAR', 'Carisma']];
const STANDARD = [15, 14, 13, 12, 10, 8];
const mod = (s: number) => Math.floor((s - 10) / 2);
const sign = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export function CreateCharacterPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRace, setSelectedRace] = useState<ContentSummary | null>(null);
  const [selectedClass, setSelectedClass] = useState<ContentSummary | null>(null);
  const [background, setBackground] = useState('');
  const [alignment, setAlignment] = useState('');
  const [method, setMethod] = useState<'standard' | 'manual'>('standard');
  const [assigned, setAssigned] = useState<Record<Ability, number>>({ str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 });
  const [manual, setManual] = useState<Record<Ability, number>>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const races = useQuery({ queryKey: ['content', 'race', search], queryFn: () => contentApi.search({ type: 'race', query: search, limit: 100 }).then((r) => r.data.data as ContentSummary[]) });
  const classes = useQuery({ queryKey: ['content', 'class', search], queryFn: () => contentApi.search({ type: 'class', query: search, limit: 100 }).then((r) => r.data.data as ContentSummary[]) });
  const raceDetail = useQuery({ queryKey: ['content-detail', selectedRace?.id], enabled: Boolean(selectedRace), queryFn: () => contentApi.get(selectedRace!.id).then((r) => r.data as ContentDetail) });
  const classDetail = useQuery({ queryKey: ['content-detail', selectedClass?.id], enabled: Boolean(selectedClass), queryFn: () => contentApi.get(selectedClass!.id).then((r) => r.data as ContentDetail) });

  const scores = Object.fromEntries(ABILITIES.map(([k]) => [k, method === 'standard' ? STANDARD[assigned[k]] : manual[k]])) as Record<Ability, number>;
  const usedSlots = Object.values(assigned);
  const duplicated = method === 'standard' && new Set(usedSlots).size !== usedSlots.length;
  const outOfRange = method === 'manual' && Object.values(manual).some((v) => v < 3 || v > 20);

  // Swap values when the player picks a value already used (keeps the array a permutation).
  const assign = (k: Ability, slot: number) => setAssigned((a) => {
    const other = (Object.keys(a) as Ability[]).find((x) => a[x] === slot && x !== k);
    return other ? { ...a, [k]: slot, [other]: a[k] } : { ...a, [k]: slot };
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !campaignId || !selectedRace || !selectedClass || duplicated || outOfRange) return;
    setSubmitting(true); setError('');
    try {
      const response = await characterApi.create({
        name: name.trim(), race: selectedRace.name, class: selectedClass.name, campaign_id: Number(campaignId),
        background: background.trim(), alignment, str_score: scores.str, dex_score: scores.dex, con_score: scores.con,
        int_score: scores.int, wis_score: scores.wis, cha_score: scores.cha,
      });
      void qc.invalidateQueries({ queryKey: ['characters', String(campaignId)] });
      navigate(`/campaign/${campaignId}/character/${response.data.id}`);
    } catch (requestError) {
      setError(getApiError(requestError, 'No se pudo crear el personaje'));
    } finally { setSubmitting(false); }
  };

  const options = (items: ContentSummary[] | undefined, selected: ContentSummary | null, choose: (item: ContentSummary) => void) => (
    <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
      {items?.map((item) => (
        <button type="button" key={item.id} onClick={() => choose(item)} className={`w-full px-3 py-2 text-left transition-colors ${selected?.id === item.id ? 'bg-accent-soft text-accent' : 'hover:bg-card-2'}`}>
          <span className="font-medium">{item.name}</span><span className="ml-2 text-xs text-muted">{item.source}{item.is_srd ? ' · SRD' : ''}</span>
        </button>
      ))}
      {items?.length === 0 && <p className="p-4 text-muted">No hay resultados. Importa el catálogo antes de crear personajes.</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="font-headline-lg">Crear personaje</h1><p className="mt-1 text-muted">Elige raza y clase con sus reglas a la vista. PG, CA y velocidad se calculan al crear según las reglas de nivel 1.</p></div>
      <input aria-label="Buscar raza o clase" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en todas las fuentes importadas…" className="h-10 w-full px-3" />
      {error && <ErrorState message={error} />}
      {(races.error || classes.error) && <ErrorState message="No se pudo cargar el catálogo" />}
      <form onSubmit={handleSubmit} className="grid items-start gap-5 lg:grid-cols-2">
        <div className="mc-card flex flex-col gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2 sm:col-span-3">Nombre<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className="h-10 px-3" /></label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2 sm:col-span-2">Trasfondo<input value={background} onChange={(e) => setBackground(e.target.value)} maxLength={100} placeholder="Sabio, Soldado, Acólito…" className="h-10 px-3" /></label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Alineamiento
              <select value={alignment} onChange={(e) => setAlignment(e.target.value)} className="h-10 px-2">
                <option value="">—</option>{['Legal bueno', 'Neutral bueno', 'Caótico bueno', 'Legal neutral', 'Neutral', 'Caótico neutral', 'Legal malvado', 'Neutral malvado', 'Caótico malvado'].map((a) => <option key={a}>{a}</option>)}
              </select></label>
          </div>
          <section><h2 className="mc-eyebrow mb-2">Raza o especie</h2>{races.isLoading ? <LoadingState /> : options(races.data, selectedRace, setSelectedRace)}</section>
          <section><h2 className="mc-eyebrow mb-2">Clase</h2>{classes.isLoading ? <LoadingState /> : options(classes.data, selectedClass, setSelectedClass)}</section>
          <section>
            <div className="mb-2 flex items-center gap-2"><h2 className="mc-eyebrow">Características</h2>
              <div className="mc-seg ml-auto"><button type="button" aria-pressed={method === 'standard'} onClick={() => setMethod('standard')}>Matriz estándar</button><button type="button" aria-pressed={method === 'manual'} onClick={() => setMethod('manual')}>Manual / tiradas</button></div></div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ABILITIES.map(([k, abbr, full]) => (
                <div key={k} className="rounded-xl border border-line bg-card-2 p-2 text-center" title={full}>
                  <div className="text-[11px] font-semibold tracking-wider text-muted">{abbr}</div>
                  <div className="font-mono text-2xl font-semibold tracking-tighter">{sign(mod(scores[k]))}</div>
                  {method === 'standard' ? (
                    <select aria-label={full} value={assigned[k]} onChange={(e) => assign(k, Number(e.target.value))} className="mt-1 h-8 w-full px-1 text-center font-mono text-sm">
                      {STANDARD.map((v, i) => <option key={i} value={i}>{v}</option>)}
                    </select>
                  ) : (
                    <input aria-label={full} type="number" min={3} max={20} value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: Number(e.target.value) })} className="mt-1 h-8 w-full px-1 text-center font-mono text-sm" />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{method === 'standard' ? 'Reparte 15, 14, 13, 12, 10 y 8. Suma después los bonificadores raciales en la hoja.' : 'Introduce valores entre 3 y 20 (por ejemplo, tus tiradas de 4d6).'}</p>
            {outOfRange && <p className="mt-1 text-xs text-bad">Cada característica debe estar entre 3 y 20.</p>}
          </section>
          <button type="submit" disabled={submitting || !name.trim() || !selectedRace || !selectedClass || duplicated || outOfRange} className="mc-btn mc-btn-primary h-11 w-full">{submitting ? 'Creando…' : 'Crear personaje'}</button>
        </div>
        <div className="flex flex-col gap-4">
          {[raceDetail, classDetail].map((detail, index) => (
            <section key={index} className="mc-card max-h-[42rem] overflow-y-auto p-5">
              <h2 className="font-headline-md">{index === 0 ? 'Detalles de la raza' : 'Detalles de la clase'}</h2>
              {detail.data ? <><p className="mb-3 text-sm text-muted">{detail.data.name} · {detail.data.source}{detail.data.is_srd ? ' · SRD' : ' · Contenido adicional'}</p><ContentEntries data={detail.data.data} /></> : <p className="mt-2 text-muted">Selecciona una entrada para consultar sus reglas.</p>}
            </section>
          ))}
        </div>
      </form>
    </div>
  );
}
