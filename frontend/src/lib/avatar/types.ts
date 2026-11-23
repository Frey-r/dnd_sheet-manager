/* Pixel-art avatar model (openspec/specs/character-appearance.md). */
import { isHex } from './color';
import { CLOTH, EYES, HAIR, SKIN, type SkinKey } from './palettes';

/** Stored on the character (`characters.appearance`). Family and aura are derived, not stored. */
export interface Appearance {
  v: 1;
  body: 0 | 1;
  skin: string;
  eyes: string;
  /** 0 = bald, 1–11 styles (HAIR_STYLES). Any body may use any style; ids 0–8 predate the chibi redesign and keep their meaning. */
  hair: number;
  hairColor: string;
  /** 0–9 (OUTFITS). Any body may use any outfit; ids 0–7 predate the chibi redesign and keep their meaning. */
  outfit: number;
  outfitColors: [string, string];
  /** Race option 0–3. */
  feature: number;
}

export const HAIR_STYLES = ['Calvo', 'Corto', 'Puntas', 'Coleta', 'Cresta', 'Largo', 'Trenza', 'Moño', 'Melena', 'Media melena', 'Dos coletas', 'Ondas'] as const;
export const OUTFITS = ['Túnica', 'Jubón', 'Camisa y chaleco', 'Abrigo largo', 'Vestido', 'Corsé y falda', 'Blusa y pantalón', 'Capa corta', 'Armadura ligera', 'Túnica de mago'] as const;
export const BODIES = ['Complexión ancha', 'Complexión esbelta'] as const;
const MAX_HAIR = HAIR_STYLES.length - 1;
const MAX_OUTFIT = OUTFITS.length - 1;

/** S small, D short and stocky (dwarves), M medium, L large. */
export type Size = 'S' | 'D' | 'M' | 'L';
export type HeadType = 'human' | 'beast' | 'beak' | 'reptile' | 'elephant' | 'insect' | 'skull' | 'fish' | 'frog' | 'ooze';

/** Drawable add-ons. Each is implemented in sprites/features.ts. */
export type Part =
  | 'ears-elf' | 'ears-elf-short' | 'ears-swept' | 'ears-gnome' | 'ears-none'
  | 'ears-cat' | 'ears-rabbit' | 'ears-mouse' | 'ears-dog' | 'ears-bear' | 'ears-fox' | 'ears-floppy'
  | 'horns-curved' | 'horns-ram' | 'horns-straight' | 'horns-nubs' | 'horns-antlers' | 'horns-bull' | 'horns-back'
  | 'tail-devil' | 'tail-reptile' | 'tail-cat' | 'tail-fox' | 'tail-horse' | 'tail-rat' | 'tail-stub'
  | 'wings-fairy' | 'wings-feather' | 'wings-bat'
  | 'halo' | 'glow-eyes' | 'tusks' | 'fangs' | 'whiskers'
  | 'beard-full' | 'beard-braided' | 'beard-short' | 'sideburns'
  | 'shell' | 'frill' | 'spines' | 'crest' | 'mane' | 'antennae' | 'fins' | 'gills' | 'stripes' | 'spots'
  | 'flame-hair' | 'water-hair' | 'stone-hair' | 'air-hair'
  | 'tattoo' | 'gem' | 'plates' | 'visor' | 'stitches' | 'mushroom-cap' | 'leaves' | 'scar' | 'mark'
  | 'freckles' | 'third-eye' | 'cyclops' | 'trunk-tusks' | 'shadow';

export interface RaceOption { label: string; parts: Part[] }

export interface RaceVisual {
  /** Visual family id (stable, used for grouping thumbnails). */
  key: string;
  label: string;
  size: Size;
  head: HeadType;
  /** Whether hair styles apply; otherwise hairColor is the "accent" colour. */
  hair: boolean;
  skin: SkinKey;
  /** Always drawn. */
  base: Part[];
  /** 1–4 race options (Appearance.feature). */
  options: RaceOption[];
  accentLabel?: string;
  defaults?: Partial<Omit<Appearance, 'v'>>;
}

export function skinsFor(visual: RaceVisual): readonly string[] {
  return SKIN[visual.skin];
}

export function defaultAppearance(visual: RaceVisual): Appearance {
  const d = visual.defaults ?? {};
  return {
    v: 1,
    body: d.body ?? 0,
    skin: d.skin ?? SKIN[visual.skin][Math.min(2, SKIN[visual.skin].length - 1)],
    eyes: d.eyes ?? EYES[0],
    hair: visual.hair ? (d.hair ?? 1) : 0,
    hairColor: d.hairColor ?? HAIR[2],
    outfit: d.outfit ?? 0,
    outfitColors: d.outfitColors ?? [CLOTH[0], CLOTH[2]],
    feature: d.feature ?? 0,
  };
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

/**
 * Accepts anything (stored JSON, partial edits) and returns a valid appearance for the race:
 * out-of-range indices and malformed colours fall back to the race default; a race option the race
 * does not have is clamped. Any valid skin hex is kept, even outside the race palette: the palette is a
 * suggestion and drawing/editing respects a custom tone (D-0034). `strictSkin` replaces a skin outside the
 * palette with the race default; only the creator's race change uses it (creator/look.ts).
 */
export function normalizeAppearance(raw: unknown, visual: RaceVisual, strictSkin = false): Appearance {
  const d = defaultAppearance(visual);
  if (!raw || typeof raw !== 'object') return d;
  const a = raw as Partial<Appearance>;
  const skins = skinsFor(visual);
  let skin = isHex(a.skin) ? a.skin : d.skin;
  if (strictSkin && !skins.includes(skin)) skin = d.skin;
  const colors = Array.isArray(a.outfitColors) ? a.outfitColors : [];
  return {
    v: 1,
    body: a.body === 1 ? 1 : 0,
    skin,
    eyes: isHex(a.eyes) ? a.eyes : d.eyes,
    hair: visual.hair ? clampInt(a.hair, 0, MAX_HAIR, d.hair) : 0,
    hairColor: isHex(a.hairColor) ? a.hairColor : d.hairColor,
    outfit: clampInt(a.outfit, 0, MAX_OUTFIT, d.outfit),
    outfitColors: [isHex(colors[0]) ? colors[0] : d.outfitColors[0], isHex(colors[1]) ? colors[1] : d.outfitColors[1]],
    feature: Math.min(clampInt(a.feature, 0, 3, 0), Math.max(0, visual.options.length - 1)),
  };
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export function randomAppearance(visual: RaceVisual): Appearance {
  return {
    v: 1,
    body: Math.random() < 0.5 ? 0 : 1,
    skin: pick(skinsFor(visual)),
    eyes: pick(EYES),
    hair: visual.hair ? Math.floor(Math.random() * HAIR_STYLES.length) : 0,
    hairColor: pick(HAIR),
    outfit: Math.floor(Math.random() * OUTFITS.length),
    outfitColors: [pick(CLOTH), pick(CLOTH)],
    feature: Math.floor(Math.random() * Math.max(1, visual.options.length)),
  };
}

/** Parses the `appearance` field of a character (object, JSON string or null). */
export function parseStoredAppearance(value: unknown): unknown {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value ?? null;
}
