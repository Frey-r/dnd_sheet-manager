/* Portrait look of each base race in the race grid (character-appearance.md, "Creation wizard"):
   the family default (skin, race option) with hair style, hair colour and outfit colour picked
   from the race name, so every tile is distinct and stable like the WoW race icons. */
import { CLOTH, COMMON_RACES, HAIR, HAIR_STYLES, defaultAppearance, resolveRaceVisual, type Appearance } from '../../../lib/avatar';
import { hashString } from '../../../lib/avatar/color';

/** Natural hair colours (black → white, plus red); the fantasy ones stay for the player to pick. */
const NATURAL_HAIR = HAIR.slice(0, 9);

const cache = new Map<string, Appearance>();

/**
 * Deterministic thumbnail look for a base race in a body type. Cached per base race, catalogue
 * entry and body, so the same object comes back on every render and `avatarCanvas` keeps its hit.
 */
export function raceThumbLook(base: string, entry: { id: number; name: string; size?: string }, body: 0 | 1): Appearance {
  const key = `${base.toLowerCase()}|${entry.id}|${body}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const visual = resolveRaceVisual(entry.name, entry.size);
  const d = defaultAppearance(visual);
  // Common races (shown first, side by side) step through styles and colours with strides coprime
  // with the list sizes, so neighbours never share either; the rest pick them from a name hash.
  const common = COMMON_RACES.findIndex((c) => c.toLowerCase() === base.toLowerCase());
  const h = hashString(base.toLowerCase());
  const styles = HAIR_STYLES.length - 1; // style 0 is bald: thumbnails always show a hairdo
  const styleAt = common >= 0 ? (common * 7) % styles : (h >>> 3) % styles;
  const colorAt = common >= 0 ? (common * 4 + 1) % NATURAL_HAIR.length : (h >>> 9) % NATURAL_HAIR.length;
  const look: Appearance = {
    ...d,
    body,
    hair: visual.hair ? 1 + styleAt : 0,
    // Families with a signature colour (drow white, genasi flames…) keep it.
    hairColor: visual.hair && !visual.defaults?.hairColor ? NATURAL_HAIR[colorAt] : d.hairColor,
    outfitColors: [CLOTH[(h >>> 15) % CLOTH.length], d.outfitColors[1]],
  };
  cache.set(key, look);
  return look;
}
