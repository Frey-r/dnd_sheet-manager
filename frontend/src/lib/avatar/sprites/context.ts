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
  /** Class colour (aura) or null; staves carry an orb of this colour. */
  aura: string | null;
}

export const INK = '#261a14';
export const EYE_WHITE = '#eef6f4';

/**
 * Template keys of one ramp: h highlight, l light, b base, s shadow, d deep, x cool dark, X ink.
 * Used by hair, skin and race parts.
 */
export const keys = (r: Ramp, extra: Record<string, string> = {}): Record<string, string> => ({
  h: r.hi, l: r.light, b: r.base, s: r.shadow, d: r.deep, x: r.cool, X: r.ink, ...extra,
});
