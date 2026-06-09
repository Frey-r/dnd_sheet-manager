import type {
  MonsterListItem, SRDMonster, MonsterFilters,
  SpellListItem, SRDSpell, SpellFilters,
  SRDEquipment, EquipmentFilters,
  SRDMagicItem, MagicItemFilters,
  SRDClass, SRDRace, SRDCondition, SRDRule, RulesFilters,
  EncounterRequest, EncounterResult,
  LoadoutRequest, LoadoutResult,
  PaginatedResult,
} from '../types/srd';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const API_BASE = `${API_URL}/srd`;

// Helper to build query string from filters
function toQueryString(filters: any): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Monsters ────────────────────────────────────────────────

export async function searchMonsters(filters: MonsterFilters = {}): Promise<PaginatedResult<MonsterListItem>> {
  return fetchJSON(`${API_BASE}/monsters${toQueryString(filters)}`);
}

export async function getMonster(id: number): Promise<SRDMonster> {
  return fetchJSON(`${API_BASE}/monsters/${id}`);
}

// ── Spells ──────────────────────────────────────────────────

export async function searchSpells(filters: SpellFilters = {}): Promise<PaginatedResult<SpellListItem>> {
  return fetchJSON(`${API_BASE}/spells${toQueryString(filters)}`);
}

export async function getSpell(id: number): Promise<SRDSpell> {
  return fetchJSON(`${API_BASE}/spells/${id}`);
}

// ── Equipment ───────────────────────────────────────────────

export async function searchEquipment(filters: EquipmentFilters = {}): Promise<PaginatedResult<SRDEquipment>> {
  return fetchJSON(`${API_BASE}/equipment${toQueryString(filters)}`);
}

export async function getEquipment(id: number): Promise<SRDEquipment> {
  return fetchJSON(`${API_BASE}/equipment/${id}`);
}

// ── Magic Items ─────────────────────────────────────────────

export async function searchMagicItems(filters: MagicItemFilters = {}): Promise<PaginatedResult<SRDMagicItem>> {
  return fetchJSON(`${API_BASE}/magic-items${toQueryString(filters)}`);
}

export async function getMagicItem(id: number): Promise<SRDMagicItem> {
  return fetchJSON(`${API_BASE}/magic-items/${id}`);
}

// ── Classes ─────────────────────────────────────────────────

export async function listClasses(): Promise<{ data: SRDClass[] }> {
  return fetchJSON(`${API_BASE}/classes`);
}

export async function getClass(name: string): Promise<SRDClass> {
  return fetchJSON(`${API_BASE}/classes/${encodeURIComponent(name)}`);
}

// ── Races ───────────────────────────────────────────────────

export async function listRaces(): Promise<{ data: SRDRace[] }> {
  return fetchJSON(`${API_BASE}/races`);
}

export async function getRace(name: string): Promise<SRDRace> {
  return fetchJSON(`${API_BASE}/races/${encodeURIComponent(name)}`);
}

// ── Conditions ──────────────────────────────────────────────

export async function listConditions(): Promise<{ data: SRDCondition[] }> {
  return fetchJSON(`${API_BASE}/conditions`);
}

// ── Rules ───────────────────────────────────────────────────

export async function searchRules(filters: RulesFilters = {}): Promise<PaginatedResult<SRDRule>> {
  return fetchJSON(`${API_BASE}/rules${toQueryString(filters)}`);
}

// ── Encounter Builder ───────────────────────────────────────

export async function buildEncounter(req: EncounterRequest): Promise<EncounterResult> {
  return fetchJSON(`${API_BASE}/encounter/build`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ── Loadout Analyzer ────────────────────────────────────────

export async function analyzeLoadout(req: LoadoutRequest): Promise<LoadoutResult> {
  return fetchJSON(`${API_BASE}/loadout/analyze`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ── Utility Constants ───────────────────────────────────────

export const SPELL_SCHOOLS = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
  'Evocation', 'Illusion', 'Necromancy', 'Transmutation',
] as const;

export const MONSTER_TYPES = [
  'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon',
  'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid',
  'Monstrosity', 'Ooze', 'Plant', 'Undead',
] as const;

export const MONSTER_SIZES = [
  'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan',
] as const;

export const ITEM_RARITIES = [
  'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact',
] as const;

export const CR_VALUES = [
  '0', '1/8', '1/4', '1/2',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
] as const;

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function crToNumeric(cr: string): number {
  switch (cr) {
    case '1/8': return 0.125;
    case '1/4': return 0.25;
    case '1/2': return 0.5;
    default: return parseFloat(cr) || 0;
  }
}
