import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () =>
    api.get('/auth/me'),
};


// Campaigns
export const campaignApi = {
  list: () => api.get('/campaigns'),
  create: (data: { name: string; description: string }) =>
    api.post('/campaigns', data),
  get: (id: number | string) => api.get(`/campaigns/${id}`),
  update: (id: number | string, data: Partial<{ name: string; description: string; status: string }>) =>
    api.put(`/campaigns/${id}`, data),
  delete: (id: number | string) => api.delete(`/campaigns/${id}`),
  join: (id: number | string, joinCode: string) =>
    api.post(`/campaigns/${id}/join`, { join_code: joinCode }),
  members: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/members`),
};

// Characters
export const characterApi = {
  listByCampaign: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/characters`),
  create: (data: { name: string; race: string; class: string; campaign_id: number }) =>
    api.post('/characters', data),
  get: (id: number | string) => api.get(`/characters/${id}`),
  update: (id: number | string, data: Record<string, unknown>) =>
    api.put(`/characters/${id}`, data),
  updateHP: (id: number | string, data: { current_hp: number; temp_hp: number }) =>
    api.put(`/characters/${id}/hp`, data),
  longRest: (id: number | string) => api.post(`/characters/${id}/long-rest`),
  inventory: (id: number | string) => api.get(`/characters/${id}/inventory`),
  spells: (id: number | string) => api.get(`/characters/${id}/spells`),
  spellSlots: (id: number | string) => api.get(`/characters/${id}/spell-slots`),
  castSpell: (charId: number | string, spellId: number | string) =>
    api.post(`/characters/${charId}/spells/${spellId}/cast`),
  features: (id: number | string) => api.get(`/characters/${id}/features`),
  addSpell: (charId: number | string, data: Record<string, unknown>) =>
    api.post(`/characters/${charId}/spells`, data),
};

// Trades
export const tradeApi = {
  create: (characterId: number | string, data: {
    recipient_character_id: number;
    offered_item_ids: number[];
    offered_gold: number;
    requested_item_ids: number[];
    requested_gold: number;
  }) => api.post(`/characters/${characterId}/trades`, data),
  accept: (id: number | string) => api.put(`/trades/${id}/accept`),
  reject: (id: number | string) => api.put(`/trades/${id}/reject`),
  cancel: (id: number | string) => api.put(`/trades/${id}/cancel`),
};

// Messages
export const messageApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/messages`),
  conversation: (campaignId: number | string, userId: number | string) =>
    api.get(`/campaigns/${campaignId}/messages/${userId}`),
  send: (campaignId: number | string, data: {
    message_type: string;
    body: string;
    subject?: string;
    recipient_user_id?: number;
  }) => api.post(`/campaigns/${campaignId}/messages`, data),
  markRead: () => api.post('/messages/mark-read'),
};

// Marketplace
export const marketApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/marketplace`),
  create: (campaignId: number | string, data: Record<string, unknown>) =>
    api.post(`/campaigns/${campaignId}/marketplace`, data),
  purchase: (campaignId: number | string, itemId: number | string) =>
    api.post(`/campaigns/${campaignId}/marketplace/purchase`, { item_id: itemId }),
};

// NPCs
export const npcApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/npcs`),
  get: (campaignId: number | string, npcId: number | string) =>
    api.get(`/campaigns/${campaignId}/npcs/${npcId}`),
  create: (campaignId: number | string, data: {
    name: string; role: string; status: string; avatar_url?: string;
    ac?: number; hp?: number; speed?: number; description?: string; notes?: string;
  }) => api.post(`/campaigns/${campaignId}/npcs`, data),
  update: (campaignId: number | string, npcId: number | string, data: Record<string, unknown>) =>
    api.put(`/campaigns/${campaignId}/npcs/${npcId}`, data),
  delete: (campaignId: number | string, npcId: number | string) =>
    api.delete(`/campaigns/${campaignId}/npcs/${npcId}`),
};

// Bestiary / Creatures
export const creatureApi = {
  list: () => api.get('/creatures'),
  get: (id: number | string) => api.get(`/creatures/${id}`),
  create: (data: {
    name: string; type: string; challenge_rating: number; size: string;
    ac: number; hp: number; speed: number;
    stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    skills?: string; resistances?: string; immunities?: string; actions?: string;
    image_url?: string;
  }) => api.post('/creatures', data),
  update: (id: number | string, data: Record<string, unknown>) =>
    api.put(`/creatures/${id}`, data),
  delete: (id: number | string) => api.delete(`/creatures/${id}`),
};

// Events
export const eventApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/events`),
  get: (campaignId: number | string, eventId: number | string) =>
    api.get(`/campaigns/${campaignId}/events/${eventId}`),
  create: (campaignId: number | string, data: {
    title: string; description: string; date: string; time?: string;
    npc_ids?: number[]; location?: string;
  }) => api.post(`/campaigns/${campaignId}/events`, data),
  update: (campaignId: number | string, eventId: number | string, data: Record<string, unknown>) =>
    api.put(`/campaigns/${campaignId}/events/${eventId}`, data),
  delete: (campaignId: number | string, eventId: number | string) =>
    api.delete(`/campaigns/${campaignId}/events/${eventId}`),
};

// Maps
export const mapApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/maps`),
  get: (campaignId: number | string, mapId: number | string) =>
    api.get(`/campaigns/${campaignId}/maps/${mapId}`),
  create: (campaignId: number | string, data: {
    name: string; location: string; image_url: string; notes?: string;
  }) => api.post(`/campaigns/${campaignId}/maps`, data),
  update: (campaignId: number | string, mapId: number | string, data: Record<string, unknown>) =>
    api.put(`/campaigns/${campaignId}/maps/${mapId}`, data),
  delete: (campaignId: number | string, mapId: number | string) =>
    api.delete(`/campaigns/${campaignId}/maps/${mapId}`),
};

// Lore
export const loreApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/lore`),
  get: (campaignId: number | string, loreId: number | string) =>
    api.get(`/campaigns/${campaignId}/lore/${loreId}`),
  create: (campaignId: number | string, data: {
    title: string; content_text: string;
    lore_tier: string; character_id?: number; chapter_order?: number;
  }) => api.post(`/campaigns/${campaignId}/lore`, data),
  update: (campaignId: number | string, loreId: number | string, data: Record<string, unknown>) =>
    api.put(`/campaigns/${campaignId}/lore/${loreId}`, data),
  delete: (campaignId: number | string, loreId: number | string) =>
    api.delete(`/campaigns/${campaignId}/lore/${loreId}`),
  search: (campaignId: number | string, query: string, scope: string) =>
    api.post(`/campaigns/${campaignId}/lore/search`, { query, scope }),
};

// Combat
export const combatApi = {
  getState: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/combat`),
  addCombatant: (campaignId: number | string, data: {
    name: string; initiative: number; hp: number; max_hp: number; is_player: boolean;
  }) => api.post(`/campaigns/${campaignId}/combat/combatants`, data),
  removeCombatant: (campaignId: number | string, combatantId: number | string) =>
    api.delete(`/campaigns/${campaignId}/combat/combatants/${combatantId}`),
  nextTurn: (campaignId: number | string) => api.post(`/campaigns/${campaignId}/combat/next-turn`),
  updateHP: (campaignId: number | string, combatantId: number | string, data: { hp: number }) =>
    api.put(`/campaigns/${campaignId}/combat/combatants/${combatantId}/hp`, data),
};

// Inventory Items
export const itemApi = {
  add: (characterId: number | string, data: {
    name: string; item_type: string; rarity: string; weight: number;
    quantity: number; description?: string;
  }) => api.post(`/characters/${characterId}/inventory`, data),
  update: (characterId: number | string, itemId: number | string, data: Record<string, unknown>) =>
    api.put(`/characters/${characterId}/inventory/${itemId}`, data),
  remove: (characterId: number | string, itemId: number | string) =>
    api.delete(`/characters/${characterId}/inventory/${itemId}`),
  equip: (characterId: number | string, itemId: number | string) =>
    api.put(`/characters/${characterId}/inventory/${itemId}/equip`),
};

// Foundry VTT integration (see openspec/specs/foundry-integration.md)
export const foundryApi = {
  sync: (campaignId: number | string) =>
    api.post('/foundry/sync', { campaign_id: Number(campaignId) }),
  status: (campaignId: number | string) =>
    api.get('/foundry/status', { params: { campaign_id: campaignId } }),
  health: () => api.get('/foundry/health'),
};

// Notes
export const noteApi = {
  list: (campaignId: number | string) => api.get(`/campaigns/${campaignId}/notes`),
  get: (campaignId: number | string, noteId: number | string) =>
    api.get(`/campaigns/${campaignId}/notes/${noteId}`),
  create: (campaignId: number | string, data: { title: string; content: string }) =>
    api.post(`/campaigns/${campaignId}/notes`, data),
  update: (campaignId: number | string, noteId: number | string, data: Record<string, unknown>) =>
    api.put(`/campaigns/${campaignId}/notes/${noteId}`, data),
  delete: (campaignId: number | string, noteId: number | string) =>
    api.delete(`/campaigns/${campaignId}/notes/${noteId}`),
};
