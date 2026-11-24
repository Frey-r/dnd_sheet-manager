/* NPC sheet tabs in the manager (npc-agenda.md §5): combat sheet, inventory (purse, items, hand-overs) and agenda,
   plus the JSON export of this NPC. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, npcApi } from '../../services/api';
import { formatCP, gpToCP } from '../../services/marketApi';
import { downloadJSON, npcAgendaApi, slug } from '../../services/npcAgendaApi';
import { vttApi } from '../../services/vttApi';
import { getApiError } from '../../services/errors';
import { ErrorState } from '../ui/Feedback';
import { NPCBelongings } from '../market/NPCBelongings';
import { AgendaEditor } from './AgendaEditor';
import { CombatSheetForm, type NPCCombat } from './CombatSheetForm';
import { GiveDialog } from './GiveDialog';
import type { NPC } from '../../types';

type Tab = 'combate' | 'inventario' | 'agenda';

export function NPCSheetTabs({ campaignId, npc }: { campaignId: string; npc: NPC }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('combate');
  const [coins, setCoins] = useState('');
  const [givingCoins, setGivingCoins] = useState(false);
  const [saved, setSaved] = useState('');
  // Same cache as useCampaign (this sheet also renders where there is no auth context, e.g. in tests).
  const charactersQ = useQuery({
    queryKey: ['characters', String(campaignId)],
    queryFn: async () => ((await characterApi.listByCampaign(campaignId)).data ?? []) as { id: number; name: string }[],
    enabled: tab === 'inventario',
  });
  const characters = charactersQ.data ?? [];
  const sheetKey = ['npc-sheet', campaignId, npc.id];
  const sheet = useQuery({ queryKey: sheetKey, queryFn: () => npcAgendaApi.exportOne(campaignId, npc.id) });
  const agenda = useQuery({ queryKey: ['npc-agenda', campaignId, npc.id], queryFn: () => npcAgendaApi.agenda(campaignId, npc.id), enabled: tab === 'agenda' });
  const scenes = useQuery({ queryKey: ['vtt-scenes', campaignId], queryFn: () => vttApi.scenes(campaignId), enabled: tab === 'agenda' });
  const refreshSheet = () => void qc.invalidateQueries({ queryKey: sheetKey });

  const saveCombat = useMutation({
    // stats is one JSON document: keep the rest and replace only stats.combat.
    mutationFn: (combat: NPCCombat) => npcApi.update(campaignId, npc.id, { stats: { ...(npc.stats ?? {}), combat } } as never),
    onSuccess: () => { setSaved('Hoja de combate guardada.'); refreshSheet(); void qc.invalidateQueries({ queryKey: ['npcs', campaignId] }); },
  });
  const purse = useMutation({
    mutationFn: (delta: number) => npcAgendaApi.purse(campaignId, npc.id, { delta_cp: delta }),
    onSuccess: () => { setCoins(''); refreshSheet(); },
  });
  const giveCoins = useMutation({
    mutationFn: ({ characterId, cp }: { characterId: number; cp: number }) => npcAgendaApi.giveCoins(campaignId, npc.id, characterId, cp),
    onSuccess: () => { setGivingCoins(false); refreshSheet(); },
  });
  const purseCP = sheet.data?.inventario?.monedas_cp ?? 0;
  const partyChars = characters.map((c) => ({ id: c.id, name: c.name }));

  return (
    <article className="border border-border-low-contrast rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="mc-seg">
          {([['combate', 'Hoja de combate'], ['inventario', 'Inventario'], ['agenda', 'Agenda']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => { setTab(id); setSaved(''); }}>{label}</button>
          ))}
        </div>
        <span className="grow" />
        <button type="button" className="mc-btn mc-btn-sm" onClick={() => void npcAgendaApi.exportOne(campaignId, npc.id).then((doc) => downloadJSON(`pnj-${slug(npc.name)}.json`, doc))}>
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">download</span>Exportar JSON</button>
      </div>
      {saved && <p role="status" className="text-sm text-ok">{saved}</p>}

      {tab === 'combate' && (sheet.data
        ? <CombatSheetForm key={JSON.stringify(sheet.data.combate)} combat={sheet.data.combate as Partial<NPCCombat>} busy={saveCombat.isPending} onSave={(c) => saveCombat.mutate(c)} />
        : sheet.error ? <ErrorState message={getApiError(sheet.error, 'No se pudo cargar la hoja')} /> : <p className="text-sm text-secondary">Cargando…</p>)}
      {saveCombat.error && <ErrorState message={getApiError(saveCombat.error, 'No se pudo guardar la hoja de combate')} />}

      {tab === 'inventario' && <>
        <section className="flex flex-wrap items-end gap-2">
          <div className="grow"><span className="mc-eyebrow">Bolsa</span><p className="font-stat-number text-xl">{formatCP(purseCP)}</p></div>
          <label className="text-sm font-label-bold">Monedas (po)<input type="number" min={0} step="0.01" className="h-9 w-28 rounded border border-border-low-contrast bg-surface-subtle px-2" value={coins} onChange={(e) => setCoins(e.target.value)} /></label>
          <button type="button" className="mc-btn mc-btn-sm" disabled={!Number(coins) || purse.isPending} onClick={() => purse.mutate(gpToCP(Number(coins)))}>Añadir</button>
          <button type="button" className="mc-btn mc-btn-sm" disabled={!Number(coins) || purse.isPending} onClick={() => purse.mutate(-gpToCP(Number(coins)))}>Quitar</button>
          <button type="button" className="mc-btn mc-btn-sm" disabled={purseCP < 1 || !partyChars.length} onClick={() => setGivingCoins(true)}>Entregar monedas</button>
        </section>
        {purse.error && <ErrorState message={getApiError(purse.error, 'No se pudo actualizar la bolsa')} />}
        {givingCoins && <GiveDialog title="Entregar monedas" characters={partyChars} max={purseCP} unit="monedas" busy={giveCoins.isPending}
          onGive={(characterId, cp) => giveCoins.mutate({ characterId, cp })} onCancel={() => { setGivingCoins(false); giveCoins.reset(); }} />}
        {giveCoins.error && <ErrorState message={getApiError(giveCoins.error, 'No se pudieron entregar las monedas')} />}
        <NPCBelongings campaignId={campaignId} npcId={npc.id} characters={partyChars} />
      </>}

      {tab === 'agenda' && (agenda.data
        ? <AgendaEditor agenda={agenda.data} scenes={(scenes.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
            onSave={async (next) => {
              const stored = await npcAgendaApi.saveAgenda(campaignId, npc.id, next);
              qc.setQueryData(['npc-agenda', campaignId, npc.id], stored);
              setSaved('Agenda guardada. Se aplica al mover el reloj o con «Reaplicar agenda».');
            }} />
        : <p className="text-sm text-secondary">Cargando…</p>)}
    </article>
  );
}
