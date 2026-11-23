// @vitest-environment node
/* T-8 (contratos/T-8-render-mutacion.md): the colour cache of render.ts retains what it parsed and stays bounded. */
import { describe, expect, it } from 'vitest';
import { defaultAppearance, resolveRaceVisual } from '..';
import { renderPixels } from '../render';
import { rgbaCacheSize } from '../metrics';

const human = resolveRaceVisual('Human');

function distinctOpaqueColours(px: Uint8ClampedArray): number {
  const seen = new Set<number>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    seen.add(((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]) >>> 0);
  }
  return seen.size;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

describe('render.ts colour cache', () => {
  it('M1 retains the colours of a render (it is not cleared on every insert)', () => {
    const px = renderPixels({ ...defaultAppearance(human), hair: 3, outfit: 8 }, human, '#4a90d9', 'sword');
    expect(rgbaCacheSize()).toBeGreaterThanOrEqual(distinctOpaqueColours(px));
  });

  it('M2 stays bounded with thousands of custom colours', () => {
    const base = defaultAppearance(human);
    for (let k = 0; k < 1300; k++) {
      // Each look brings new skin, hair, eye and cloth ramps: well over 5000 distinct colours in total.
      const c = (n: number) => hex((k * 4 + n) * 2654435761 % 0xffffff);
      renderPixels({ ...base, skin: c(0), hairColor: c(1), eyes: c(2), outfitColors: [c(3), c(0)] }, human);
    }
    // Eviction clears the whole map past 4096 entries, so the size after the loop depends on where the last clear fell.
    expect(rgbaCacheSize()).toBeGreaterThan(0);
    expect(rgbaCacheSize()).toBeLessThanOrEqual(4097);
  });
});
