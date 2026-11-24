import { api } from './api';

// Market API (openspec/specs/market-bastions.md §7).

export type Availability = 'open' | 'closed' | 'scene';

export interface Shop {
  id: number;
  campaign_id: number;
  name: string;
  description: string;
  icon: string;
  npc_id: number | null;
  availability: Availability;
  scene_id: number | null;
  object_id: number | null;
  price_pct: number;
  buy_rate_pct: number;
  buys_types: string[];
  available: boolean;
  reason?: string;
  npc_name?: string;
  scene_name?: string;
  item_count: number;
}

export interface ShopItem {
  id: number;
  shop_id: number;
  name: string;
  item_type: string;
  rarity: string;
  price_cp: number;
  final_price_cp: number;
  weight: number;
  description: string;
  attunement_required: boolean;
  srd_ref_id: number | null;
  srd_kind: string | null;
  stock: number;
}

export interface SellOffer {
  id: number;
  name: string;
  item_type: string;
  quantity: number;
  value_cp: number | null;
  blocked: boolean;
  offer_cp: number;
  reason?: string;
}

export interface NPCItem {
  id: number;
  npc_id: number;
  name: string;
  quantity: number;
  value_cp: number | null;
  description: string;
  location: 'inventory' | 'home';
  source: string;
  /** Only for what the NPC carries (npc-agenda.md §5). */
  equipped?: boolean;
}

export type ShopInput = Partial<Pick<Shop, 'name' | 'description' | 'icon' | 'npc_id' | 'availability' | 'scene_id' | 'object_id' | 'price_pct' | 'buy_rate_pct' | 'buys_types'>>;
export type ShopItemInput = Partial<Pick<ShopItem, 'name' | 'item_type' | 'rarity' | 'price_cp' | 'weight' | 'description' | 'attunement_required' | 'srd_ref_id' | 'srd_kind' | 'stock'>>;

const c = (id: number | string) => `/campaigns/${id}`;

export const marketApi = {
  shops: async (cid: number | string) => (await api.get<Shop[]>(`${c(cid)}/shops`)).data ?? [],
  createShop: async (cid: number | string, data: ShopInput) => (await api.post<Shop>(`${c(cid)}/shops`, data)).data,
  updateShop: async (cid: number | string, id: number, data: ShopInput) => (await api.put<Shop>(`${c(cid)}/shops/${id}`, data)).data,
  deleteShop: (cid: number | string, id: number) => api.delete(`${c(cid)}/shops/${id}`),
  items: async (cid: number | string, shopId: number) => (await api.get<{ shop: Shop; items: ShopItem[] }>(`${c(cid)}/shops/${shopId}/items`)).data,
  createItem: async (cid: number | string, shopId: number, data: ShopItemInput) => (await api.post<ShopItem>(`${c(cid)}/shops/${shopId}/items`, data)).data,
  updateItem: async (cid: number | string, id: number, data: ShopItemInput) => (await api.put<ShopItem>(`${c(cid)}/shop-items/${id}`, data)).data,
  deleteItem: (cid: number | string, id: number) => api.delete(`${c(cid)}/shop-items/${id}`),
  /** GM shortcut: hands a shop item to a character, charging the list price to its wallet. */
  buy: async (cid: number | string, shopId: number, itemId: number, qty = 1, characterId?: number) =>
    (await api.post<{ message: string; paid_cp: number }>(`${c(cid)}/shops/${shopId}/buy`, { item_id: itemId, qty, character_id: characterId })).data,
  sell: async (cid: number | string, shopId: number, inventoryItemId: number, qty = 1) =>
    (await api.post<{ message: string; paid_cp: number }>(`${c(cid)}/shops/${shopId}/sell`, { inventory_item_id: inventoryItemId, qty })).data,
  sellable: async (cid: number | string, shopId: number) => (await api.get<SellOffer[]>(`${c(cid)}/shops/${shopId}/sellable`)).data ?? [],
  npcItems: async (cid: number | string, npcId: number) => (await api.get<NPCItem[]>(`${c(cid)}/npcs/${npcId}/items`)).data ?? [],
  saveNpcItem: async (cid: number | string, npcId: number, item: Partial<NPCItem>) =>
    (item.id ? await api.put<NPCItem>(`${c(cid)}/npc-items/${item.id}`, item) : await api.post<NPCItem>(`${c(cid)}/npcs/${npcId}/items`, item)).data,
  deleteNpcItem: (cid: number | string, id: number) => api.delete(`${c(cid)}/npc-items/${id}`),
};

/** "7 po 5 pp 3 pc" from copper. */
export function formatCP(cp: number | null | undefined): string {
  if (!cp || cp <= 0) return '0 po';
  const parts: string[] = [];
  const g = Math.floor(cp / 100), s = Math.floor((cp % 100) / 10), k = cp % 10;
  if (g) parts.push(`${g.toLocaleString('es')} po`);
  if (s) parts.push(`${s} pp`);
  if (k) parts.push(`${k} pc`);
  return parts.join(' ');
}

/** Gold pieces (decimal) to copper. */
export const gpToCP = (gp: number) => Math.max(0, Math.round(gp * 100));
export const cpToGP = (cp: number) => Math.round(cp) / 100;

/** Catalogue price of an SRD equipment entry, in copper. */
export function srdCostCP(cost: number, unit: string): number {
  const mult: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
  return Math.round((cost || 0) * (mult[(unit || 'gp').toLowerCase()] ?? 100));
}

/** Suggested magic item price by rarity (DMG 2024 guideline), in copper. */
export const RARITY_PRICE_CP: Record<string, number> = {
  common: 100_00, uncommon: 400_00, rare: 4_000_00, very_rare: 40_000_00, 'very rare': 40_000_00, legendary: 200_000_00, artifact: 0,
};

export const ITEM_TYPES: { value: string; label: string }[] = [
  { value: 'weapon', label: 'Arma' }, { value: 'armor', label: 'Armadura' }, { value: 'potion', label: 'Poción' },
  { value: 'scroll', label: 'Pergamino' }, { value: 'gear', label: 'Equipo' }, { value: 'magic_item', label: 'Objeto mágico' },
  { value: 'ammunition', label: 'Munición' }, { value: 'misc', label: 'Varios' },
];
export const RARITIES: { value: string; label: string }[] = [
  { value: 'common', label: 'Común' }, { value: 'uncommon', label: 'Poco común' }, { value: 'rare', label: 'Rara' },
  { value: 'very_rare', label: 'Muy rara' }, { value: 'legendary', label: 'Legendaria' },
];
export const typeLabel = (t: string) => ITEM_TYPES.find((x) => x.value === t)?.label ?? t;
export const rarityLabel = (r: string) => RARITIES.find((x) => x.value === r)?.label ?? r;
const RARITY_CLASSES: Record<string, string> = {
  common: 'bg-card-3 text-rar-common', uncommon: 'bg-ok-soft text-rar-uncommon', rare: 'bg-info-soft text-rar-rare',
  very_rare: 'bg-rar-very-rare-soft text-rar-very-rare', legendary: 'bg-gold-soft text-rar-legendary', artifact: 'bg-bad-soft text-bad',
};
/** Badge colours per rarity ("very rare" and "very_rare" both match). */
export const rarityClass = (r: string) => RARITY_CLASSES[(r || 'common').toLowerCase().replace(/\s+/g, '_')] ?? RARITY_CLASSES.common;

// ---------- Haggling ----------

export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
export interface OfferLine { id: number; item_id: number | null; name: string; qty: number; unit_list_cp: number }
export interface ShopOffer {
  id: number;
  shop_id: number;
  character_id: number;
  qty: number;
  list_cp: number;
  offered_cp: number;
  counter_cp: number | null;
  agreed_cp: number | null;
  message: string;
  skill: string;
  roll_total?: number;
  roll_detail?: string;
  status: OfferStatus;
  note: string;
  created_at: string;
  resolved_at: string | null;
  shop_name: string;
  character_name: string;
  npc_name?: string;
  lines: OfferLine[];
  summary: string;
}
export interface CartLine { item_id: number; qty: number }
export interface OfferInput { lines: CartLine[]; offered_cp: number; message?: string; skill?: string }

export const HAGGLE_SKILLS = [
  { value: '', label: 'Sin tirada' }, { value: 'persuasión', label: 'Persuasión' },
  { value: 'engaño', label: 'Engaño' }, { value: 'intimidación', label: 'Intimidación' },
];

export const offersApi = {
  make: async (cid: number | string, shopId: number, data: OfferInput) =>
    (await api.post<{ message: string; offer?: ShopOffer }>(`${c(cid)}/shops/${shopId}/offers`, data)).data,
  list: async (cid: number | string) => (await api.get<{ active: ShopOffer[]; recent?: ShopOffer[] }>(`${c(cid)}/offers`)).data,
  act: async (cid: number | string, offerId: number, action: 'accept' | 'reject' | 'counter' | 'withdraw', body: { price_cp?: number; note?: string } = {}) =>
    (await api.post<{ message: string }>(`${c(cid)}/offers/${offerId}/${action}`, body)).data,
};
