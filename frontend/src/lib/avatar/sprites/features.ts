/* Race parts of the HD-2D avatar (character-appearance.md, "Race families"): ears, horns, tails,
   wings, beards, elemental hair, marks… Front three-quarter view turned to the viewer's left: the
   face is on the left of the skull and the back of the head, the back and the hips on the right, so
   snouts and marks sit on the left, tails and wings come out behind the body on the right, and the
   near-side ear or horn (viewer's right) is bigger than the far one, which is partly hidden.
   Layers:
   body-back – canonical body coordinates, behind the body (tails, wings, shell, smoke)
   back      – behind the body, the hair and the head (mane, frill, far horns, back of water hair)
   skin      – on the bare head before the face and hair (spots, stripes)
   face      – after the eyes, under the hair (marks, tusks, whiskers, visor)
   head      – over the hair (ears, near horns, beards, crests, elemental hair, halo)
   Every part is tagged 'part' except the mass of elemental hair, which is hair ('hair'). */
import { mix, ramp, type Ramp } from '../color';
import { CANON, FOOT_Y, type Painter } from '../painter';
import { BONE, HORN } from '../palettes';
import type { Part } from '../types';
import { FACE_COLS, castHairShadow } from './body';
import { INK, keys, type DrawCtx } from './context';

export type Layer = 'body-back' | 'back' | 'skin' | 'face' | 'head';

type Drawer = (c: DrawCtx, p: Painter) => void;

const HORN_R = ramp(HORN);
const BONE_R = ramp(BONE);
const GOLD_R = ramp('#f7b61f');
const ANTLER_R = ramp('#c9b48a');
const LEAF_R = ramp('#5a9a3a');

/** Accent ramp: hair colour, used for crests, fins, plumage, shells, elemental hair. */
const acc = (c: DrawCtx) => c.hair;

/** Thick polyline (tails), width shrinking from w0 to w1; lit top pixel, shaded bottom one. */
function path(p: Painter, pts: readonly (readonly [number, number])[], r: Ramp, w0 = 2, w1 = 1) {
  const total = pts.length - 1;
  for (let s = 0; s < total; s++) {
    const [x1, y1] = pts[s];
    const [x2, y2] = pts[s + 1];
    const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= n; i++) {
      const t = (s + i / n) / total;
      const w = Math.max(1, Math.round(w0 + (w1 - w0) * t));
      const x = Math.round(x1 + ((x2 - x1) * i) / n);
      const y = Math.round(y1 + ((y2 - y1) * i) / n);
      for (let k = 0; k < w; k++) p.set(x, y + k, k === 0 ? r.light : k === w - 1 ? r.shadow : r.base);
    }
  }
}

/* ── Body-back: tails, wings, shell and smoke, in canonical body coordinates (medium body A) ──────
   The back is on the viewer's right: tails leave from behind the near hip (CANON.tail) and curl
   outwards to the right; wings leave the upper back (CANON.back), the near wing spreading to the right
   and the tip of the far one peeking over the left shoulder. Every part stays within 16 columns right
   of its anchor (the large body adds two more) and above the soles (FOOT_Y), so the figure keeps its
   1-px margin. */

const SPADE = ['.l..', 'lbs.', 'lbbs', '.bs.'];

const FEATHER_NEAR = [
  '.........hll',
  '.......hllbb',
  '.....hllbbbs',
  '...hllbbbbss',
  '..hlbbbbbsss',
  '.hlbbbbsbss.',
  'hlbbsbbsbs..',
  'lbbsbbsbbs..',
  'lbsbbsbbs...',
  'lbsbsbbs....',
  '.bsbsbs.....',
  '.bsbsbs.....',
  '..sbsb......',
  '..s.s.......',
];
const FEATHER_FAR = [
  '...ll',
  '..lbs',
  '.lbbs',
  'lbbs.',
  'lbsb.',
  'bsbs.',
  'bsb..',
  '.s...',
];
const BAT_NEAR = [
  '..........ll',
  '.........lbd',
  '........lbbd',
  '.......lbbbd',
  '......lbsbbd',
  '.....lbssbbd',
  '....lbsssbd.',
  '...lbssssbd.',
  '..lbssd.sbd.',
  '.lbsd...sd..',
  'lbd.....d...',
  'bd..........',
];
const BAT_FAR = ['..ld', '.lbd', 'lbsd', 'bsd.', 'd...'];

/* Body anchors (CANON): the root of the tails behind the near hip, the upper back where wings
   start, the body's centre column and the shoulder line; FOOT_Y is the last row of the soles. */
const T = CANON.tail;
const B = CANON.back;
const MID = CANON.neckX;
const TOP = CANON.torsoTop;

const BODY_BACK: Partial<Record<Part, Drawer>> = {
  'tail-devil': (c, p) => {
    const r = ramp(c.skin.shadow);
    path(p, [[T.x - 1, T.y + 1], [T.x + 4, T.y + 4], [T.x + 9, T.y + 3], [T.x + 12, T.y - 1], [T.x + 12, T.y - 6]], r, 2, 1);
    p.stamp(T.x + 11, T.y - 10, SPADE, keys(r));
  },
  'tail-reptile': (c, p) => path(p, [[T.x - 3, T.y], [T.x + 2, T.y + 4], [T.x + 7, FOOT_Y - 5], [T.x + 11, FOOT_Y - 2], [T.x + 15, FOOT_Y - 1]], c.skin, 4, 1),
  'tail-cat': (c, p) => {
    path(p, [[T.x - 1, T.y + 1], [T.x + 5, T.y + 4], [T.x + 10, T.y + 2], [T.x + 12, T.y - 3], [T.x + 11, T.y - 9]], c.skin, 2, 2);
    p.dots([[T.x + 11, T.y - 10], [T.x + 12, T.y - 10]], acc(c).base);
  },
  'tail-fox': (c, p) => {
    p.ellipse(T.x + 7, T.y + 2, 7, 4, c.skin.shadow);
    p.ellipse(T.x + 7, T.y + 1, 6, 3, c.skin.base);
    p.ellipse(T.x + 6, T.y, 4, 1.5, c.skin.light);
    p.ellipse(T.x + 13, T.y, 2, 2.5, '#f4efe4');
  },
  'tail-horse': (c, p) => {
    const r = acc(c);
    const len = Math.min(12, FOOT_Y - T.y - 4);
    for (let t = 0; t < len; t++) {
      const x = T.x + Math.round(t * 0.5);
      p.hline(x, x + 2, T.y + 2 + t, t % 3 === 0 ? r.light : r.base);
      p.set(x + 2, T.y + 2 + t, r.shadow);
    }
  },
  'tail-rat': (_c, p) => path(p, [[T.x - 1, T.y + 3], [T.x + 4, T.y + 7], [T.x + 9, FOOT_Y - 4], [T.x + 13, FOOT_Y - 5], [T.x + 15, FOOT_Y - 8]], ramp('#d99a9a'), 2, 1),
  'wings-fairy': (_c, p) => {
    p.ellipse(B.x + 11, B.y - 4, 5, 7, '#cfeeffb0');
    p.ellipse(B.x + 10, B.y + 7, 4, 4, '#e6d6ffb0');
    p.ellipse(B.x + 12, B.y - 6, 2.5, 4, '#f4fbffd0');
    p.ellipse(B.x - 16, B.y - 1, 3, 5, '#cfeeff90');
    for (let i = 0; i < 6; i++) p.set(B.x + 6 + i, B.y + 1 - i * 2, '#ffffffe0');
  },
  'wings-feather': (c, p) => {
    const col = c.v.head === 'beak' ? c.skin : ramp('#eeeae2');
    p.stamp(B.x + 5, B.y - 14, FEATHER_NEAR, keys(col));
    p.stamp(B.x - 17, B.y - 4, FEATHER_FAR, keys(ramp(col.shadow)));
  },
  'wings-bat': (c, p) => {
    const r = ramp(mix(c.skin.base, '#2a1a2a', 0.45));
    const map = { l: r.light, b: r.base, s: r.shadow, d: r.deep };
    p.stamp(B.x + 5, B.y - 12, BAT_NEAR, map);
    p.stamp(B.x - 16, B.y - 3, BAT_FAR, map);
  },
  shell: (c, p) => {
    const r = acc(c);
    const cx = B.x + 3;
    const cy = B.y + 6;
    p.ellipse(cx, cy, 10, 11, r.shadow);
    p.ellipse(cx - 1, cy - 1, 9, 10, r.base);
    p.ellipse(cx - 2, cy - 4, 6, 5, r.light);
    for (let y = cy - 7; y <= cy + 9; y += 5) p.hline(cx - 9, cx + 9, y, r.deep);
    for (let x = cx - 5; x <= cx + 7; x += 6) p.vline(x, cy - 10, cy + 9, r.deep);
    p.ellipse(cx - 4, cy - 8, 2, 1, r.hi);
  },
  shadow: (_c, p) => {
    const smoke = '#2b2140a0';
    // Wisps clinging to the arms and legs, rising from a pool at the feet.
    for (const [x, y] of [[-12, 4], [-13, 9], [-12, 15], [-7, 21], [14, 13], [9, 21], [14, 6]] as const) p.ellipse(MID + x, TOP + y, 1.5, 1.5, smoke);
    p.hline(MID - 9, MID + 11, FOOT_Y, smoke);
  },
};

/* ── Back: behind the hair and the head (absolute coordinates) ────────────────────────────────── */

/* Far horns, half hidden behind the hair and the skull (column 0 = hx). */
const FAR_HORN: Partial<Record<Part, { x: number; y: number; rows: readonly string[] }>> = {
  'horns-curved': { x: -1, y: -4, rows: ['..ll.', '.lbbs', 'lbs.b', 'lb...', 'bs...', 'bs...'] },
  'horns-straight': { x: 0, y: -3, rows: ['...l', '..lb', '.lbs', 'lbs.', 'bs..'] },
  'horns-back': { x: 2, y: -3, rows: ['........ll', '......llbs', '....llbbs.', '..llbbss..', 'llbbss....'] },
  'horns-nubs': { x: 1, y: -2, rows: ['.l', 'lb', 'bs'] },
  'horns-antlers': { x: -2, y: -4, rows: ['l.l..', 'lblb.', '.lbs.', '..lb.', '..bs.', '..bs.'] },
  'horns-bull': { x: -5, y: -4, rows: ['l.......', 'lb......', 'lb......', '.lb.....', '.lbbll..', '..sbbbbb', '....ssss'] },
};

function farHorn(c: DrawCtx, part: Part) {
  const h = FAR_HORN[part];
  if (!h) return;
  const r = part === 'horns-bull' ? BONE_R : part === 'horns-antlers' ? ANTLER_R : hornRamp(c);
  c.p.stamp(c.f.hx + h.x, c.f.hy + h.y, h.rows, keys(r));
}

/** Tiefling and satyr horns are dark keratin; dragon and bull horns bone. */
const hornRamp = (c: DrawCtx) => (c.v.head === 'reptile' || c.v.head === 'beast' ? BONE_R : HORN_R);

/** Builds a template once, at module load, from a tone per cell ('.' = empty). */
function bake(w: number, h: number, tone: (dx: number, dy: number) => string, cx: number, cy: number): string[] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => tone(x - cx, y - cy)).join(''));
}

/* Leonin mane (column 0 = hx − 3, row 0 = hy − 3): a ring of tufts around the head, 3 px past the
   skull, lit from the top left. */
const MANE = bake(22, 25, (dx, dy) => {
  const rad = 10.4 + (Math.round((Math.atan2(dy, dx) + Math.PI) * 3.2) % 2 ? 0.9 : -0.2);
  const d = Math.sqrt(dx * dx * 1.15 + dy * dy * 0.82);
  if (d > rad) return '.';
  const lit = -dx * 0.55 - dy * 0.75;
  if (d > rad - 1.3) return lit > 3 ? 'b' : 'd';
  return lit > 4 ? 'l' : lit > -3 ? 'b' : 's';
}, 10.5, 12);

/* Frill (column 0 = hx + 9, row 0 = hy + 3): a fan of rays behind the jaw, opening to the back. */
const FRILL = bake(11, 17, (dx, dy) => {
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 8.4) return '.';
  if (d > 7.2) return dy < 0 ? 'l' : 's';
  return Math.round(Math.atan2(dy, dx) * 2.6) % 2 === 0 ? 's' : dy < -2 ? 'l' : 'b';
}, 2, 8);

const BACK: Partial<Record<Part, Drawer>> = {
  // Short fluffy tail: drawn in absolute coordinates (not through the body seams, which drop its rows on
  // short bodies) at the back of the hips, so it peeks out right of the near thigh, under the hand.
  'tail-stub': (c, p) => {
    const r = ramp(mix(c.skin.base, '#ffffff', 0.4));
    const x = c.f.x(T.x + 3), y = c.f.y(CANON.hipY + 3);
    p.ellipse(x, y, 2, 1.5, r.shadow);
    p.ellipse(x - 0.5, y - 0.5, 1.5, 1, r.base);
    p.dots([[x - 1, y - 1], [x, y - 1]], r.light);
  },
  mane: (c) => c.p.stamp(c.f.hx - 3, c.f.hy - 3, MANE, keys(acc(c))),
  frill: (c) => c.p.stamp(c.f.hx + 9, c.f.hy + 3, FRILL, keys(acc(c))),
  'water-hair': (c) => {
    const r = acc(c);
    const { hx, hy } = c.f;
    c.p.tag = 'hair-back';
    c.p.stamp(hx + 9, hy + 6, WATER_BACK, { h: '#ffffff', l: r.light, b: r.base, s: r.shadow, d: r.deep });
  },
  'horns-curved': (c) => farHorn(c, 'horns-curved'),
  'horns-straight': (c) => farHorn(c, 'horns-straight'),
  'horns-back': (c) => farHorn(c, 'horns-back'),
  'horns-nubs': (c) => farHorn(c, 'horns-nubs'),
  'horns-antlers': (c) => farHorn(c, 'horns-antlers'),
  'horns-bull': (c) => farHorn(c, 'horns-bull'),
  halo: (c) => {
    const { hx, hy } = c.f;
    c.p.hline(hx + 3, hx + 10, hy - 4, GOLD_R.shadow);
  },
};

/* ── Skin: on the bare head, under the eyes and the hair (spots, stripes, the raccoon mask) ─────── */

type Dots = readonly (readonly [number, number])[];
/** Spot and stripe pixels per head type (column 0 = hx, row 0 = hy). */
const SPOTS: Record<string, Dots> = {
  human: [[0, 13], [1, 14], [8, 13], [7, 14], [3, 5], [5, 4], [11, 4], [12, 6], [10, 8]],
  beast: [[4, 3], [5, 2], [7, 4], [10, 2], [11, 5], [12, 7], [13, 9], [9, 7], [12, 12], [11, 13]],
  reptile: [[4, 3], [6, 2], [9, 3], [11, 5], [12, 8], [13, 10], [10, 6], [11, 12]],
  frog: [[3, 7], [4, 8], [8, 6], [10, 7], [11, 9], [12, 6], [6, 10]],
  other: [[4, 3], [6, 2], [9, 3], [11, 5], [12, 8], [13, 10], [10, 6]],
};
const STRIPES: Record<string, Dots> = {
  human: [[0, 13], [1, 13], [8, 13], [8, 14], [4, 4], [4, 5], [7, 3], [7, 4], [11, 4], [12, 5]],
  beast: [[5, 1], [5, 2], [7, 1], [7, 2], [7, 3], [9, 1], [9, 2], [11, 6], [12, 6], [12, 8], [13, 8], [11, 10], [12, 10]],
  reptile: [[5, 1], [6, 2], [8, 1], [9, 2], [11, 4], [12, 5], [12, 8], [13, 9], [12, 11]],
  frog: [[2, 7], [5, 6], [6, 6], [9, 5], [10, 5], [12, 7], [13, 8]],
  other: [[5, 1], [6, 2], [8, 1], [9, 2], [11, 4], [12, 5], [12, 8], [13, 9]],
};
const RACCOON_MASK: Dots = [
  [-1, 10], [0, 10], [3, 10], [4, 10], [5, 10], [8, 10], [9, 10],
  [0, 11], [3, 11], [5, 11], [8, 11], [9, 11], [0, 12], [3, 12], [8, 12],
];

const headKind = (c: DrawCtx) => (c.v.head === 'human' || c.v.head === 'beast' || c.v.head === 'reptile' || c.v.head === 'frog' ? c.v.head : 'other');

const SKIN: Partial<Record<Part, Drawer>> = {
  spots: (c) => {
    const { hx, hy } = c.f;
    const col = acc(c).shadow;
    for (const [x, y] of SPOTS[headKind(c)]) c.p.set(hx + x, hy + y, col);
  },
  stripes: (c) => {
    const { hx, hy } = c.f;
    const col = acc(c).deep;
    const raccoon = c.v.key === 'raccoon';
    for (const [x, y] of raccoon ? RACCOON_MASK : STRIPES[headKind(c)]) c.p.set(hx + x, hy + y, raccoon ? acc(c).base : col);
  },
};

/* ── Face: marks at the scale of the chibi face (1–2 px each), over the eyes, under the hair ───── */

/* Orc tusks rising from the lower lip (the near one bigger) and elephant tusks under the trunk. */
const TUSK = { near: ['l.', 'lb', 'bs'], far: ['l', 'b'] };
const TRUNK_TUSK = { near: ['lb', 'l.', 'b.'], far: ['.l', 'lb', 'b.'] };

const FACE: Partial<Record<Part, Drawer>> = {
  freckles: (c) => {
    const { hx, hy } = c.f;
    c.p.dots([[1, 13], [2, 14], [5, 14], [6, 13], [7, 14]].map(([x, y]) => [hx + x, hy + y] as const), mix(c.skin.shadow, '#7a3a1a', 0.35));
  },
  scar: (c) => {
    const { hx, hy } = c.f;
    const r = ramp(mix(c.skin.base, '#a04040', 0.45));
    // A cut across the near eye: brow above, cheek below.
    c.p.dots([[hx + 8, hy + 8], [hx + 7, hy + 9], [hx + 7, hy + 13]], r.shadow);
    c.p.dots([[hx + 8, hy + 7], [hx + 6, hy + 14]], r.light);
  },
  tattoo: (c) => {
    const { hx, hy } = c.f;
    const col = c.v.hair ? '#2e4a7a' : acc(c).deep;
    // Face paint: a bar on each cheek, a dot on the chin and a chevron on the brow.
    c.p.dots([[hx, hy + 13], [hx + 1, hy + 13], [hx + 7, hy + 13], [hx + 8, hy + 13], [hx + 4, hy + 16]], col);
    c.p.dots([[hx + 4, hy + 7], [hx + 3, hy + 8], [hx + 5, hy + 8]], col);
  },
  mark: (c) => {
    const { hx, hy } = c.f;
    c.p.dots([[hx + 7, hy + 13], [hx + 6, hy + 14], [hx + 8, hy + 14], [hx + 7, hy + 15]], '#8a3aa8');
    c.p.set(hx + 7, hy + 14, '#c07ad8');
  },
  plates: (c) => {
    const { hx, hy } = c.f;
    const line = c.skin.deep;
    c.p.hline(hx, hx + 13, hy + 5, line);
    c.p.vline(hx + 9, hy + 6, hy + 13, line);
    c.p.hline(hx, hx + 2, hy + 14, line);
    c.p.hline(hx + 2, hx + 6, hy + 15, INK);
    c.p.dots([[hx + 3, hy + 15], [hx + 5, hy + 15]], c.skin.shadow);
    c.p.dots([[hx + 3, hy + 3], [hx + 4, hy + 2], [hx + 11, hy + 7]], c.skin.hi);
  },
  visor: (c) => {
    const { hx, hy, eyeY } = c.f;
    const { p } = c;
    p.hline(hx, hx + 9, eyeY - 1, '#4a4a55');
    p.rect(hx, eyeY, 10, 3, '#2b2b33');
    p.hline(hx + 10, hx + 11, eyeY, '#4a4a55');
    p.tag = 'eye';
    p.hline(hx + 1, hx + 2, eyeY + 1, c.eyes.light);
    p.hline(hx + 6, hx + 7, eyeY + 1, c.eyes.light);
    p.set(hx + 1, eyeY + 1, '#ffffff');
    p.tag = 'part-face';
    p.set(hx, hy + 9, '#6a6a75');
  },
  stitches: (c) => {
    const { hx, hy } = c.f;
    const col = c.skin.deep;
    c.p.hline(hx, hx + 3, hy + 14, col);
    c.p.dots([[hx + 1, hy + 13], [hx + 3, hy + 13], [hx + 1, hy + 15], [hx + 3, hy + 15]], col);
    for (let y = hy + 3; y <= hy + 13; y++) c.p.set(hx + 9, y, col);
    for (let y = hy + 4; y <= hy + 12; y += 2) c.p.dots([[hx + 8, y], [hx + 10, y]], col);
  },
  tusks: (c) => {
    const { hx, mouthY } = c.f;
    c.p.hline(hx + 3, hx + 5, mouthY, c.skin.deep);
    c.p.stamp(hx + 6, mouthY - 2, TUSK.near, keys(BONE_R));
    c.p.stamp(hx + 2, mouthY - 1, TUSK.far, keys(BONE_R));
  },
  fangs: (c) => {
    const { hx, hy, mouthY } = c.f;
    if (c.v.head === 'beast') {
      c.p.dots([[hx - 2, hy + 16], [hx, hy + 16], [hx - 1, hy + 15]], BONE);
      c.p.set(hx + 1, hy + 15, c.skin.deep);
      return;
    }
    c.p.hline(hx + 3, hx + 5, mouthY, c.skin.deep);
    c.p.dots([[hx + 3, mouthY + 1], [hx + 5, mouthY + 1]], BONE);
  },
  whiskers: (c) => {
    const { hx, hy } = c.f;
    const col = '#ece6d4';
    // Two parallel near-side whiskers drooping back from the muzzle, both tips below row 13 so they never touch the near eye
    // (rows 10–12, columns 6–7).
    c.p.dots([[hx + 4, hy + 13], [hx + 5, hy + 13], [hx + 6, hy + 14], [hx + 4, hy + 15], [hx + 5, hy + 15], [hx + 6, hy + 16]], col);
    c.p.dots([[hx - 1, hy + 14], [hx + 1, hy + 14]], c.skin.deep);
  },
  gills: (c) => {
    const { hx, hy } = c.f;
    const col = c.skin.deep;
    if (c.v.head === 'fish') c.p.dots([[hx + 7, hy + 12], [hx + 7, hy + 13], [hx + 8, hy + 13], [hx + 8, hy + 14], [hx + 3, hy + 13], [hx + 3, hy + 14]], col);
    else c.p.dots([[hx + 7, hy + 13], [hx + 8, hy + 14], [hx + 6, hy + 14], [hx + 7, hy + 15], [hx + 9, hy + 15], [hx + 10, hy + 16]], col);
  },
  'trunk-tusks': (c) => {
    const { hx, hy } = c.f;
    c.p.stamp(hx + 4, hy + 15, TRUNK_TUSK.near, keys(BONE_R));
    c.p.stamp(hx - 1, hy + 15, TRUNK_TUSK.far, keys(ramp(BONE_R.shadow)));
  },
};

/* ── Head: over the hair ──────────────────────────────────────────────────────────────────────── */

/*
 * Ears on the HD-2D head. Side ears sit on the near side, where the face plane meets the side hair
 * (skull column 10), centred on the eye rows; the pointed ones rise up and back and show 2–3 px past
 * the hair. The far ear is hidden. Animal ears stand on the crown: the near one (viewer's right)
 * bigger, the far one smaller. Keys: l light, b base, s shadow, d deep, p inner (pink or pale), k dark
 * tip.
 */
const EAR_ELF = ['.......l', '......lb', '....llbs', '..llbbs.', 'lbbbbs..', 'lsbbs...', 'lsbs....', '.bs.....'];
const EAR_ELF_SHORT = ['......l', '....llb', 'lbbbbs.', 'lsbbs..', 'lsbs...', '.bs....'];
const EAR_SWEPT = ['lbb.....', 'lsbbbbbl', 'lsbbbs..', '.bs.....'];
const EAR_GNOME = ['.....ll', '...llbb', '.llbbbs', 'lbbbbs.', 'lsbbs..', 'lsbs...', '.bs....'];
const EAR_FLOPPY = ['.lbb', 'lbbs', 'lbbs', 'lbbs', 'lbbs', 'lbs.', '.s..'];
const EAR_CAT_NEAR = ['....lb', '...lps', '..lpps', '.lppbs', 'lbbbbs'];
const EAR_CAT_FAR = ['l...', 'lb..', 'lpb.', 'lbbs'];
const EAR_DOG_NEAR = ['...lb.', '..lpbs', '.lppbs', 'lbbbbs'];
const EAR_DOG_FAR = ['lb..', 'lpb.', 'lbbs'];
const EAR_FOX_NEAR = ['....kk', '...lbk', '..lpbs', '.lppbs', 'lpppbs', 'lbbbbs'];
const EAR_FOX_FAR = ['k...', 'kb..', 'lpb.', 'lppb', 'lbbs'];
const EAR_RABBIT_NEAR = ['...lbs', '..lpbs', '..lpbs', '.lpbs.', '.lpbs.', 'lpbs..', 'lbbs..'];
const EAR_RABBIT_FAR = ['..lb', '.lpb', '.lpb', 'lpb.', 'lbs.', 'bs..'];
/* Beast side ears (cow, deer, lop rabbit) leave the side of the crown towards the back. */
const EAR_SIDEWAYS = ['..lbb.', 'lbppbs', 'lppbs.', '.sss..'];
const EAR_LOP = [
  '..lbb....', '.lbbbbs..', '....lbbs.', '.....lbbs', '.....lpbs', '.....lpbs',
  '.....lpbs', '.....lpbs', '.....lpbs', '.....lbbs', '......bs.',
];

function earKeys(c: DrawCtx): Record<string, string> {
  return keys(c.skin, { p: c.parts.has('ears-fox') ? '#f4efe4' : mix(c.skin.base, '#f0a0a0', 0.5), k: INK });
}

/** Near-side ear at the edge of the face plane; `dy` is the template's first row from the eye row. */
function sideEar(c: DrawCtx, rows: readonly string[], dy: number) {
  c.p.stamp(c.f.hx + FACE_COLS, c.f.eyeY + dy, rows, earKeys(c));
}

/** Animal ears on the crown: the bottom row of each ear overlaps the top of the skull. */
function crownEars(c: DrawCtx, near: readonly string[], far: readonly string[]) {
  const { hx, hy } = c.f;
  const k = earKeys(c);
  c.p.stamp(hx + 2, hy + 2 - far.length, far, k);
  c.p.stamp(hx + 8, hy + 2 - near.length, near, k);
}

/* Near horns at the temple, over the hair (column 0 = hx, row 0 = hy). Root 2–3 px thick, tapering
   to the tip; lit side up and left. */
const NEAR_HORN: Partial<Record<Part, { x: number; y: number; rows: readonly string[] }>> = {
  // Rises from the temple and curls back over the head, the tip turning down.
  'horns-curved': { x: 10, y: -4, rows: [
    '...ll...',
    '..lbbb..',
    '.lbssbd.',
    '.lbd.sbd',
    'lbsd..sd',
    'lbd.....',
    'lbd.....',
    'bsd.....',
    'sd......',
  ] },
  // Thick spiral round the near temple and ear.
  'horns-ram': { x: 9, y: 1, rows: [
    '.llbbb...',
    'lbbbbbs..',
    'lbsddbbs.',
    '.d...dbbs',
    '...lb.sbs',
    '..lbsd.bs',
    '..lbdlbbs',
    '...sbbbsd',
    '....dssd.',
  ] },
  // Short and thick, slanting back.
  'horns-straight': { x: 11, y: -3, rows: [
    '....l',
    '...lb',
    '..lbd',
    '.lbsd',
    'lbbsd',
    'lbsd.',
    'bsd..',
  ] },
  // From the temple, swept back along the skull.
  'horns-back': { x: 8, y: 0, rows: [
    '........lld',
    '......llbsd',
    '....llbbsd.',
    '..llbbbsd..',
    'llbbbssd...',
    'lbbssdd....',
    'bssdd......',
  ] },
  'horns-nubs': { x: 8, y: -2, rows: ['.l.', 'lbd', 'bsd'] },
  'horns-antlers': { x: 7, y: -4, rows: [
    'l...l.l..',
    'lbd.lblbd',
    '.lbdlbbsd',
    '..lbbbsd.',
    '..lbsd...',
    '..bsd....',
  ] },
  'horns-bull': { x: 9, y: -3, rows: [
    '......l..',
    '......lb.',
    '......lbd',
    '....llbsd',
    '.llbbbsd.',
    'lbbsssd..',
    'bsdd.....',
  ] },
};

/** Far ram horn: a small curl beside the forehead, outside the hair on the left. */
const RAM_FAR = ['..lb', '.lbs', 'lbs.', 'lb..', 'lbsd', '.dd.'];

function nearHorn(c: DrawCtx, part: Part) {
  const h = NEAR_HORN[part];
  if (!h) return;
  const r = part === 'horns-bull' ? BONE_R : part === 'horns-antlers' ? ANTLER_R : hornRamp(c);
  // Without hair the horns sit one row lower, on the skull.
  const dy = c.v.hair && c.a.hair > 0 ? 0 : 1;
  c.p.stamp(c.f.hx + h.x, c.f.hy + h.y + dy, h.rows, { l: r.hi, b: r.light, s: r.base, d: r.deep });
  if (part === 'horns-ram') c.p.stamp(c.f.hx - 4, c.f.hy + 2 + dy, RAM_FAR, keys(r));
}

/* Beards under the mouth over the chest, locks lit from the top left (column 0 = hx − 1, row 0 = hy
   + 11); sideburns frame the eyes without covering them. */
const BEARD_FULL = [
  '.l........b.',
  '.l.......lb.',
  'lbb.....lbbs',
  'lbhhllllbbss',
  'lbbbbobbbbs.',
  'lbhbbsbbbss.',
  'lbbsbbsbbss.',
  '.lbbsbbsbs..',
  '.lbsbbsbs...',
  '..lbsbbs....',
  '..lbsbs.....',
  '...lbs......',
  '...bs.......',
];
const BEARD_SHORT = [
  '.l........b.',
  '.l.......lb.',
  'lb.......bs.',
  'lbb.hll.bbs.',
  'lbbbbobbbs..',
  '.lbbbbbbs...',
  '..lbbbbs....',
  '...bsss.....',
];
const BEARD_BRAIDED = [
  '.l........b.',
  '.l.......lb.',
  'lbb.....lbbs',
  'lbhhllllbbss',
  'lbbbbobbbbs.',
  '.lbbsbbsbs..',
  '..lbbsbbs...',
  '...lbbss....',
  '....lb......',
  '....bs......',
  '....lb......',
  '....bs......',
  '....gg......',
];

function beard(c: DrawCtx, rows: readonly string[]) {
  c.p.stamp(c.f.hx - 1, c.f.hy + 11, rows, keys(acc(c), { o: mix(c.skin.deep, '#5a1a2a', 0.4), g: GOLD_R.base }));
}

/* Fin ear (no other ear) or cheek fin under the ear, with spines sweeping back. */
const FIN_EAR = ['....l..', '..l.lb.', '.lblbbs', 'lbbbbbs', 'lbbbbs.', 'lbbbs..', '.bbs...', '..s....'];
const FIN_CHEEK = ['l.l...', 'lblbl.', 'lbbbbs', '.bbss.'];
const FIN_DORSAL = ['.......lb..', '.....llbbs.', '...llbsbsbs', '.llbsbsbsbs', 'lbsbsbsbsss'];

/* Elemental hair: a short chibi crown and bangs (column 0 = hx − 2, row 0 = hy − 1) recoloured per
   element, with element accents (flame tips, sparkles, crystals, wisps) as race parts. */
const ELEMENT_HAIR = [
  '.....sbbbbbbs.....',
  '...sbllllbbbbbs...',
  '..slhhhllbbbbbbs..',
  '.sllbbhhhlbbbbbbs.',
  'slhhlbbbbbllbbsbbs',
  'sllblbbslbbslbbbbs',
  'slblbbslbbslbbbbss',
  'lblbbslbbslbbsbbss',
  'lbbbslbbs.lbsbsssd',
  'lbbslbs....bsbsssd',
  'lbsbs......sbbsssd',
  'bs............bssd',
  'bs............bssd',
  'd.............dssd',
  '..............dsd.',
  '...............d..',
];
/* Flame tongues over the crown (rows hy − 4 … hy − 1, column 0 = hx − 2). */
const FLAMES = ['.......y......y...', '......yh..y..yh...', '....yyhl.yh.yhl...', '...yhhll.yhlhll...'];
const FIRE_WHITE = '#fff2b0';
/* Back of the water hair: a wave falling behind the neck to the shoulders (column 0 = hx + 9). */
const WATER_BACK = [
  '...lbbs.',
  '..lbbbsd',
  '..lbhbsd',
  '.lbbbsd.',
  '.lbhbsd.',
  'lbbbsd..',
  'lbhbbsd.',
  'lbbbbbsd',
  '.lbbbbsd',
  '..sssdd.',
];
/* Crystals on the stone hair. */
const CRYSTALS = ['..l....', '.lhb...', '.lbs.l.', '..s.lhb', '....bs.'];
/* Mushroom cap sized to the head (column 0 = hx − 3, row 0 = hy − 4), gills underneath. */
const MUSHROOM_CAP = [
  '.......llllbbbb.......',
  '.....lllllbbbbbbs.....',
  '...hhllllbbbbbbbbss...',
  '..hhlllllbbbbbbbbsss..',
  '.hhllllllbbbbbbbbssss.',
  '.hlllllllbbbbbbbbbsss.',
  'hlllllllbbbbbbbbbbsssd',
  'llllllllbbbbbbbbbssssd',
  'sbbbbbbbbbbbbbbbsssddd',
  '.ggggggggggggggggggg..',
  '..nnnnnnnnnnnnnnnnn...',
];
const MUSHROOM_SPOTS: Dots = [[4, 2], [5, 2], [4, 3], [10, 1], [11, 1], [15, 3], [16, 4], [7, 5], [8, 5], [13, 6], [2, 6]];

/** Draws an elemental hair: the mass is hair, `tone` gives each template cell its colour. */
function elementHair(c: DrawCtx, tone: (k: string, x: number, y: number) => string | null) {
  const { p, f } = c;
  p.tag = 'hair';
  ELEMENT_HAIR.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const k = row[i];
      if (k === '.') continue;
      const col = tone(k, i, j);
      if (col) p.set(f.hx - 2 + i, f.hy - 1 + j, col);
    }
  });
  castHairShadow(c);
  p.tag = 'part-head';
}

/* Halo over the crown; crests (a reptile fin, a swept-back plume); dorsal spines along the crown and the
   nape; antenna tips (the near one bigger); forehead gem; third eye; one leaf of a crown. */
const HALO = ['..hhhhhhhh..', 'hl........lb', '..ssssssss..'];
const CREST = {
  reptile: ['..l...l....', '.lb..lb..l.', 'lbb.lbb.lb.', 'lbbslbbslbs', '.bbbbbbbbbs', '..ssssssss.'],
  bird: ['......lbb.', '....llbbs.', '..llbbs.l.', '.lbbs.lbs.', 'lbs..lbs..', 'bs..bs....'],
};
const SPINES = [
  '..l........',
  '.lb..l.....',
  'lbs.lb..l..',
  'bs.lbs.lb..',
  '...bs.lbs.l',
  '......bs.lb',
  '........lbs',
  '........bs.',
];
const ANTENNA_TIP = { far: ['lb', 'bs'], near: ['.l', 'lbs', '.s'] };
const GEM = ['.lb.', 'lhbs', '.bs.'];
const THIRD_EYE = ['.kk.', 'whdw', '.ii.'];
const LEAF = ['..lb', '.lbs', 'lbs.', 's...'];

const HEAD: Partial<Record<Part, Drawer>> = {
  'ears-elf': (c) => sideEar(c, EAR_ELF, -4),
  'ears-elf-short': (c) => sideEar(c, EAR_ELF_SHORT, -2),
  'ears-swept': (c) => sideEar(c, EAR_SWEPT, 0),
  'ears-gnome': (c) => sideEar(c, EAR_GNOME, -3),
  'ears-floppy': (c) => {
    const { hx, hy } = c.f;
    if (c.v.head !== 'beast') sideEar(c, EAR_FLOPPY, -4);
    else if (c.v.key === 'harengon') c.p.stamp(hx + 9, hy - 1, EAR_LOP, earKeys(c));
    else c.p.stamp(hx + 12, hy + 3, EAR_SIDEWAYS, earKeys(c));
  },
  'ears-cat': (c) => crownEars(c, EAR_CAT_NEAR, EAR_CAT_FAR),
  'ears-dog': (c) => crownEars(c, EAR_DOG_NEAR, EAR_DOG_FAR),
  'ears-fox': (c) => crownEars(c, EAR_FOX_NEAR, EAR_FOX_FAR),
  'ears-rabbit': (c) => {
    const { hx, hy } = c.f;
    const k = earKeys(c);
    c.p.stamp(hx + 3, hy - 3, EAR_RABBIT_FAR, k);
    c.p.stamp(hx + 7, hy - 4, EAR_RABBIT_NEAR, k);
  },
  'ears-mouse': (c) => {
    const pink = mix(c.skin.base, '#f0a0a0', 0.5);
    const { hx, hy } = c.f;
    c.p.ellipse(hx + 3, hy + 1, 2, 2, c.skin.shadow);
    c.p.ellipse(hx + 11, hy, 3, 3, c.skin.base);
    c.p.ellipse(hx + 11, hy, 1.5, 1.5, pink);
  },
  'ears-bear': (c) => {
    const { hx, hy } = c.f;
    c.p.ellipse(hx + 4, hy + 1, 1.8, 1.8, c.skin.shadow);
    c.p.ellipse(hx + 11, hy + 1, 2.2, 2.2, c.skin.base);
    c.p.ellipse(hx + 11, hy + 1.5, 1, 1, c.skin.deep);
  },
  'horns-curved': (c) => nearHorn(c, 'horns-curved'),
  'horns-ram': (c) => nearHorn(c, 'horns-ram'),
  'horns-straight': (c) => nearHorn(c, 'horns-straight'),
  'horns-back': (c) => nearHorn(c, 'horns-back'),
  'horns-nubs': (c) => nearHorn(c, 'horns-nubs'),
  'horns-antlers': (c) => nearHorn(c, 'horns-antlers'),
  'horns-bull': (c) => nearHorn(c, 'horns-bull'),
  halo: (c) => {
    const { hx, hy } = c.f;
    c.p.stamp(hx + 1, hy - 4, HALO, keys(GOLD_R));
  },
  'beard-full': (c) => beard(c, BEARD_FULL),
  'beard-braided': (c) => beard(c, BEARD_BRAIDED),
  'beard-short': (c) => beard(c, BEARD_SHORT),
  sideburns: (c) => {
    const { hx, hy } = c.f;
    const r = acc(c);
    for (let y = hy + 10; y <= hy + 14; y++) c.p.set(hx + 9, y, y > hy + 12 ? r.shadow : r.base);
    c.p.dots([[hx + 8, hy + 13], [hx + 8, hy + 14]], r.base);
    for (let y = hy + 10; y <= hy + 13; y++) c.p.set(hx, y, y > hy + 12 ? r.shadow : r.light);
  },
  crest: (c) => {
    const r = acc(c);
    const { hx, hy } = c.f;
    if (c.v.head === 'reptile') {
      c.p.stamp(hx + 4, hy - 3, CREST.reptile, keys(r));
      return;
    }
    c.p.stamp(hx + 5, hy - 4, CREST.bird, keys(r));
  },
  spines: (c) => {
    const r = acc(c);
    c.p.stamp(c.f.hx + 5, c.f.hy - 3, SPINES, keys(r));
  },
  antennae: (c) => {
    const { hx, hy } = c.f;
    const col = c.skin.deep;
    const top = c.v.hair && c.a.hair > 0 ? hy - 1 : hy + 1;
    c.p.dots([[hx + 3, top], [hx + 2, top - 1], [hx + 2, top - 2]], col);
    c.p.dots([[hx + 8, top], [hx + 9, top - 1], [hx + 10, top - 2]], col);
    c.p.stamp(hx + 1, top - 4, ANTENNA_TIP.far, keys(acc(c)));
    c.p.stamp(hx + 10, top - 5, ANTENNA_TIP.near, keys(acc(c)));
  },
  fins: (c) => {
    const r = acc(c);
    const { hx, hy, eyeY } = c.f;
    if (c.v.head === 'fish') {
      c.p.stamp(hx + 3, hy - 4, FIN_DORSAL, keys(r));
      c.p.stamp(hx + 9, eyeY - 4, FIN_EAR, keys(r));
      return;
    }
    let eared = false;
    for (const part of c.parts) if (part.startsWith('ears-')) eared = true;
    if (eared) c.p.stamp(hx + 9, eyeY + 2, FIN_CHEEK, keys(r));
    else c.p.stamp(hx + 9, eyeY - 4, FIN_EAR, keys(r));
  },
  gem: (c) => c.p.stamp(c.f.hx + 3, c.f.hy + 5, GEM, { l: '#7ae0f0', h: '#e6fcff', b: '#3ab0d0', s: '#1a7090' }),
  'third-eye': (c) => c.p.stamp(c.f.hx + 3, c.f.hy + 7, THIRD_EYE, { k: INK, w: '#f4f1ea', h: '#ffffff', d: c.eyes.deep, i: c.eyes.base }),
  'flame-hair': (c) => {
    const r = acc(c);
    // The crown burns white-hot; the locks keep their shape and cool towards the nape.
    elementHair(c, (k, _x, y) => {
      const top = y < 4;
      if (k === 'h') return FIRE_WHITE;
      if (k === 'l') return top ? FIRE_WHITE : r.hi;
      if (k === 'b') return top ? r.hi : r.light;
      if (k === 's') return top ? r.light : r.base;
      return r.shadow;
    });
    c.p.stamp(c.f.hx - 2, c.f.hy - 4, FLAMES, { y: FIRE_WHITE, h: r.hi, l: r.light });
  },
  'water-hair': (c) => {
    const r = acc(c);
    elementHair(c, (k) => (k === 'h' ? r.hi : k === 'l' ? r.light : k === 'b' ? r.base : k === 's' ? r.shadow : r.deep));
    const { hx, hy } = c.f;
    c.p.dots([[hx + 1, hy + 1], [hx + 2, hy + 1], [hx + 8, hy], [hx + 12, hy + 3]], '#ffffff');
  },
  'stone-hair': (c) => {
    const r = acc(c);
    elementHair(c, (k) => (k === 'h' || k === 'l' ? r.light : k === 'b' ? r.base : k === 's' ? r.shadow : r.deep));
    const { hx, hy } = c.f;
    // Cracks between the rock chunks, then the crystals.
    c.p.dots([[hx + 3, hy + 1], [hx + 4, hy + 2], [hx + 9, hy + 2], [hx + 9, hy + 3], [hx + 6, hy + 5], [hx + 12, hy + 6]], r.deep);
    c.p.stamp(hx + 7, hy - 4, CRYSTALS, { l: '#bfe8e0', h: '#ffffff', b: '#6ab0a8', s: '#3a7a74' });
  },
  'air-hair': (c) => {
    const r = acc(c);
    elementHair(c, (k) => (k === 'h' || k === 'l' ? r.hi : k === 'b' ? r.light : k === 's' ? r.base : r.shadow));
    const { hx, hy } = c.f;
    // Translucent wisps blowing off the crown and the nape, attached to the hair.
    c.p.dots([[hx - 3, hy + 3], [hx - 3, hy + 4], [hx + 15, hy + 1], [hx + 16, hy + 2], [hx + 5, hy - 2], [hx + 6, hy - 2]], '#ffffffd0');
  },
  'mushroom-cap': (c) => {
    const { p, f } = c;
    const r = acc(c);
    const gill = ramp(mix(c.skin.base, '#f4efe0', 0.5));
    p.tag = 'hair';
    p.stamp(f.hx - 3, f.hy - 4, MUSHROOM_CAP, keys(r, { g: gill.light, n: gill.shadow }));
    castHairShadow(c);
    p.tag = 'part-head';
    for (const [x, y] of MUSHROOM_SPOTS) p.set(f.hx - 3 + x, f.hy - 4 + y, '#f6f2ea');
  },
  leaves: (c) => {
    const y = c.parts.has('mushroom-cap') ? c.f.hy - 4 : c.v.hair && c.a.hair > 0 ? c.f.hy - 3 : c.f.hy - 1;
    for (const [x, dy, flip] of [[1, 1, false], [5, 0, false], [9, 0, true], [13, 1, true]] as const) {
      c.p.stamp(c.f.hx + x, y + dy, LEAF, keys(LEAF_R), flip);
    }
  },
};

const LAYERS: Record<Layer, Partial<Record<Part, Drawer>>> = { 'body-back': BODY_BACK, back: BACK, skin: SKIN, face: FACE, head: HEAD };

/** Draws the parts of one layer; body-back parts go to the canonical body painter `bodyP`. */
export function drawFeatures(c: DrawCtx, layer: Layer, bodyP?: Painter) {
  const table = LAYERS[layer];
  const p = bodyP ?? c.p;
  const tag = `part-${layer}`;
  for (const part of c.parts) {
    const draw = table[part];
    if (!draw) continue;
    p.tag = tag;
    draw(c, p);
  }
  p.tag = null;
}

