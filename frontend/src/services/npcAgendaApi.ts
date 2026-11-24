/* Game clock, NPC agenda, NPC sheets and hand-overs (openspec/specs/npc-agenda.md §6). */
import { api } from './api';
import type { AgendaEntry, ApplySummary, GameClock, TimeOfDay, Whereabout } from '../lib/npc/agenda';

const c = (id: number | string) => `/campaigns/${id}`;

export interface NPCDocument {
  version: number;
  pj: { id?: number; nombre: string; rol?: string; relacion?: string; raza?: string; clase?: string };
  combate?: Record<string, unknown>;
  inventario?: { monedas_cp: number; objetos: Record<string, unknown>[] };
  agenda?: AgendaEntry[];
}
export interface ImportReport { dry_run: boolean; aplicado: { npc_id: number; nombre: string; secciones: string[] }[] }

export const npcAgendaApi = {
  clock: async (cid: number | string) => (await api.get<GameClock>(`${c(cid)}/clock`)).data,
  setClock: async (cid: number | string, change: { step?: number; game_day?: number; time_of_day?: TimeOfDay; first_weekday?: string }) =>
    (await api.put<{ clock: GameClock; summary: ApplySummary }>(`${c(cid)}/clock`, change)).data,
  applyAgendas: async (cid: number | string) => (await api.post<{ summary: ApplySummary }>(`${c(cid)}/clock/apply`)).data.summary,
  agenda: async (cid: number | string, npcId: number) => (await api.get<AgendaEntry[]>(`${c(cid)}/npcs/${npcId}/agenda`)).data ?? [],
  saveAgenda: async (cid: number | string, npcId: number, agenda: AgendaEntry[]) =>
    (await api.put<AgendaEntry[]>(`${c(cid)}/npcs/${npcId}/agenda`, agenda)).data ?? [],
  exportOne: async (cid: number | string, npcId: number) => (await api.get<NPCDocument>(`${c(cid)}/npcs/${npcId}/sheet`)).data,
  exportAll: async (cid: number | string, sections?: string[]) =>
    (await api.get<NPCDocument[]>(`${c(cid)}/npc-sheets`, { params: sections?.length ? { secciones: sections.join(',') } : undefined })).data ?? [],
  importSheets: async (cid: number | string, body: unknown, opts: { dryRun?: boolean; updateData?: boolean } = {}) =>
    (await api.post<ImportReport>(`${c(cid)}/npc-sheets/import`, body, { params: { dry_run: opts.dryRun ? 1 : undefined, actualizar_datos: opts.updateData ? 1 : undefined } })).data,
  whereabouts: async (cid: number | string) => (await api.get<Whereabout[]>(`${c(cid)}/npc-whereabouts`)).data ?? [],
  purse: async (cid: number | string, npcId: number, change: { delta_cp?: number; set_cp?: number }) =>
    (await api.put<{ purse_cp: number }>(`${c(cid)}/npcs/${npcId}/purse`, change)).data.purse_cp,
  giveItem: (cid: number | string, itemId: number, characterId: number, quantity: number) =>
    api.post(`${c(cid)}/npc-items/${itemId}/give`, { character_id: characterId, quantity }),
  giveCoins: (cid: number | string, npcId: number, characterId: number, amountCp: number) =>
    api.post(`${c(cid)}/npcs/${npcId}/give-coins`, { character_id: characterId, amount_cp: amountCp }),
};

/** Downloads a JSON document as a file. */
export function downloadJSON(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A safe file name piece from an NPC or campaign name. */
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pnj';
