/* Held prop by class (character-appearance.md, "Held prop"), drawn behind the raised fist in
   canonical body coordinates. The fist grips at about (34, 34). */
import { ramp, type Ramp } from '../color';
import type { Painter } from '../painter';

export type Prop = 'staff' | 'sword' | 'axe' | 'bow' | 'dagger' | 'mace' | 'lute' | 'hammer';

const PROPS: [RegExp, Prop | null][] = [
  [/wizard|mago|sorcerer|hechicero|warlock|brujo|druid|druida|psion|mystic|m[ií]stico|shaman|cham[aá]n|witch/, 'staff'],
  [/fighter|guerrero|paladin|palad[ií]n|blood ?hunter|cazador de sangre|knight|caballero|samurai/, 'sword'],
  [/barbarian|b[aá]rbaro/, 'axe'],
  [/ranger|explorador|guardabosques|hunter|cazador/, 'bow'],
  [/rogue|p[ií]caro|assassin|asesino/, 'dagger'],
  [/cleric|cl[eé]rigo|priest|sacerdote/, 'mace'],
  [/bard|bardo/, 'lute'],
  [/artificer|art[ií]fice|tinker/, 'hammer'],
  [/monk|monje/, null],
];

/** Prop for a class name (EN/ES), or null (monks, homebrew classes, no class). */
export function propForClass(className: string | null | undefined): Prop | null {
  const name = (className ?? '').trim().toLowerCase();
  if (!name) return null;
  for (const [re, prop] of PROPS) if (re.test(name)) return prop;
  return null;
}

const WOOD = ramp('#8a5a32');
const DARK_WOOD = ramp('#5a3a2c');
const STEEL = ramp('#b9c4d0');
const GOLD = ramp('#f2b632');

/** Two-pixel shaft from (x1, y1) (bottom) to (x2, y2) (top): lit left pixel, shaded right one. */
function shaft(p: Painter, x1: number, y1: number, x2: number, y2: number, r: Ramp) {
  for (let y = y1; y >= y2; y--) {
    const x = Math.round(x1 + ((x2 - x1) * (y1 - y)) / Math.max(1, y1 - y2));
    p.set(x, y, r.light);
    p.set(x + 1, y, r.shadow);
  }
}

const k = (r: Ramp, extra: Record<string, string> = {}) => ({ h: r.hi, l: r.light, b: r.base, s: r.shadow, d: r.deep, ...extra });

export function drawProp(p: Painter, prop: Prop, aura: string | null) {
  p.tag = 'prop';
  const orb = ramp(aura ?? '#7ad0f0');
  switch (prop) {
    case 'staff': {
      // Thin dark shaft from below the fist to a big crescent opening to the upper left, with an
      // orb of the class colour where they meet (like the reference staff).
      shaft(p, 33, 38, 39, 20, DARK_WOOD);
      // Hand-drawn crescent: thin tip at the top left, thick heavy base, lit outer rim.
      p.stamp(38, 3, [
        '....FLMG',
        '..FL...MGY',
        '.F......GY',
        '........MG',
        '.......LMG',
        '.......LMG',
        '......LMMG',
        '......LMGY',
        '.....LMMG',
        '....FLMGG',
        '...FLMMG',
        '..FLLMG',
        '.FLLMG',
        '..FLL',
      ], { Y: '#fdf780', G: '#fed958', M: '#f7b61f', L: '#eaa211', F: '#bd7720' });
      p.stamp(39, 16, ['.xx.', 'xoOw', 'xooo', '.xx.'], { x: orb.deep, o: orb.base, O: orb.light, w: '#ffffff' });
      // Sparkle beside the crescent (no outline, like the reference's).
      p.tag = 'flow';
      p.dots([[44, 22], [43, 23], [45, 23], [44, 24]], '#fed958');
      p.set(44, 23, '#fdf780');
      break;
    }
    case 'sword': {
      // Pommel, grip in the fist, crossguard, long blade with a lit edge.
      p.stamp(32, 13, [
        '...h',
        '..hl',
        '..hl',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '..ls',
        '.GMML.',
        'FLLLLF',
        '..cc',
        '..cc',
        '..cc',
        '..cc',
        '..cc',
        '..GM',
      ], { ...k(STEEL), G: GOLD.light, M: GOLD.base, L: GOLD.shadow, F: GOLD.deep, c: WOOD.shadow });
      break;
    }
    case 'axe': {
      shaft(p, 32, 46, 36, 16, WOOD);
      p.stamp(35, 12, [
        '..lh',
        '.lbbh',
        'sbbbbh',
        'sbbbbbl',
        'dsbbbbl',
        '.dsbbbl',
        '..dsbl',
        '...dd',
      ], k(STEEL));
      p.stamp(35, 15, ['ll', 'ss'], k(WOOD));
      break;
    }
    case 'bow': {
      // Bow held upright, bulging right, with a straight string on the left.
      const pts: [number, number][] = [];
      for (let y = 14; y <= 52; y++) {
        const t = (y - 33) / 19;
        pts.push([Math.round(35 + 4 * (1 - t * t)), y]);
      }
      for (const [x, y] of pts) { p.set(x, y, WOOD.light); p.set(x + 1, y, WOOD.shadow); }
      for (let y = 15; y <= 51; y++) p.set(34, y, '#e8e2d0aa');
      p.stamp(38, 31, ['GM', 'LF', 'GM', 'LF'], { G: GOLD.light, M: GOLD.base, L: GOLD.shadow, F: GOLD.deep });
      break;
    }
    case 'dagger': {
      p.stamp(33, 22, [
        '..h',
        '.hl',
        '.ls',
        '.ls',
        '.ls',
        '.ls',
        '.ls',
        'GMML',
        '.cc',
        '.cc',
        '.cc',
        '.cc',
        '.GM',
      ], { ...k(STEEL), G: GOLD.light, M: GOLD.base, L: GOLD.shadow, c: WOOD.shadow });
      break;
    }
    case 'mace': {
      shaft(p, 33, 41, 35, 20, WOOD);
      p.stamp(32, 13, [
        '...h..',
        '.l.hl.',
        'lbbbbs',
        'hbbbbs',
        'lbbbbd',
        '.s.ss.',
        '..sd..',
      ], k(STEEL));
      p.stamp(34, 20, ['GM'], { G: GOLD.light, M: GOLD.base });
      break;
    }
    case 'lute': {
      // Neck rising from the fist to the head; round body resting against the far hip.
      shaft(p, 34, 36, 39, 18, WOOD);
      p.stamp(38, 15, ['.ll', 'lbb', 'bbs', '.s.'], k(WOOD));
      const body = ramp('#c08a4a');
      p.stamp(30, 35, [
        '..lbbb.',
        '.lbbbbbs',
        'lbbdbbbs',
        'lbdddbbs',
        'lbbdbbbs',
        '.bbbbbs',
        '..sss',
      ], k(body));
      break;
    }
    case 'hammer': {
      shaft(p, 32, 45, 36, 19, WOOD);
      p.stamp(32, 13, [
        '.lhhhhl',
        'lbbbbbbs',
        'lbbbbbbs',
        'sbbbbbbd',
        '.ssddss',
      ], k(STEEL));
      p.stamp(35, 18, ['GM'], { G: GOLD.light, M: GOLD.base });
      break;
    }
  }
  p.tag = null;
}
