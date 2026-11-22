import type { Ramp } from '../color';
import type { Frame, Painter } from '../painter';
import type { Appearance, Part, RaceVisual } from '../types';

/** Everything a sprite layer needs to draw itself. */
export interface DrawCtx {
  p: Painter;
  f: Frame;
  a: Appearance;
  v: RaceVisual;
  parts: Set<Part>;
  /** Cel-shading ramps of the chosen colours. */
  skin: Ramp;
  hair: Ramp;
  eyes: Ramp;
  cloth: [Ramp, Ramp];
}

export const INK = '#1e1620';
export const EYE_WHITE = '#f6f3ee';
