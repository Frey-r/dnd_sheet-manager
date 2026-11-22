/* Look state of the creator: the race decides the body family, so race and appearance change
   together (character-appearance.md, "Creation wizard"; D-0003 keeps the stored model). */
import type { SRDRace } from '../../../types/srd';
import { defaultAppearance, normalizeAppearance, resolveRaceVisual, type Appearance, type RaceVisual } from '../../../lib/avatar';

export interface Look {
  race: SRDRace | null;
  appearance: Appearance;
  /** Hair choices the player made by hand in this session (only on families with hair). */
  manual: { hair?: number; hairColor?: string };
}

export type LookAction =
  | { type: 'race'; race: SRDRace }
  | { type: 'body'; body: 0 | 1 }
  | { type: 'appearance'; appearance: Appearance };

const visualOf = (race: SRDRace | null): RaceVisual => resolveRaceVisual(race?.name ?? 'Human', race?.size);

export const initialLook = (): Look => ({ race: null, appearance: defaultAppearance(visualOf(null)), manual: {} });

/**
 * Changing to a race of another body family keeps body, eyes, outfit and its colours; takes the
 * family's skin (when it sets one) and race option; and for hair:
 * - a family without hair uses its accent colour and no hair style;
 * - a family with hair uses the style and colour the player picked by hand in this session, or
 *   else the family default (so Tabaxi → Elf is never bald, Elf → Drow turns white-haired).
 */
export function lookReducer(state: Look, action: LookAction): Look {
  if (action.type === 'body') {
    return state.appearance.body === action.body ? state : { ...state, appearance: { ...state.appearance, body: action.body } };
  }
  if (action.type === 'appearance') {
    const prev = state.appearance;
    const next = action.appearance;
    if (!visualOf(state.race).hair) return { ...state, appearance: next };
    const manual = {
      ...state.manual,
      ...(next.hair !== prev.hair ? { hair: next.hair } : {}),
      ...(next.hairColor !== prev.hairColor ? { hairColor: next.hairColor } : {}),
    };
    return { ...state, appearance: next, manual };
  }
  const prevVisual = visualOf(state.race);
  const nextVisual = visualOf(action.race);
  if (nextVisual.key === prevVisual.key) return { ...state, race: action.race };
  const kept = normalizeAppearance(state.appearance, nextVisual, true);
  const d = defaultAppearance(nextVisual);
  const hair = nextVisual.hair
    ? { hair: state.manual.hair ?? d.hair, hairColor: state.manual.hairColor ?? d.hairColor }
    : { hair: 0, hairColor: d.hairColor };
  return {
    ...state,
    race: action.race,
    appearance: { ...kept, ...hair, feature: d.feature, skin: nextVisual.defaults?.skin ?? kept.skin },
  };
}
