import type { Frame, Painter } from '../painter';
import type { Appearance, Part, RaceVisual } from '../types';

/** Everything a sprite layer needs to draw itself. */
export interface DrawCtx {
  p: Painter;
  f: Frame;
  a: Appearance;
  v: RaceVisual;
  parts: Set<Part>;
  skin: string;
  /** Darker skin for back limbs and shadows. */
  skinDark: string;
  hair: string;
}

export const INK = '#1a1414';
export const EYE_WHITE = '#f4f1ea';
