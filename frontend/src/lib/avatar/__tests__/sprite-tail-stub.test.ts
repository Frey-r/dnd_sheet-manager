// @vitest-environment node
/* T-9 (contratos/T-9-cola-corta-visible.md): the short tail peeks out behind the hips, on the right, in every size. */
import { describe, expect, it } from 'vitest';
import { ALL_FAMILY_KEYS, defaultAppearance, visualByKey, type RaceVisual, type Size } from '..';
import { renderPixels } from '../render';
import { spriteMetrics } from '../metrics';

const W = 48;
const H = 56;
const SIZES: Size[] = ['S', 'D', 'M', 'L'];
const families = ALL_FAMILY_KEYS.map((k) => visualByKey(k)!).filter((v) => v.base.includes('tail-stub'));

const withoutStub = (v: RaceVisual): RaceVisual => ({ ...v, base: v.base.filter((p) => p !== 'tail-stub') });
const opaque = (px: Uint8ClampedArray, i: number) => px[i * 4 + 3] > 0;

function changed(a: Uint8ClampedArray, b: Uint8ClampedArray): number[] {
  const out: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2] || a[o + 3] !== b[o + 3]) out.push(i);
  }
  return out;
}

/** Every changed pixel reaches the silhouette of `base` through changed pixels (8-connectivity). */
function attached(diff: number[], base: Uint8ClampedArray): boolean {
  const inDiff = new Set(diff);
  const seen = new Set<number>();
  const queue: number[] = [];
  for (const i of diff) {
    const x = i % W, y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!inDiff.has(j) && opaque(base, j)) { seen.add(i); queue.push(i); dy = 2; break; }
    }
  }
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % W, y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = (y + dy) * W + x + dx;
      if (inDiff.has(j) && !seen.has(j)) { seen.add(j); queue.push(j); }
    }
  }
  return seen.size === diff.length;
}

describe('T-9 tail-stub', () => {
  it('covers the families that use it', () => {
    expect(families.map((v) => v.key).sort()).toEqual(['cervan', 'gnoll', 'harengon', 'satyr']);
  });

  for (const fam of families) {
    for (const size of SIZES) {
      for (const body of [0, 1] as const) {
        it(`S1–S3 ${fam.key} ${size}${body}: visible, behind on the right, attached`, () => {
          const v = { ...fam, size };
          const a = { ...defaultAppearance(v), body };
          const with_ = renderPixels(a, v);
          const without = renderPixels(a, withoutStub(v));
          const diff = changed(with_, without);
          expect(diff.length, 'S1 píxeles visibles de la cola').toBeGreaterThanOrEqual(4);
          const fig = spriteMetrics(a, v).figure;
          const waist = fig.y + Math.round(fig.h * 0.55);
          for (const i of diff) {
            expect(i % W, 'S2 a la derecha del centro del cuerpo').toBeGreaterThan(23);
            expect(Math.floor(i / W), 'S2 por debajo de la cintura').toBeGreaterThanOrEqual(waist);
          }
          expect(attached(diff, without), 'S3 pegada a la silueta').toBe(true);
        });
      }
    }
  }
});
