/* Held prop by class (character-appearance.md § Art direction → Held prop), canonical body coordinates.
   The near hand (viewer's right) grips at CANON.nearHand: staves, maces, hammers and bows stand
   upright at the side, swords, axes and daggers hang lowered, the lute is slung on the back. Front
   props are drawn between the torso and the near arm, so the sleeve and the fist overlap the grip. */
import { ramp, type Ramp } from '../color';
import type { Painter } from '../painter';
import { INK } from './context';

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

/** Props slung on the back, drawn behind the body. */
export const BACK_PROPS: ReadonlySet<Prop> = new Set(['lute']);

const WOOD = ramp('#8a5a32');
const DARK_WOOD = ramp('#5a3a2c');
const STEEL = ramp('#b9c4d0');
const GOLD = ramp('#e0a83a');

/** Template keys: steel h l b s d (three tones) · wood w W and t (ink) · dark wood u U · gold G M F · orb O o x + glint. */
function keysOf(orb: Ramp): Record<string, string> {
  return {
    h: STEEL.hi, l: STEEL.light, b: STEEL.light, s: STEEL.shadow, d: STEEL.shadow,
    w: WOOD.light, W: WOOD.shadow, t: INK,
    u: DARK_WOOD.light, U: DARK_WOOD.shadow,
    G: GOLD.light, M: GOLD.base, F: GOLD.shadow,
    O: orb.light, o: orb.base, x: orb.shadow, '+': orb.hi,
  };
}

interface PropArt { x: number; y: number; rows: readonly string[] }

/* Staff: a dark shaft from the ground to above the shoulder, an orb of the class colour in a forked head. */
const STAFF: PropArt = {
  x: 34, y: 15,
  rows: [
    '.u...U',
    '.uO+oU',
    '.uooxU',
    '..xxU.',
    '..uUU.',
    '..uU..',
    ...Array.from({ length: 32 }, () => '..uU..'),
  ],
};

/* Sword hanging from the fist: gold crossguard under the hand, blade to the shin. */
const SWORD: PropArt = {
  x: 33, y: 44,
  rows: [
    '..WW..',
    'GMMMMF',
    '..hs..',
    '..ls..',
    '..ls..',
    '..ls..',
    '..ls..',
    '..ss..',
    '..s...',
  ],
};

/* Axe held low: the haft runs down from the fist, the crescent head hangs by the shin, edge out. */
const AXE: PropArt = {
  x: 36, y: 41,
  rows: [
    'wW....',
    'wW....',
    'wW....',
    'wWsh..',
    'wWllh.',
    'wWlllh',
    'wWsllh',
    'wWsslh',
    'wWssh.',
    'wWsh..',
    'wW....',
    '.t....',
  ],
};

/* Dagger: a short blade pointing down out of the fist. */
const DAGGER: PropArt = {
  x: 34, y: 44,
  rows: [
    '.WW.',
    'GMMF',
    '.hs.',
    '.ls.',
    '.ls.',
    '.bs.',
    '.d..',
  ],
};

/* Mace upright: flanged steel head at shoulder height, wooden grip through the fist. */
const MACE: PropArt = {
  x: 34, y: 29,
  rows: [
    '..h...',
    '.lhb..',
    'lhbbs.',
    'hbbbsd',
    '.bbsd.',
    '..sd..',
    '..GF..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..wW..',
    '..tt..',
  ],
};

/* Hammer upright: a square steel head with a gold band, wooden haft through the fist. */
const HAMMER: PropArt = {
  x: 33, y: 29,
  rows: [
    '.hlllbs',
    'hllbbbs',
    'lbbbbsd',
    'lGMMMFd',
    '.sssdd.',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...wW..',
    '...tt..',
  ],
};

/* Bow upright, held at the grip: limbs bowing out to the right, the string on the inner side. */
const BOW: PropArt = {
  x: 35, y: 26,
  rows: [
    '...w.',
    '...wW',
    'h...wW',
    'h...wW',
    'h....wW',
    'h....wW',
    'h....wW',
    'h.....wW',
    'h.....wW',
    'h.....wW',
    'h.....GF',
    'h.....GF',
    'h.....GF',
    'h.....GF',
    'h.....GF',
    'h.....GF',
    'h.....wW',
    'h.....wW',
    'h.....wW',
    'h.....wW',
    'h....wW',
    'h....wW',
    'h....wW',
    'h...wW',
    'h...wW',
    '...wW',
    '...w.',
  ],
};

/* Lute slung on the back: the neck and pegbox rise over the near shoulder, the wooden bowl shows past
   the near arm. */
const LUTE: PropArt = {
  x: 31, y: 22,
  rows: [
    '..tt.......',
    '.twWt......',
    '..wW.......',
    '..wW.......',
    '...wW......',
    '...wW......',
    '...wW......',
    '....wW.....',
    '....wW.....',
    '....wW.....',
    '....wwW....',
    '...wwwwW...',
    '..wwwwwWW..',
    '..wwwwwwWW.',
    '.wwwwwwwWWt',
    '.wwwwwwWWWt',
    '.wwwwwwWWWt',
    '.wwwwwwWWWt',
    '..wwwwWWWt.',
    '..wwWWWWtt.',
    '...ttttt...',
  ],
};

const ART: Record<Prop, PropArt> = { staff: STAFF, sword: SWORD, axe: AXE, dagger: DAGGER, mace: MACE, hammer: HAMMER, bow: BOW, lute: LUTE };

/** Draws the prop; staves carry an orb of the aura colour (pale blue without one). */
export function drawProp(p: Painter, prop: Prop, aura: string | null) {
  const art = ART[prop];
  p.tag = 'prop';
  p.stamp(art.x, art.y, art.rows, keysOf(ramp(aura ?? '#7ad0f0')));
  p.tag = null;
}
