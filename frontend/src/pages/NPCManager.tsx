/* NPC list (frontend-screens.md § 10.1): cards with the NPC pixel head crop (or the uploaded portrait,
   or the initials); "Añadir NPC" and "Editar" open the NPC creator (character-appearance.md § NPC creator).
   «Dónde están ahora» (npc-agenda.md §5): the game clock, where every NPC is and the JSON import/export. */
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CampaignResourcePanel, type Resource } from '../components/content/CampaignResourcePanel';
import { NPCPortrait } from '../components/avatar/NPCPortrait';
import { GameClockBar } from '../components/npc/GameClockBar';
import { WhereaboutsView } from '../components/npc/WhereaboutsView';
import { problemsOf, summaryText } from '../lib/npc/agenda';
import { downloadJSON, npcAgendaApi, slug, type ImportReport } from '../services/npcAgendaApi';
import { vttApi } from '../services/vttApi';
import type { NPC } from '../types';

const FRAME = 'avatar-stage grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-low-contrast text-xl text-secondary';
const thumbnail = (npc: Resource) => <NPCPortrait npc={npc as unknown as NPC} crop="bust" scale={2} frame={FRAME} />;

function Whereabouts({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean; list?: string[] } | null>(null);
  const [pending, setPending] = useState<{ body: unknown; report: ImportReport; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const clock = useQuery({ queryKey: ['clock', campaignId], queryFn: () => npcAgendaApi.clock(campaignId) });
  const rows = useQuery({ queryKey: ['npc-whereabouts', campaignId], queryFn: () => npcAgendaApi.whereabouts(campaignId) });
  const scenes = useQuery({ queryKey: ['vtt-scenes', campaignId], queryFn: () => vttApi.scenes(campaignId) });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['clock', campaignId] }); void qc.invalidateQueries({ queryKey: ['npc-whereabouts', campaignId] }); };
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try { setNote({ text: await fn() }); refresh(); } catch (err) { setNote({ text: 'No se pudo completar.', bad: true, list: problemsOf(err) }); } finally { setBusy(false); }
  };

  const onFile = async (file: File) => {
    let body: unknown;
    try { body = JSON.parse(await file.text()); } catch { setNote({ text: `${file.name} no es un JSON válido.`, bad: true }); return; }
    try {
      const report = await npcAgendaApi.importSheets(campaignId, body, { dryRun: true });
      setPending({ body, report, name: file.name });
      setNote(null);
    } catch (err) { setNote({ text: `${file.name} tiene errores; no se importó nada.`, bad: true, list: problemsOf(err) }); }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {clock.data && <GameClockBar clock={clock.data} isGM busy={busy}
          onStep={(step) => void run(async () => summaryText((await npcAgendaApi.setClock(campaignId, { step })).summary))}
          onApply={() => void run(async () => summaryText(await npcAgendaApi.applyAgendas(campaignId)))} />}
        <span className="grow" />
        <button type="button" className="mc-btn mc-btn-sm" onClick={() => void npcAgendaApi.exportAll(campaignId).then((docs) => downloadJSON(`pnjs-${slug(String(campaignId))}.json`, docs))}>
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">download</span>Exportar todos</button>
        <button type="button" className="mc-btn mc-btn-sm" onClick={() => fileRef.current?.click()}>
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">upload</span>Importar JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Archivo de PNJ (JSON)"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onFile(f); }} />
      </div>
      {note && (
        <div role={note.bad ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-[13px] ${note.bad ? 'border-bad text-bad' : 'border-line text-ink-2'}`}>
          {note.text}{note.list && <ul className="mt-1 list-disc pl-4">{note.list.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}
      {pending && (
        <div className="mc-card flex flex-col gap-2 p-3 text-[13px]">
          <b>Importar {pending.name}</b>
          <ul className="list-disc pl-4">{pending.report.aplicado.map((a) => <li key={a.npc_id}>{a.nombre}: {a.secciones.join(', ') || 'nada que cambiar'}</li>)}</ul>
          <p className="text-xs text-muted">Cada sección reemplaza la actual del PNJ; las que no vienen en el archivo no se tocan.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="mc-btn mc-btn-sm" onClick={() => setPending(null)}>Cancelar</button>
            <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" disabled={busy} onClick={() => void run(async () => {
              const r = await npcAgendaApi.importSheets(campaignId, pending.body);
              setPending(null);
              return `Importados ${r.aplicado.length} PNJ.`;
            })}>Importar</button>
          </div>
        </div>
      )}
      <WhereaboutsView rows={rows.data ?? []} scenes={(scenes.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        onOpen={(id) => navigate(`/campaign/${campaignId}/gm/npcs/${id}`)} />
    </section>
  );
}

export function NPCManager() {
  const { campaignId = '' } = useParams();
  const [tab, setTab] = useState<'list' | 'where'>('list');
  return (
    <div className="flex flex-col gap-3">
      <div className="mc-seg mx-4 mt-4 w-fit md:mx-8" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'list'} aria-pressed={tab === 'list'} onClick={() => setTab('list')}>PNJ</button>
        <button type="button" role="tab" aria-selected={tab === 'where'} aria-pressed={tab === 'where'} onClick={() => setTab('where')}>Dónde están ahora</button>
      </div>
      {tab === 'list'
        ? <CampaignResourcePanel kind="npcs" title="NPCs" linkBase="npcs" fields={[]} editorPage thumbnail={thumbnail} />
        : <div className="px-4 pb-8 md:px-8"><Whereabouts campaignId={campaignId} /></div>}
    </div>
  );
}
