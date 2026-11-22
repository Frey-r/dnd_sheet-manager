// User & Auth
export type UserRole = 'admin' | 'dm' | 'player';

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  totp_enabled: boolean;
}


export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: User;
  requires_totp?: boolean;
}

export interface AuthChallenge {
  token?: string;
  refresh_token?: string;
  user: User;
  requires_totp?: boolean;
}

// Campaign
export interface Campaign {
  id: number;
  name: string;
  description: string;
  join_code: string;
  gm_user_id: number;
  status: 'active' | 'paused';
  game_mode: 'local' | 'foundry';
  /** Share of value_cp paid for Bastion goods (0–100, default 100). */
  bastion_sale_pct: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignMember {
  campaign_id: number;
  user_id: number;
  role: 'gm' | 'player';
  joined_at: string;
  username?: string;
}

// Character
export interface Character {
  id: number;
  user_id: number;
  campaign_id: number;
  name: string;
  race: string;
  class: string;
  level: number;
  background: string;
  alignment: string;
  str_score: number;
  dex_score: number;
  con_score: number;
  int_score: number;
  wis_score: number;
  cha_score: number;
  max_hp: number;
  current_hp: number;
  temp_hp: number;
  ac: number;
  speed: number;
  initiative_bonus: number;
  proficiency_bonus: number;
  inspiration: boolean;
  passive_perception: number;
  death_save_successes: number;
  death_save_failures: number;
  xp: number;
  gold: number;
  carrying_capacity: number;
  personality_traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  backstory_text: string;
  notes: string;
  spellcasting_ability: string;
  /** Pixel-art avatar (character-appearance.md); null → race default. */
  appearance?: unknown;
  created_at: string;
  updated_at: string;
}

export interface SpellSlot {
  id: number;
  character_id: number;
  level: number;
  total: number;
  used: number;
}

export interface CharacterFeature {
  id: number;
  character_id: number;
  name: string;
  description: string;
  type: 'class' | 'racial' | 'feat';
  uses_per_rest: number;
  rest_type: 'short' | 'long' | '';
}

// Inventory
export interface InventoryItem {
  id: number;
  character_id: number;
  name: string;
  item_type: ItemType;
  rarity: Rarity;
  weight: number;
  quantity: number;
  description: string;
  is_equipped: boolean;
  slot_type: string;
  requires_attunement: boolean;
  is_attuned: boolean;
  is_tradeable: boolean;
  quest_bound: boolean;
  trade_locked: boolean;
  created_at: string;
  updated_at: string;
}

export type ItemType = 'weapon' | 'armor' | 'potion' | 'scroll' | 'gear' | 'magic_item' | 'ammo' | 'misc';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';

export interface MarketplaceItem extends Omit<InventoryItem, 'character_id' | 'trade_locked'> {
  campaign_id: number;
  price: number;
  attunement_required: boolean;
}

// Spells
export interface Spell {
  id: number;
  character_id: number;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  duration: string;
  description: string;
  components: string;
  damage_type: string;
  prepared: boolean;
  created_at: string;
}

// Trade
export interface TradeOffer {
  id: number;
  campaign_id: number;
  offeror_character_id: number;
  recipient_character_id: number;
  offered_item_ids: number[];
  offered_gold: number;
  requested_item_ids: number[];
  requested_gold: number;
  status: TradeStatus;
  created_at: string;
  expires_at: string;
}

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

// Messages
export interface Message {
  id: number;
  campaign_id: number;
  sender_user_id: number;
  recipient_user_id?: number;
  message_type: 'gm_broadcast' | 'gm_direct' | 'player_direct';
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  other_user_id: number;
  other_username: string;
  conversation_type: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// Combat
export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  current_hp: number;
  max_hp: number;
  is_player: boolean;
  is_current_turn: boolean;
}

export interface CombatState {
  round: number;
  combatants: Combatant[];
  campaign_id: number;
}

// RAG
export interface LoreEntry {
  id: number;
  campaign_id: number;
  character_id?: number;
  title: string;
  content_text: string;
  lore_tier: 'character_lore' | 'campaign_plot' | 'gm_hidden_lore';
  chapter_order: number;
  created_at: string;
  updated_at: string;
  vectorized?: boolean;
  /** Derivado en el backend: la entrada ya tiene embedding y el Oráculo puede encontrarla. */
  is_vectorized?: boolean;
}

// GM entities
export interface NPC {
  id: number;
  campaign_id: number;
  name: string;
  role: string;
  status: 'ally' | 'enemy' | 'neutral';
  avatar_url?: string;
  ac?: number;
  hp?: number;
  speed?: number;
  description?: string;
  notes?: string;
}

export interface Creature {
  id: number;
  name: string;
  type: string;
  challenge_rating: string;
  size: string;
  ac: number;
  hp: number;
  speed: string;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills?: string[];
  resistances?: string[];
  immunities?: string[];
  actions: { name: string; description: string }[];
  image_url?: string;
}

export interface CampaignEvent {
  id: number;
  campaign_id: number;
  title: string;
  description: string;
  date: string;
  time?: string;
  npc_ids?: number[];
  location?: string;
}

export interface MapEntry {
  id: number;
  campaign_id: number;
  name: string;
  location: string;
  image_url: string;
  notes?: string;
}
