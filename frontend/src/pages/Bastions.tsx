/* Bastiones: players manage their Bastion, the GM runs turns and edits the catalogue (market-bastions.md §6). */
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCampaign } from '../lib/useCampaign';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { bastionApi, BASIC_KINDS, type TurnSummary } from '../services/bastionApi';
import { BastionView } from '../components/bastion/BastionView';
import { CatalogEditor } from '../components/bastion/CatalogEditor';
import { AppraisalPanel } from '../components/bastion/AppraisalPanel';

const field = 'w-full rounded-lg border border-line bg-card-2 px-3 text-[14px] outline-none focus:border-accent';
const label = 'flex flex-col gap-1.5 text-[13px] font-medium';

type Tab = 'bastions' | 'catalog' | 'appraisal';

export function Bastions() {
  const { campaignId = '' } = useParams<{ campaignId: string }>();
  const { isGM, myCharacter, characters } = useCampaign(campaignId);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('bastions');
  const [turn, setTurn] = useState<TurnSummary | null>(null);
  const [turnError, setTurnError] = useState('');
  const list = useQuery({ queryKey: ['bastions', campaignId], queryFn: () => bastionApi.list(campaignId), enabled: Boolean(campaignId) });
  const runTurn = useMutation({
    mutationFn: () => bastionApi.turn(campaignId),
    onSuccess: (t) => {
      setTurn(t); setTurnError('');
      void qc.invalidateQueries({ queryKey: ['bastions', campaignId] });
      void qc.invalidateQueries({ queryKey: ['bastion', campaignId] });
      void qc.invalidateQueries({ queryKey: ['characters', campaignId] });
    },
    onError: (e) => setTurnError(getApiError(e)),
  });

  const bastions = list.data?.bastions ?? [];
  const selected = Number(params.get('b')) || bastions[0]?.id || null;
  const select = (id: number) => setParams({ b: String(id) });
  const hasMine = bastions.some((b) => b.character_id === myCharacter?.id);
  const canFound = isGM || (Boolean(myCharacter) && !hasMine);
  const withoutBastion = characters.filter((c) => !bastions.some((b) => b.character_id === c.id));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mc-eyebrow">Partida</div>
          <h1 className="font-display text-[28px] leading-tight">Bastiones</h1>
          <p className="mt-1 text-[14px] text-muted">
            {isGM ? 'Los bastiones del grupo. Cada turno de bastión son 7 días de juego.' : 'Tu fortaleza: instalaciones, órdenes por turno y los bienes que produce.'}
          </p>
        </div>
        {isGM && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="mc-seg" role="group" aria-label="Sección">
              <button type="button" aria-pressed={tab === 'bastions'} onClick={() => setTab('bastions')}>Bastiones</button>
              <button type="button" aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}>Catálogo</button>
              <button type="button" aria-pressed={tab === 'appraisal'} onClick={() => setTab('appraisal')}>Tasación</button>
            </div>
            <button type="button" className="mc-btn mc-btn-primary" disabled={runTurn.isPending || bastions.length === 0}
              onClick={() => { if (window.confirm('¿Ejecutar un turno de bastión (7 días) para todos los bastiones?')) runTurn.mutate(); }}>
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>{runTurn.isPending ? 'Ejecutando…' : 'Ejecutar turno'}
            </button>
          </div>
        )}
      </header>

      {turnError && <ErrorState message={turnError} />}
      {turn && <TurnReport turn={turn} onClose={() => setTurn(null)} />}

      {isGM && tab === 'catalog' && <CatalogEditor campaignId={campaignId} />}
      {isGM && tab === 'appraisal' && <AppraisalPanel campaignId={campaignId} />}
      {(!isGM || tab === 'bastions') && (
        list.isLoading ? <LoadingState /> :
        list.isError ? <ErrorState message={getApiError(list.error, 'No se pudieron cargar los bastiones')} onRetry={() => void list.refetch()} /> : (
          <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-2">
              {bastions.map((b) => (
                <button key={b.id} type="button" onClick={() => select(b.id)} aria-pressed={selected === b.id}
                  className={`mc-card flex items-center gap-3 p-3 text-left hover:border-line-strong ${selected === b.id ? 'border-accent' : ''}`}>
                  <span className="material-symbols-outlined text-gold">castle</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">{b.character_name} · {b.facilities.length} instalaciones</span>
                  </span>
                </button>
              ))}
              {bastions.length === 0 && <p className="mc-card p-4 text-[13.5px] text-muted">{isGM ? 'Ningún personaje ha fundado un bastión todavía.' : 'Aún no tienes un bastión.'}</p>}
              {canFound && <FoundForm campaignId={campaignId} isGM={isGM} level={myCharacter?.level ?? 1} characters={isGM ? withoutBastion : []} onFounded={select} />}
            </aside>
            <section className="min-w-0">
              {selected ? <BastionView key={selected} campaignId={campaignId} bastionId={selected} isGM={isGM} /> : (
                <div className="mc-card flex min-h-[220px] flex-col items-center justify-center gap-2 p-8 text-center text-muted">
                  <span className="material-symbols-outlined text-[30px] text-faint">castle</span>
                  {isGM ? 'Cuando un personaje funde su bastión aparecerá aquí.' : 'Un personaje de nivel 5 o más puede fundar un bastión.'}
                </div>
              )}
            </section>
          </div>
        )
      )}
    </div>
  );
}

function TurnReport({ turn, onClose }: { turn: TurnSummary; onClose: () => void }) {
  return (
    <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="turn-h">
      <div className="flex items-center justify-between">
        <h2 id="turn-h" className="font-display text-[20px]">Turno {turn.turn} resuelto</h2>
        <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onClose}>Cerrar</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {turn.results.map((r) => (
          <div key={r.bastion_id} className="rounded-lg border border-line bg-card-2 p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2"><b>{r.name}</b><span className="text-[12.5px] text-muted">{r.owner}</span>{r.event && <span className="mc-badge">{r.event}</span>}</div>
            <ul className="list-disc pl-5 text-[13.5px]">{r.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function FoundForm({ campaignId, isGM, level, characters, onFounded }: {
  campaignId: string; isGM: boolean; level: number; characters: { id: number; name: string }[]; onFounded: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [kinds, setKinds] = useState(['bedroom', 'parlor']);
  const [error, setError] = useState('');
  const found = useMutation({
    mutationFn: () => bastionApi.found(campaignId, { name, description, basic_kinds: kinds, ...(isGM ? { character_id: Number(characterId) } : {}) }),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ['bastions', campaignId] });
      setOpen(false); setName(''); setDescription(''); setError('');
      onFounded(d.bastion.id);
    },
    onError: (e) => setError(getApiError(e)),
  });
  const blocked = !isGM && level < 5;
  if (!open) {
    return <button type="button" className="mc-btn mc-btn-primary" onClick={() => setOpen(true)}><span className="material-symbols-outlined text-[18px]">add</span>Fundar bastión</button>;
  }
  return (
    <form className="mc-card flex flex-col gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (name.trim() && !blocked && (!isGM || characterId)) found.mutate(); }}>
      <h2 className="font-display text-[17px]">Fundar un bastión</h2>
      {blocked && <p className="text-[13px] text-warn">Necesitas nivel 5 (ahora nivel {level}). El DM puede fundarlo antes.</p>}
      {isGM && (
        <label className={label}>Personaje dueño
          <select className={`${field} h-10`} value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
            <option value="">— Elige —</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <label className={label}>Nombre
        <input className={`${field} h-10`} value={name} maxLength={160} placeholder="Torre del Cuervo" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={label}>Descripción
        <textarea className={`${field} min-h-[60px] py-2`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {[0, 1].map((i) => (
        <label key={i} className={label}>{i === 0 ? 'Instalación reducida inicial' : 'Instalación amplia inicial'}
          <select className={`${field} h-10`} value={kinds[i]} onChange={(e) => setKinds(kinds.map((k, j) => (j === i ? e.target.value : k)))}>
            {BASIC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
      ))}
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="mc-btn mc-btn-primary" disabled={found.isPending || blocked || !name.trim() || (isGM && !characterId)}>{found.isPending ? 'Fundando…' : 'Fundar'}</button>
        <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
