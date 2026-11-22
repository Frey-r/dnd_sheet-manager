import { api } from './api';

// Bastions API (openspec/specs/market-bastions.md §6–§7).

export type BastionSize = 'cramped' | 'roomy' | 'vast';
export type OrderName = 'craft' | 'empower' | 'harvest' | 'maintain' | 'recruit' | 'research' | 'trade';
export type OptionKind = 'item' | 'gold' | 'defender' | 'narrative';

export const ORDERS: { value: OrderName; label: string }[] = [
  { value: 'craft', label: 'Fabricar' }, { value: 'empower', label: 'Potenciar' }, { value: 'harvest', label: 'Cosechar' },
  { value: 'maintain', label: 'Mantener' }, { value: 'recruit', label: 'Reclutar' }, { value: 'research', label: 'Investigar' },
  { value: 'trade', label: 'Comerciar' },
];
export const orderLabel = (o: string) => ORDERS.find((x) => x.value === o)?.label ?? o;
export const SIZES: { value: BastionSize; label: string; squares: number }[] = [
  { value: 'cramped', label: 'Reducida', squares: 4 }, { value: 'roomy', label: 'Amplia', squares: 16 }, { value: 'vast', label: 'Enorme', squares: 36 },
];
export const sizeLabel = (s: string) => SIZES.find((x) => x.value === s)?.label ?? s;
export const BASIC_KINDS: { value: string; label: string }[] = [
  { value: 'bedroom', label: 'Dormitorio' }, { value: 'dining', label: 'Comedor' }, { value: 'parlor', label: 'Salón' },
  { value: 'courtyard', label: 'Patio' }, { value: 'kitchen', label: 'Cocina' }, { value: 'storage', label: 'Almacenamiento' },
];
export const OPTION_KINDS: { value: OptionKind; label: string }[] = [
  { value: 'item', label: 'Objetos' }, { value: 'gold', label: 'Oro (tirada)' }, { value: 'defender', label: 'Defensores' }, { value: 'narrative', label: 'Narrativo' },
];

/** Cost and days of building a basic facility, mirrored from the rules (gold up front). */
export const BASIC_BUILD: Record<BastionSize, { gp: number; days: number }> = {
  cramped: { gp: 500, days: 20 }, roomy: { gp: 1000, days: 45 }, vast: { gp: 3000, days: 125 },
};
export const ENLARGE: Record<string, { to: BastionSize; gp: number; days: number }> = {
  cramped: { to: 'roomy', gp: 500, days: 25 }, roomy: { to: 'vast', gp: 2000, days: 80 },
};

export interface BastionOption {
  id: string;
  order: OrderName;
  name: string;
  description: string;
  turns: number;
  cost_cp: number;
  kind: OptionKind;
  item_name?: string;
  item_type?: string;
  rarity?: string;
  qty?: number;
  value_cp?: number;
  gold_dice?: string;
  gold_mult_cp?: number;
  defenders?: number;
  text?: string;
}

export interface CatalogEntry {
  id: number;
  name: string;
  min_level: number;
  prerequisite: string;
  size: BastionSize;
  description: string;
  hirelings: number;
  orders: OrderName[];
  options: BastionOption[];
  sort_order: number;
}

export interface BastionEvent {
  id: number;
  roll_min: number;
  roll_max: number;
  name: string;
  description: string;
  reward_dice: string;
  reward_mult_cp: number;
}

export interface Facility {
  id: number;
  bastion_id: number;
  kind: 'basic' | 'special';
  catalog_id: number | null;
  name: string;
  basic_kind: string;
  size: BastionSize;
  order_name: string;
  order_option: BastionOption | null;
  turns_left: number;
  description?: string;
  prerequisite?: string;
  orders?: OrderName[];
  options?: BastionOption[];
}

export interface Hireling { id: number; facility_id: number | null; name: string }
export interface Defender { id: number; name: string; source: string }
export interface WarehouseItem { id: number; name: string; item_type: string; rarity: string; quantity: number; value_cp: number; description: string; source: string }
export interface Construction {
  id: number;
  kind: 'add' | 'enlarge';
  facility_id: number | null;
  basic_kind: string;
  target_size: BastionSize;
  days_left: number;
  total_days: number;
  cost_cp: number;
}
export interface TurnLog { id: number; turn_number: number; entries: string[]; event_name: string; event_roll: number; created_at: string }

export interface Bastion {
  id: number;
  campaign_id: number;
  character_id: number;
  name: string;
  description: string;
  character_name: string;
  character_level: number;
  owner_user_id: number;
  facilities: Facility[];
  hirelings: Hireling[];
  defenders: Defender[];
  warehouse: WarehouseItem[];
  construction: Construction[];
  log: TurnLog[];
}

export interface BastionDetail { bastion: Bastion; catalog: CatalogEntry[]; special_slots: number; special_used: number }
export interface BastionList { bastions: Bastion[]; catalog: CatalogEntry[] }
export interface TurnSummary { turn: number; results: { bastion_id: number; name: string; owner: string; event?: string; log: string[] }[] }
export interface SaleResult { message: string; payout_cp: number; buyer: string }
export interface CatalogPayload { facilities: CatalogEntry[]; events: BastionEvent[] }

export interface AppraisalItem {
  id: number;
  character_id: number;
  character_name: string;
  name: string;
  item_type: string;
  rarity: string;
  quantity: number;
  value_cp: number | null;
}

export type FacilityRequest =
  | { type: 'special'; catalog_id: number }
  | { type: 'basic'; basic_kind: string; size: BastionSize }
  | { type: 'enlarge'; facility_id: number };

const c = (id: number | string) => `/campaigns/${id}`;

export const bastionApi = {
  list: async (cid: number | string) => (await api.get<BastionList>(`${c(cid)}/bastions`)).data,
  get: async (cid: number | string, bid: number) => (await api.get<BastionDetail>(`${c(cid)}/bastions/${bid}`)).data,
  found: async (cid: number | string, data: { name: string; description?: string; character_id?: number; basic_kinds?: string[] }) =>
    (await api.post<BastionDetail>(`${c(cid)}/bastions`, data)).data,
  update: async (cid: number | string, bid: number, data: { name: string; description: string }) =>
    (await api.put<BastionDetail>(`${c(cid)}/bastions/${bid}`, data)).data,
  addFacility: async (cid: number | string, bid: number, req: FacilityRequest) =>
    (await api.post<BastionDetail>(`${c(cid)}/bastions/${bid}/facilities`, req)).data,
  deleteFacility: (cid: number | string, fid: number) => api.delete(`${c(cid)}/bastion-facilities/${fid}`),
  order: async (cid: number | string, fid: number, order: string, option: string) =>
    (await api.put<BastionDetail>(`${c(cid)}/bastion-facilities/${fid}/order`, { order, option })).data,
  turn: async (cid: number | string) => (await api.post<TurnSummary>(`${c(cid)}/bastions/turn`)).data,
  sell: async (cid: number | string, bid: number, warehouseId: number, qty: number) =>
    (await api.post<SaleResult>(`${c(cid)}/bastions/${bid}/sell`, { warehouse_id: warehouseId, qty })).data,
  take: async (cid: number | string, bid: number, warehouseId: number, qty: number) =>
    (await api.post<{ message: string }>(`${c(cid)}/bastions/${bid}/take`, { warehouse_id: warehouseId, qty })).data,
  catalog: async (cid: number | string) => (await api.get<CatalogPayload>(`${c(cid)}/bastion-catalog`)).data,
  saveCatalog: async (cid: number | string, data: CatalogPayload) => (await api.put<CatalogPayload>(`${c(cid)}/bastion-catalog`, data)).data,
  appraisals: async (cid: number | string) => (await api.get<AppraisalItem[]>(`${c(cid)}/appraisals`)).data ?? [],
  appraise: (cid: number | string, itemId: number, valueCp: number | null) =>
    api.put(`${c(cid)}/inventory-items/${itemId}/value`, { value_cp: valueCp }),
};
