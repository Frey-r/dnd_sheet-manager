// @vitest-environment node
/* Catalogue helpers of the creator (T-5, complement for the T-12 closure): classes grouped by base name with the
   core classes first and the rest alphabetically after them, the entry picked for a tile, and the book label of
   the version select (the book in the name wins over the `source` field). */
import { describe, expect, it } from 'vitest';
import type { SRDClass } from '../../../../types/srd';
import { bookLabel, groupClasses, preferredClass } from '../catalog';

const klass = (name: string, extra: Partial<SRDClass> = {}): SRDClass => ({
  id: 0, name, hit_die: 8, primary_ability: '', saving_throws: [], armor_proficiencies: [], weapon_proficiencies: [], tool_proficiencies: [],
  skill_choices: { count: 0, options: [] }, starting_equipment: '', spellcasting_ability: '', description: '', is_srd: false, ...extra,
});
const bases = (classes: SRDClass[]) => groupClasses(classes).map((g) => g.base);

describe('groupClasses (T-5)', () => {
  it('una clase no troncal que llega primero va después de las troncales', () => {
    expect(bases([klass('Blood Hunter'), klass('Fighter')])).toEqual(['Fighter', 'Blood Hunter']);
  });

  it('dentro de cada grupo, orden alfabético', () => {
    expect(bases([klass('Wizard'), klass('Warrior Sidekick'), klass('Fighter'), klass('Blood Hunter')]))
      .toEqual(['Fighter', 'Wizard', 'Blood Hunter', 'Warrior Sidekick']);
  });

  it('agrupa las entradas de cada libro bajo el nombre base, sin distinguir mayúsculas', () => {
    const phb = klass('Fighter (PHB)');
    const xphb = klass('fighter (XPHB)');
    const groups = groupClasses([phb, klass('Wizard'), xphb]);
    expect(groups.map((g) => g.base)).toEqual(['Fighter', 'Wizard']);
    expect(groups[0].entries).toEqual([phb, xphb]);
  });
});

describe('preferredClass (T-5)', () => {
  const group = (...entries: SRDClass[]) => ({ base: 'Fighter', entries });

  it('elige el libro de 2024, luego el de 2014, luego el SRD y si no la primera entrada', () => {
    const tce = klass('Fighter (TCE)');
    const srd = klass('Fighter', { is_srd: true });
    const phb = klass('Fighter', { source: 'PHB' });
    const xphb = klass("Fighter (Player's Handbook (2024))");
    expect(preferredClass(group(tce, srd, phb, xphb))).toBe(xphb);
    expect(preferredClass(group(tce, srd, phb))).toBe(phb);
    expect(preferredClass(group(tce, srd))).toBe(srd);
    expect(preferredClass(group(tce, klass('Fighter (EFA)')))).toBe(tce);
  });
});

describe('bookLabel (T-5)', () => {
  it('el libro entre paréntesis del nombre manda sobre el campo source', () => {
    expect(bookLabel({ name: 'Fighter (XPHB)', source: 'PHB' })).toBe("Player's Handbook (2024)");
  });

  it('sin libro en el nombre usa el campo source; sin ninguno, "Catálogo"', () => {
    expect(bookLabel({ name: 'Fighter', source: 'PHB' })).toBe("Player's Handbook (2014)");
    expect(bookLabel({ name: 'Fighter' })).toBe('Catálogo');
  });

  it('libros conocidos, desconocidos y Unearthed Arcana', () => {
    expect(bookLabel({ name: 'Artificer', source: 'TCE' })).toBe("Tasha's Cauldron of Everything");
    expect(bookLabel({ name: 'Artificer (Homebrew Book)' })).toBe('Homebrew Book');
    expect(bookLabel({ name: 'Mystic', source: 'UAMysticClass' })).toBe('UA: Mystic Class');
  });

  it('marca el SRD salvo cuando el libro ya es el SRD 5.1', () => {
    expect(bookLabel({ name: 'Fighter', source: 'XPHB', is_srd: true })).toBe("Player's Handbook (2024) · SRD");
    expect(bookLabel({ name: 'Fighter', source: 'Unknown', is_srd: true })).toBe('SRD 5.1');
  });
});
