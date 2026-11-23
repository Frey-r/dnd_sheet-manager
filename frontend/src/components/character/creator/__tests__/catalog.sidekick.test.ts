// @vitest-environment node
/* T-12 · K1 Detección de clases sidekick (contratos/T-12-sin-sidekicks-jugadores.md).
   isSidekickClass mira el nombre base (sin el libro entre paréntesis): /sidekick|compa(ñ|n)ero/i. */
import { describe, expect, it } from 'vitest';
import { isSidekickClass } from '../catalog';

describe('isSidekickClass (T-12 K1)', () => {
  it.each([
    'Expert Sidekick',
    "Spellcaster Sidekick (Tasha's Cauldron of Everything)",
    'Warrior Sidekick',
    'Compañero guerrero',
    'Companero experto',
    'warrior sidekick',
  ])('reconoce "%s" como clase sidekick', (name) => {
    expect(isSidekickClass(name)).toBe(true);
  });

  it.each([
    'Fighter',
    'Wizard',
    "Rogue (Player's Handbook (2024))",
    'Blood Hunter',
    // "sobre el nombre base": el libro no cuenta.
    'Fighter (Sidekick Compendium)',
    '',
  ])('no reconoce "%s"', (name) => {
    expect(isSidekickClass(name)).toBe(false);
  });

  it('no reconoce null ni undefined', () => {
    expect(isSidekickClass(null)).toBe(false);
    expect(isSidekickClass(undefined)).toBe(false);
  });
});
