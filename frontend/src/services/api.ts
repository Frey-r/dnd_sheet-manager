import axios, { AxiosError } from 'axios';
import { clearAuth, getAuthToken, getRefreshToken, saveAuth } from './authStorage';
import type { AuthChallenge, AuthResponse, NPC, NPCInput } from '../types';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
export { api };

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<AuthResponse> | null = null;
api.interceptors.response.use((response) => response, async (error: AxiosError) => {
  const original = error.config;
  if (error.response?.status !== 401 || !original || original.headers['X-Retry'] || original.url?.startsWith('/auth/')) {
    return Promise.reject(error);
  }
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuth(); window.dispatchEvent(new Event('auth:expired'));
    return Promise.reject(error);
  }
  try {
    refreshing ??= axios.post<AuthResponse>(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken }).then((response) => response.data);
    const session = await refreshing;
    refreshing = null;
    const remember = Boolean(localStorage.getItem('refresh_token'));
    saveAuth(session.user, session.token, session.refresh_token, remember);
    original.headers.Authorization = `Bearer ${session.token}`;
    original.headers['X-Retry'] = 'true';
    return api(original);
  } catch (refreshError) {
    refreshing = null;
    clearAuth(); window.dispatchEvent(new Event('auth:expired'));
    window.location.assign('/login');
    return Promise.reject(refreshError);
  }
});

export const authApi = {
  login: (data: { email: string; password: string; otp?: string }) => api.post<AuthChallenge>('/auth/login', data),
  register: (data: { username: string; email: string; password: string }) => api.post<AuthResponse>('/auth/register', data),
  refresh: (refreshToken: string) => api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken }),
  logout: (refreshToken: string) => api.post('/auth/logout', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),
  updateProfile: (data: { username: string; avatar_url?: string }) => api.put('/auth/profile', data),
  changePassword: (data: { current_password: string; new_password: string }) => api.post('/auth/password', data),
  setup2FA: () => api.post<{ secret: string; otpauth_url: string }>('/auth/2fa/setup'),
  enable2FA: (code: string) => api.post('/auth/2fa/enable', { code }),
  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),
};

export const campaignApi = {
  list: () => api.get('/campaigns'),
  create: (data: { name: string; description: string; game_mode?: 'local' | 'foundry'; cover_url?: string }) => api.post('/campaigns', data),
  get: (id: number | string) => api.get(`/campaigns/${id}`),
  update: (id: number | string, data: Partial<{ name: string; description: string; status: string; bastion_sale_pct: number; cover_url: string }>) => api.put(`/campaigns/${id}`, data),
  delete: (id: number | string) => api.delete(`/campaigns/${id}`),
  join: (id: number | string, joinCode: string) => api.post(`/campaigns/${id}/join`, { join_code: joinCode }),
  members: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/members`),
};
export const characterApi = {
  listByCampaign: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/characters`),
  create: (data: { name: string; race: string; class: string; campaign_id: number; background?: string; alignment?: string; str_score?: number; dex_score?: number; con_score?: number; int_score?: number; wis_score?: number; cha_score?: number; stat_roll_id?: number; base_scores?: number[]; speed?: number; appearance?: unknown }) => api.post('/characters', data),
  updateAppearance: (id: number | string, appearance: unknown) => api.put(`/characters/${id}/appearance`, appearance),
  get: (id: number | string) => api.get(`/characters/${id}`),
  update: (id: number | string, data: Record<string, unknown>) => api.put(`/characters/${id}`, data),
  updateHP: (id: number | string, data: { current_hp: number; temp_hp: number }) => api.put(`/characters/${id}/hp`, data),
  longRest: (id: number | string) => api.post(`/characters/${id}/long-rest`),
  inventory: (id: number | string) => api.get(`/characters/${id}/inventory`),
  spells: (id: number | string) => api.get(`/characters/${id}/spells`),
  spellSlots: (id: number | string) => api.get(`/characters/${id}/spell-slots`),
  setSpellSlotTotal: (id: number | string, level: number, total: number) => api.put(`/characters/${id}/spell-slots/${level}`, { total }),
  castSpell: (charId: number | string, spellId: number | string) => api.post(`/characters/${charId}/spells/${spellId}/cast`),
  features: (id: number | string) => api.get(`/characters/${id}/features`),
  addSpell: (charId: number | string, data: Record<string, unknown>) => api.post(`/characters/${charId}/spells`, data),
};
export const tradeApi = {
  /** Tradeable items of another campaign character (the full inventory is owner/GM-only). */
  tradeableItems: (campaignId: number | string, characterId: number | string) => api.get(`/campaigns/${campaignId}/characters/${characterId}/tradeable-items`),
  create: (characterId: number | string, data: { recipient_character_id: number; offered_item_ids: number[]; offered_gold: number; requested_item_ids: number[]; requested_gold: number }) => api.post(`/characters/${characterId}/trades`, data),
  accept: (id: number | string) => api.put(`/trades/${id}/accept`),
  reject: (id: number | string) => api.put(`/trades/${id}/reject`),
  cancel: (id: number | string) => api.put(`/trades/${id}/cancel`),
  list: () => api.get('/trades'),
  counter: (id: number | string, data: { recipient_character_id: number; offered_item_ids: number[]; offered_gold: number; requested_item_ids: number[]; requested_gold: number }) => api.post(`/trades/${id}/counter`, data),
};
export const messageApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/messages`),
  conversation: (campaignId: number | string, userId: number | string) => api.get(`/campaigns/${campaignId}/messages/${userId}`),
  send: (campaignId: number | string, data: { message_type: string; body: string; subject?: string; recipient_user_id?: number }) => api.post(`/campaigns/${campaignId}/messages`, data),
  markRead: (scope?: { campaignId: number | string; userId: number | string }) => api.post('/messages/mark-read', null, { params: scope ? { campaign_id: scope.campaignId, user_id: scope.userId } : undefined }),
  presence: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/presence`),
};
export const marketApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/marketplace`),
  create: (campaignId: number | string, data: Record<string, unknown>) => api.post(`/campaigns/${campaignId}/marketplace`, data),
  purchase: (campaignId: number | string, itemId: number | string) => api.post(`/campaigns/${campaignId}/marketplace/purchase`, { item_id: itemId }),
};
/** Campaign NPCs, with race, class and appearance (D-0041). An update changes only the fields it sends. */
export const npcApi = {
  list: (campaignId: number | string) => api.get<NPC[]>(`/campaigns/${campaignId}/npcs`),
  get: (campaignId: number | string, npcId: number | string) => api.get<NPC>(`/campaigns/${campaignId}/npcs/${npcId}`),
  create: (campaignId: number | string, data: NPCInput) => api.post<NPC>(`/campaigns/${campaignId}/npcs`, data),
  update: (campaignId: number | string, npcId: number | string, data: NPCInput) => api.put<NPC>(`/campaigns/${campaignId}/npcs/${npcId}`, data),
  delete: (campaignId: number | string, npcId: number | string) => api.delete(`/campaigns/${campaignId}/npcs/${npcId}`),
};
export const creatureApi = {
  list: () => api.get('/creatures'), get: (id: number | string) => api.get(`/creatures/${id}`),
  create: (data: Record<string, unknown>) => api.post('/creatures', data),
  update: (id: number | string, data: Record<string, unknown>) => api.put(`/creatures/${id}`, data),
  delete: (id: number | string) => api.delete(`/creatures/${id}`),
};
export const eventApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/events`),
  get: (campaignId: number | string, eventId: number | string) => api.get(`/campaigns/${campaignId}/events/${eventId}`),
  create: (campaignId: number | string, data: Record<string, unknown>) => api.post(`/campaigns/${campaignId}/events`, data),
  update: (campaignId: number | string, eventId: number | string, data: Record<string, unknown>) => api.put(`/campaigns/${campaignId}/events/${eventId}`, data),
  delete: (campaignId: number | string, eventId: number | string) => api.delete(`/campaigns/${campaignId}/events/${eventId}`),
};
export const mapApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/maps`),
  get: (campaignId: number | string, mapId: number | string) => api.get(`/campaigns/${campaignId}/maps/${mapId}`),
  create: (campaignId: number | string, data: Record<string, unknown>) => api.post(`/campaigns/${campaignId}/maps`, data),
  update: (campaignId: number | string, mapId: number | string, data: Record<string, unknown>) => api.put(`/campaigns/${campaignId}/maps/${mapId}`, data),
  delete: (campaignId: number | string, mapId: number | string) => api.delete(`/campaigns/${campaignId}/maps/${mapId}`),
};
export const loreApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/lore`),
  get: (campaignId: number | string, loreId: number | string) => api.get(`/campaigns/${campaignId}/lore/${loreId}`),
  create: (campaignId: number | string, data: Record<string, unknown>) => api.post(`/campaigns/${campaignId}/lore`, data),
  update: (campaignId: number | string, loreId: number | string, data: Record<string, unknown>) => api.put(`/campaigns/${campaignId}/lore/${loreId}`, data),
  delete: (campaignId: number | string, loreId: number | string) => api.delete(`/campaigns/${campaignId}/lore/${loreId}`),
  search: (campaignId: number | string, query: string, scope: string, characterId?: number) => api.post(`/campaigns/${campaignId}/lore/search`, { query, scope, character_id: characterId }),
};
export const combatApi = {
  getState: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/combat`),
  addCombatant: (campaignId: number | string, data: Record<string, unknown>) => api.post(`/campaigns/${campaignId}/combat/combatants`, data),
  addEncounter: (campaignId: number | string, combatants: Record<string, unknown>[]) => api.post(`/campaigns/${campaignId}/combat/encounter`, { combatants }),
  removeCombatant: (campaignId: number | string, combatantId: number | string) => api.delete(`/campaigns/${campaignId}/combat/combatants/${combatantId}`),
  nextTurn: (campaignId: number | string) => api.post(`/campaigns/${campaignId}/combat/next-turn`),
  updateHP: (campaignId: number | string, combatantId: number | string, data: { hp: number }) => api.put(`/campaigns/${campaignId}/combat/combatants/${combatantId}/hp`, data),
  reset: (campaignId: number | string) => api.post(`/campaigns/${campaignId}/combat/reset`),
};
export const itemApi = {
  add: (characterId: number | string, data: Record<string, unknown>) => api.post(`/characters/${characterId}/inventory`, data),
  update: (characterId: number | string, itemId: number | string, data: Record<string, unknown>) => api.put(`/characters/${characterId}/inventory/${itemId}`, data),
  remove: (characterId: number | string, itemId: number | string) => api.delete(`/characters/${characterId}/inventory/${itemId}`),
  equip: (characterId: number | string, itemId: number | string) => api.put(`/characters/${characterId}/inventory/${itemId}/equip`),
};
export const foundryApi = {
  sync: (campaignId: number | string) => api.post('/foundry/sync', { campaign_id: Number(campaignId) }),
  status: (campaignId: number | string) => api.get('/foundry/status', { params: { campaign_id: campaignId } }),
  health: () => api.get('/foundry/health'),
};
export const noteApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/notes`),
  get: (campaignId: number | string, noteId: number | string) => api.get(`/campaigns/${campaignId}/notes/${noteId}`),
  create: (campaignId: number | string, data: Record<string, unknown>) => api.post(`/campaigns/${campaignId}/notes`, data),
  update: (campaignId: number | string, noteId: number | string, data: Record<string, unknown>) => api.put(`/campaigns/${campaignId}/notes/${noteId}`, data),
  delete: (campaignId: number | string, noteId: number | string) => api.delete(`/campaigns/${campaignId}/notes/${noteId}`),
};
export const contentApi = {
  search: (params: { query?: string; type?: string; source?: string; is_srd?: boolean; limit?: number; offset?: number }) => api.get('/content', { params }),
  get: (id: number | string) => api.get(`/content/${id}`),
  categories: () => api.get('/content/categories'),
  sources: () => api.get('/content/sources'),
};
export const botApi = {
  get: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/bot`),
  save: (campaignId: number | string, data: { enabled: boolean; personality: string; actions: Record<string, boolean> }) => api.put(`/campaigns/${campaignId}/bot`, data),
  test: (campaignId: number | string, message: string) => api.post<{ reply: string }>(`/campaigns/${campaignId}/bot/test`, { message }),
};
export const homebrewApi = {
  create: (data: Record<string, unknown>) => api.post('/srd/monsters', data),
  update: (id: number | string, data: Record<string, unknown>) => api.put(`/srd/monsters/${id}`, data),
  remove: (id: number | string) => api.delete(`/srd/monsters/${id}`),
};
