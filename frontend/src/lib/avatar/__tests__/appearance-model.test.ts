// @vitest-environment node
/* Data model guard (D-0003): the art redesign keeps `appearance` v1 and its id ranges. */
import { describe, expect, it } from 'vitest';
import { HAIR_STYLES, OUTFITS, normalizeAppearance, resolveRaceVisual } from '..';

describe('appearance model v1', () => {
  const human = resolveRaceVisual('Human');

  it('keeps 12 hair styles and 10 outfits with their stored ids', () => {
    expect(HAIR_STYLES).toHaveLength(12);
    expect(OUTFITS).toHaveLength(10);
    expect(HAIR_STYLES[8]).toBe('Melena');
    expect(OUTFITS[7]).toBe('Capa corta');
  });

  it('keeps a pre-redesign appearance unchanged', () => {
    const stored = { v: 1, body: 1, skin: '#c68642', eyes: '#3b6ea5', hair: 8, hairColor: '#2b1a10', outfit: 7, outfitColors: ['#7a2e2e', '#d9b26f'], feature: 0 };
    expect(normalizeAppearance(stored, human)).toEqual(stored);
  });

  it('falls back to race defaults for out-of-range ids', () => {
    const a = normalizeAppearance({ hair: 12, outfit: 10 }, human);
    expect(a.hair).toBeLessThanOrEqual(11);
    expect(a.outfit).toBeLessThanOrEqual(9);
  });
});
