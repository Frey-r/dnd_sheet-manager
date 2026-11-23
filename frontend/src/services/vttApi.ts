import { api } from './api';

export interface Wall { x1: number; y1: number; x2: number; y2: number; door: boolean; open: boolean }
export interface SceneLight { x: number; y: number; bright: number; dim: number }
export interface Pt { x: number; y: number }
export interface Zone { id: string; name: string; points: Pt[]; monster_ids: number[]; armed: boolean }
export type SceneMode = 'narrative' | 'exploration' | 'combat';

export interface VTTToken {
  id: number;
  scene_id: number;
  name: string;
  kind: 'pc' | 'npc' | 'monster';
  character_id: number | null;
  owner_user_id: number | null;
  image_url: string;
  color: string;
  x: number;
  y: number;
  size_cells: number;
  hp: number;
  max_hp: number;
  ac: number;
  hidden: boolean;
  vision_ft: number;
  darkvision_ft: number;
  blindsight_ft: number;
  light_bright_ft: number;
  light_dim_ft: number;
  speed_ft: number;
  passive_perception: number;
  stealth_bonus: number;
  dex_mod: number;
  sneaking: boolean;
  detects: boolean;
}

export interface VTTScene {
  id: number;
  campaign_id: number;
  name: string;
  map_url: string;
  width_px: number;
  height_px: number;
  grid_size_px: number;
  grid_offset_x: number;
  grid_offset_y: number;
  feet_per_cell: number;
  ambient_light: 'bright' | 'dim' | 'dark';
  fog_enabled: boolean;
  walls: Wall[];
  lights: SceneLight[];
  mode: SceneMode;
  exploration_pace: number;
  zones: Zone[];
  is_active: boolean;
  tokens?: VTTToken[];
}

const base = (c: number | string) => `/campaigns/${c}/vtt`;

export const vttApi = {
  scenes: async (c: number | string) => (await api.get<VTTScene[]>(`${base(c)}/scenes`)).data,
  active: async (c: number | string) => (await api.get<{ scene: VTTScene | null }>(`${base(c)}/active`)).data.scene,
  scene: async (c: number | string, id: number) => (await api.get<VTTScene>(`${base(c)}/scenes/${id}`)).data,
  createScene: async (c: number | string, data: Partial<VTTScene>) => (await api.post<VTTScene>(`${base(c)}/scenes`, data)).data,
  updateScene: async (c: number | string, id: number, data: Partial<VTTScene>) => (await api.put<VTTScene>(`${base(c)}/scenes/${id}`, data)).data,
  deleteScene: (c: number | string, id: number) => api.delete(`${base(c)}/scenes/${id}`),
  activate: (c: number | string, id: number) => api.post(`${base(c)}/scenes/${id}/activate`),
  createToken: async (c: number | string, sceneId: number, data: Partial<VTTToken> & { monster_id?: number }) =>
    (await api.post<VTTToken>(`${base(c)}/scenes/${sceneId}/tokens`, data)).data,
  updateToken: async (c: number | string, id: number, data: Partial<VTTToken> & { clear_owner?: boolean }) =>
    (await api.put<VTTToken>(`${base(c)}/tokens/${id}`, data)).data,
  moveToken: async (c: number | string, id: number, x: number, y: number) =>
    (await api.put<{ id: number; x: number; y: number }>(`${base(c)}/tokens/${id}/move`, { x, y })).data,
  deleteToken: (c: number | string, id: number) => api.delete(`${base(c)}/tokens/${id}`),
  upload: async (c: number | string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return (await api.post<{ url: string }>(`/campaigns/${c}/uploads`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.url;
  },
};

export interface LootEntry { name?: string; qty?: number; gold?: number; weight?: number }
export interface Check { skill: string; dc: number; bonus?: number }
export interface Condition { type: 'class' | 'race' | 'has_item' | 'passive'; value?: string; min?: number }
export interface Requirements { milestones?: number[]; conditions?: Condition[]; check?: Check | null }
export interface VTTObject {
  id: number; scene_id: number; name: string; icon: string; x: number; y: number;
  discover_dc?: number; requirements?: Requirements; loot_kind?: 'fixed' | 'table';
  loot?: { gold?: number; items?: LootEntry[]; entries?: LootEntry[] };
  per_character?: boolean; depleted: boolean; attempted?: boolean; check?: { skill: string; dc: number };
}
export interface Milestone { id: number; name: string; achieved: boolean }
export interface Combatant { id: number; token_id: number; initiative: number; is_player: boolean; movement_used_ft: number; dashed: boolean; name: string }
export interface VTTCombat {
  id: number; scene_id: number; round: number; turn_index: number; turn_seconds: number; paused: boolean;
  remaining_ms: number; center_x: number; center_y: number; combatants: Combatant[];
}
export interface InteractResult { success: boolean; message: string; roll?: string; loot?: string; shop_id?: number }

export const vttPlayApi = {
  milestones: async (c: number | string) => (await api.get<Milestone[]>(`/campaigns/${c}/milestones`)).data,
  createMilestone: async (c: number | string, name: string) => (await api.post<Milestone>(`/campaigns/${c}/milestones`, { name })).data,
  updateMilestone: async (c: number | string, m: Milestone) => (await api.put<Milestone>(`/campaigns/${c}/milestones/${m.id}`, m)).data,
  objects: async (c: number | string, sceneId: number) => (await api.get<VTTObject[]>(`/campaigns/${c}/vtt/scenes/${sceneId}/objects`)).data,
  createObject: async (c: number | string, sceneId: number, o: Partial<VTTObject>) => (await api.post<VTTObject>(`/campaigns/${c}/vtt/scenes/${sceneId}/objects`, o)).data,
  updateObject: async (c: number | string, id: number, o: Partial<VTTObject>) => (await api.put<VTTObject>(`/campaigns/${c}/vtt/objects/${id}`, o)).data,
  deleteObject: (c: number | string, id: number) => api.delete(`/campaigns/${c}/vtt/objects/${id}`),
  resetObject: (c: number | string, id: number) => api.post(`/campaigns/${c}/vtt/objects/${id}/reset`),
  interact: async (c: number | string, id: number) => (await api.post<InteractResult>(`/campaigns/${c}/vtt/objects/${id}/interact`)).data,
  combats: async (c: number | string, sceneId: number) => (await api.get<VTTCombat[]>(`/campaigns/${c}/vtt/scenes/${sceneId}/combats`)).data,
  startCombat: (c: number | string, sceneId: number, tokenIds: number[]) => api.post(`/campaigns/${c}/vtt/scenes/${sceneId}/combats`, { token_ids: tokenIds }),
  combatAction: (c: number | string, combatId: number, action: 'next' | 'end' | 'pause' | 'extend' | 'dash') => api.post(`/campaigns/${c}/vtt/combats/${combatId}/${action}`),
  combatMove: async (c: number | string, combatId: number, tokenId: number, x: number, y: number) =>
    (await api.put<{ x: number; y: number }>(`/campaigns/${c}/vtt/combats/${combatId}/move`, { token_id: tokenId, x, y })).data,
  sneak: (c: number | string, tokenId: number, on: boolean) => api.put(`/campaigns/${c}/vtt/tokens/${tokenId}/sneak`, { on }),
};
