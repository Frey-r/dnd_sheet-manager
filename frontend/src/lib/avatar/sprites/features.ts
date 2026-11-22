/* Race parts for the three-quarter avatar (character-appearance.md, "Race families"): ears, horns,
   tails, wings, beards, elemental hair, marks… The face is turned to the viewer's right, so the
   near-side ear sits at the left edge of the face and far-side parts are smaller or hidden.
   Layers:
   body-back – canonical body coordinates, behind the body (tails, wings, shell, shadow)
   back      – behind the body, attached to the head (mane, frill, water hair)
   skin      – on the bare head before the face and hair (spots, stripes)
   face      – after the eyes, under the hair (marks, tusks, whiskers, visor)
   head      – over the hair (ears, horns, beards, crests, elemental hair, halo) */
import { mix, ramp, type Ramp } from '../color';
import type { Painter } from '../painter';
import { BONE, HORN } from '../palettes';
import type { Part } from '../types';
import { HEAD_HUMAN } from './body';
import { INK, keys, type DrawCtx } from './context';
import { hairTemplate } from './hair';

export type Layer = 'body-back' | 'back' | 'skin' | 'face' | 'head';

type Drawer = (c: DrawCtx, p: Painter) => void;

const HORN_R = ramp(HORN);
const BONE_R = ramp(BONE);
const GOLD_R = ramp('#f7b61f');
const ANTLER_R = ramp('#c9b48a');

/** Accent ramp: hair colour, used for crests, fins, plumage, shells, elemental hair. */
const acc = (c: DrawCtx) => c.hair;

/** Thick polyline (tails), width shrinking from w0 to w1; lit top pixel, shaded bottom one. */
function path(p: Painter, pts: [number, number][], r: Ramp, w0 = 2, w1 = 1) {
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

/** Row where parts sitting on top of the head start: above the hair mass, or on the bare skull. */
const crownY = (c: DrawCtx) => (c.v.hair && c.a.hair > 0 ? c.f.hy - 3 : c.f.hy + 1);

/** Recolours a hair silhouette (elemental hair). `tone` gets the template letter, column and row. */
function hairShape(c: DrawCtx, id: number, tone: (k: string, x: number, y: number) => string | null, back = false) {
  const t = hairTemplate(id);
  const rows = back ? t.back : t.front;
  if (!rows) return;
  const x0 = c.f.hx + t.x;
  const y0 = c.f.hy + t.y;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const k = row[i];
      if (k === '.' || k === 'q' || k === 'Q') continue;
      const col = tone(k, i, j);
      if (col) c.p.set(x0 + i, y0 + j, col);
    }
  });
}

function featherWing(p: Painter, r: Ramp, x: number, y: number, flip = false) {
  p.stamp(x, y, [
    '.....hlllll',
    '...hllbbbbbl',
    '..hlbbbbbbbb',
    '.hlbbbbbbbbs',
    '.lbsssbbbsss',
    'lbbbbbsbbbs.',
    'lbsbbbsbbs..',
    'lbsbbsbbs...',
    'lbsbsbbs....',
    'lbsbsbs.....',
    'lbsbsbs.....',
    '.bsbsb......',
    '.bs.sb......',
    '..s..s......',
  ], keys(r), flip);
}

const BODY_BACK: Partial<Record<Part, Drawer>> = {
  'tail-devil': (c, p) => {
    const r = ramp(c.skin.shadow);
    path(p, [[18, 42], [13, 45], [8, 45], [5, 42], [5, 38]], r, 2, 1);
    p.stamp(3, 34, ['..l..', '.lbs.', 'lbbbs', '..s..'], keys(r));
  },
  'tail-reptile': (c, p) => path(p, [[19, 40], [14, 44], [10, 48], [6, 51], [2, 52]], c.skin, 4, 1),
  'tail-cat': (c, p) => {
    path(p, [[18, 42], [12, 44], [8, 42], [6, 37], [7, 32]], c.skin, 2, 2);
    p.dots([[7, 31], [8, 31]], acc(c).base);
  },
  'tail-fox': (c, p) => {
    p.ellipse(10, 42, 7, 4, c.skin.base);
    p.ellipse(9, 41, 5, 2.5, c.skin.light);
    p.ellipse(4, 42, 2.5, 2.5, '#f4efe4');
    p.hline(6, 15, 46, c.skin.shadow);
  },
  'tail-horse': (c, p) => {
    const r = acc(c);
    for (let t = 0; t < 12; t++) {
      const x = 17 - Math.round(t * 0.6);
      p.hline(x - 2, x, 41 + t, t % 3 === 0 ? r.light : r.base);
      p.set(x - 2, 41 + t, r.shadow);
    }
  },
  'tail-rat': (_c, p) => path(p, [[18, 43], [12, 47], [7, 49], [3, 48], [1, 45]], ramp('#d99a9a'), 2, 1),
  'tail-stub': (c, p) => {
    p.ellipse(16, 41, 2, 2, mix(c.skin.base, '#ffffff', 0.4));
    p.set(15, 40, '#ffffff');
  },
  'wings-fairy': (_c, p) => {
    p.ellipse(10, 27, 6, 8, '#cfeeffb0');
    p.ellipse(11, 38, 4, 4, '#e6d6ffb0');
    p.ellipse(9, 25, 3, 4.5, '#f4fbffd0');
    p.ellipse(34, 26, 3.5, 6, '#cfeeff90');
    for (let i = 0; i < 6; i++) p.set(15 - i, 32 - i * 2, '#ffffffe0');
  },
  'wings-feather': (c, p) => {
    const col = c.v.head === 'beak' ? c.skin : ramp('#eeeae2');
    featherWing(p, col, 3, 17);
    featherWing(p, ramp(col.shadow), 29, 19, true);
  },
  'wings-bat': (c, p) => {
    const r = ramp(mix(c.skin.base, '#2a1a2a', 0.45));
    const map = { b: r.base, s: r.shadow, d: r.deep, l: r.light };
    p.stamp(2, 18, [
      'l...........',
      'bb.........d',
      'bsb.......db',
      'bssb.....dbb',
      'bsssbb..dbbb',
      'bssssbbdbbbb',
      'bsss.sbbbbb.',
      'bss...sbbb..',
      'bs.....sb...',
      'b...........',
    ], map);
    p.stamp(30, 20, ['....d', '...db', '..dbb', '.dbbs', 'dbbs.', 'bs...'], map);
  },
  shell: (c, p) => {
    const r = acc(c);
    p.ellipse(18, 38, 8, 10, r.shadow);
    p.ellipse(17, 37, 7, 9, r.base);
    for (let y = 30; y <= 46; y += 4) p.hline(10, 25, y, r.deep);
    p.ellipse(14, 31, 2.5, 1.5, r.light);
  },
  shadow: (_c, p) => {
    const smoke = '#2b2140a0';
    for (const [x, y] of [[8, 30], [5, 35], [7, 40], [4, 45], [36, 40], [39, 45], [38, 34]] as [number, number][]) p.ellipse(x, y, 1.5, 1.5, smoke);
    p.hline(12, 34, 54, smoke);
  },
};

const BACK: Partial<Record<Part, Drawer>> = {
  mane: (c) => {
    const { f, p } = c;
    const r = acc(c);
    p.ellipse(f.hx + 9, f.hy + 10, 14, 13, r.shadow);
    p.ellipse(f.hx + 8, f.hy + 9, 13, 12, r.base);
    for (let a = 0; a < 18; a++) {
      const ang = (a / 18) * Math.PI * 2;
      p.set(Math.round(f.hx + 9 + Math.cos(ang) * 15), Math.round(f.hy + 10 + Math.sin(ang) * 14), Math.cos(ang) < 0 ? r.light : r.deep);
    }
    p.ellipse(f.hx + 3, f.hy + 1, 4, 2, r.light);
  },
  frill: (c) => {
    const { f, p } = c;
    const r = acc(c);
    const cx = f.hx + 5;
    const cy = f.hy + 11;
    p.ellipse(cx, cy, 12, 12, r.base);
    for (let a = 0; a < 12; a++) {
      const ang = Math.PI * 0.5 + (a / 11) * Math.PI;
      for (let d = 5; d < 12; d++) p.set(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), r.shadow);
    }
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      p.set(Math.round(cx + Math.cos(ang) * 12), Math.round(cy + Math.sin(ang) * 12), a % 2 ? r.light : r.deep);
    }
  },
  'water-hair': (c) => {
    const r = acc(c);
    hairShape(c, 5, (k, x, y) => (k === 'h' || (x + y) % 6 === 0 ? r.hi : k === 'd' || k === 'x' || k === 'X' ? r.shadow : r.base), true);
  },
};

const SKIN: Partial<Record<Part, Drawer>> = {
  spots: (c) => {
    const { hx, hy, eyeY } = c.f;
    c.p.dots([[hx + 6, hy + 3], [hx + 8, hy + 2], [hx + 7, hy + 4], [hx + 17, hy + 4], [hx + 18, hy + 6],
      [hx + 9, eyeY + 5], [hx + 17, eyeY + 4], [hx + 18, eyeY + 5]], acc(c).shadow);
  },
  stripes: (c) => {
    const { hx, hy, eyeY } = c.f;
    const col = acc(c).deep;
    c.p.dots([[hx + 9, hy + 1], [hx + 9, hy + 2], [hx + 9, hy + 3], [hx + 12, hy + 1], [hx + 12, hy + 2], [hx + 15, hy + 2],
      [hx + 7, eyeY + 4], [hx + 8, eyeY + 5], [hx + 7, eyeY + 6], [hx + 18, eyeY + 3], [hx + 19, eyeY + 4]], col);
  },
};

const FACE: Partial<Record<Part, Drawer>> = {
  freckles: (c) => {
    const { hx, eyeY } = c.f;
    c.p.dots([[hx + 8, eyeY + 5], [hx + 10, eyeY + 5], [hx + 9, eyeY + 6], [hx + 17, eyeY + 4], [hx + 18, eyeY + 5]], mix(c.skin.shadow, '#7a3a1a', 0.35));
  },
  scar: (c) => {
    const { hx, eyeY } = c.f;
    const col = mix(c.skin.base, '#a04040', 0.5);
    c.p.dots([[hx + 9, eyeY - 4], [hx + 10, eyeY - 3], [hx + 10, eyeY - 2], [hx + 11, eyeY + 4], [hx + 11, eyeY + 5], [hx + 12, eyeY + 6]], col);
  },
  tattoo: (c) => {
    const { hx, eyeY, hy } = c.f;
    const col = c.v.hair ? '#2e4a7a' : acc(c).deep;
    c.p.dots([[hx + 8, eyeY + 4], [hx + 8, eyeY + 5], [hx + 9, eyeY + 6], [hx + 10, eyeY + 6], [hx + 18, eyeY + 4], [hx + 18, eyeY + 5]], col);
    c.p.dots([[hx + 13, hy + 5], [hx + 14, hy + 5], [hx + 13, hy + 6], [hx + 14, hy + 6]], col);
  },
  mark: (c) => {
    const { hx, eyeY } = c.f;
    c.p.dots([[hx + 9, eyeY + 4], [hx + 8, eyeY + 5], [hx + 10, eyeY + 5], [hx + 9, eyeY + 6]], '#8a3aa8');
    c.p.set(hx + 9, eyeY + 5, '#c07ad8');
  },
  plates: (c) => {
    const { hx, hy, eyeY, mouthY, chinY } = c.f;
    const line = c.skin.deep;
    c.p.hline(hx + 1, hx + 19, hy + 5, line);
    c.p.dots([[hx + 7, hy + 6], [hx + 7, hy + 7], [hx + 7, hy + 8], [hx + 7, eyeY + 4], [hx + 8, eyeY + 5], [hx + 9, eyeY + 6], [hx + 11, chinY - 1]], line);
    c.p.hline(hx + 11, hx + 16, mouthY, INK);
    c.p.dots([[hx + 12, mouthY], [hx + 14, mouthY]], c.skin.shadow);
    c.p.dots([[hx + 5, hy + 3], [hx + 6, hy + 2]], c.skin.hi);
  },
  visor: (c) => {
    const { hx, eyeY } = c.f;
    c.p.hline(hx + 6, hx + 20, eyeY - 1, '#4a4a55');
    c.p.rect(hx + 7, eyeY, 14, 4, '#2b2b33');
    c.p.hline(hx + 8, hx + 19, eyeY + 1, c.eyes.light);
    c.p.hline(hx + 9, hx + 18, eyeY + 2, c.eyes.base);
    c.p.dots([[hx + 9, eyeY + 1], [hx + 10, eyeY + 1]], '#ffffff');
  },
  stitches: (c) => {
    const { hx, hy } = c.f;
    const col = c.skin.deep;
    for (let y = hy + 3; y <= hy + 14; y++) c.p.set(hx + 17, y, col);
    for (let y = hy + 4; y <= hy + 14; y += 2) c.p.dots([[hx + 16, y], [hx + 18, y]], col);
  },
  tusks: (c) => {
    const { hx, mouthY } = c.f;
    c.p.stamp(hx + 11, mouthY - 2, ['l...l', 'lb..lb', '.b...b'], keys(BONE_R));
  },
  fangs: (c) => {
    const { hx, mouthY, eyeY } = c.f;
    if (c.v.head === 'beast') c.p.dots([[hx + 16, eyeY + 6], [hx + 18, eyeY + 6]], BONE);
    else c.p.dots([[hx + 13, mouthY + 1]], BONE);
  },
  whiskers: (c) => {
    const { hx, eyeY } = c.f;
    const col = '#ece6d4';
    c.p.dots([[hx + 13, eyeY + 5], [hx + 12, eyeY + 5], [hx + 11, eyeY + 4], [hx + 10, eyeY + 4], [hx + 13, eyeY + 6], [hx + 12, eyeY + 7], [hx + 11, eyeY + 7],
      [hx + 21, eyeY + 4], [hx + 22, eyeY + 3], [hx + 21, eyeY + 6], [hx + 22, eyeY + 6]], col);
  },
  gills: (c) => {
    const { hx, eyeY } = c.f;
    c.p.dots([[hx + 8, eyeY + 4], [hx + 9, eyeY + 6], [hx + 10, eyeY + 7], [hx + 8, eyeY + 7]], c.skin.deep);
  },
  'trunk-tusks': (c) => {
    const { hx, eyeY } = c.f;
    c.p.stamp(hx + 12, eyeY + 6, ['.lb', 'lb.', 'b..'], keys(BONE_R));
    c.p.stamp(hx + 18, eyeY + 6, ['bl.', '.bl', '..b'], keys(BONE_R));
  },
};

const HEAD: Partial<Record<Part, Drawer>> = {
  'ears-elf': (c) => c.p.stamp(c.f.hx - 3, c.f.eyeY - 7, [
    'l........',
    '.lb......',
    '.lbb.....',
    '..lbs....',
    '..lbbs...',
    '...lbbs..',
    '....lbbs.',
    '.....lbbs',
    '......lbs',
    '.......bs',
  ], keys(c.skin)),
  'ears-elf-short': (c) => c.p.stamp(c.f.hx + 1, c.f.eyeY - 3, ['l....', 'lb...', '.lbs.', '.lbbs', '..lbs', '...bs'], keys(c.skin)),
  'ears-swept': (c) => c.p.stamp(c.f.hx - 2, c.f.eyeY - 1, ['ll.......', '.lbbb....', '..lbbbbbs', '....sbbbs', '......ss.'], keys(c.skin)),
  'ears-gnome': (c) => c.p.stamp(c.f.hx + 1, c.f.eyeY - 3, ['.l....', 'lbb...', 'lbbbs.', 'lbsbbs', '.lbbbs', '..lbs.'], keys(c.skin)),
  'ears-cat': (c) => {
    const y = crownY(c) - 5;
    const pink = mix(c.skin.base, '#f0a0a0', 0.5);
    c.p.stamp(c.f.hx + 3, y, ['l.....', 'lb....', 'lpb...', 'lppb..', 'lpppbs', 'lbbbbs'], keys(c.skin, { p: pink }));
    c.p.stamp(c.f.hx + 13, y + 1, ['....s', '...bs', '..bps', '.bpps', 'bbbbs'], keys(c.skin, { p: pink }));
  },
  'ears-rabbit': (c) => {
    const y = crownY(c) - 10;
    const pink = mix(c.skin.base, '#f0a0a0', 0.5);
    c.p.stamp(c.f.hx + 4, y, ['.lb.', 'lbbs', 'lpbs', 'lpbs', 'lpbs', 'lpbs', 'lpbs', 'lpbs', '.pbs', '.lbs', '.lbs'], keys(c.skin, { p: pink }));
    c.p.stamp(c.f.hx + 10, y + 2, ['..bs', '.bbs', 'bpbs', 'bpbs', 'bpbs', 'bpbs', 'bpbs', '.pbs', '.bbs'], keys(c.skin, { p: pink }));
  },
  'ears-mouse': (c) => {
    const y = crownY(c) - 1;
    c.p.ellipse(c.f.hx + 4, y, 4, 4, c.skin.base);
    c.p.ellipse(c.f.hx + 4, y, 2.5, 2.5, mix(c.skin.base, '#f0a0a0', 0.5));
    c.p.ellipse(c.f.hx + 14, y, 3, 3.5, c.skin.shadow);
    c.p.ellipse(c.f.hx + 14, y, 1.5, 2, mix(c.skin.shadow, '#f0a0a0', 0.5));
  },
  'ears-dog': (c) => {
    const y = crownY(c) - 4;
    const pink = mix(c.skin.base, '#d08080', 0.35);
    c.p.stamp(c.f.hx + 2, y, ['l......', 'lb.....', 'lpb....', 'lppbs..', '.lppbs.', '.lbbbbs'], keys(c.skin, { p: pink }));
    c.p.stamp(c.f.hx + 13, y + 1, ['....s', '...bs', '..bps', '.bbbs', 'bbbs.'], keys(c.skin, { p: pink }));
  },
  'ears-bear': (c) => {
    const y = crownY(c);
    c.p.ellipse(c.f.hx + 5, y, 2.6, 2.6, c.skin.base);
    c.p.ellipse(c.f.hx + 5, y + 0.5, 1.2, 1.2, c.skin.deep);
    c.p.ellipse(c.f.hx + 14, y, 2.2, 2.4, c.skin.shadow);
  },
  'ears-fox': (c) => {
    const y = crownY(c) - 6;
    const pale = '#f4efe4';
    c.p.stamp(c.f.hx + 3, y, ['k.....', 'kb....', 'lbb...', 'lpbb..', 'lppbb.', 'lpppbs', 'lppbbs', '.lbbbs'], keys(c.skin, { p: pale, k: INK }));
    c.p.stamp(c.f.hx + 13, y + 2, ['....k', '...bk', '..bbs', '.bpbs', 'bppbs', 'bbbs.'], keys(c.skin, { p: pale, k: INK }));
  },
  'ears-floppy': (c) => c.p.stamp(c.f.hx + 1, c.f.eyeY - 4, ['..lb', '.lbb', 'lbbs', 'lbbs', 'lbbs', 'lbbs', '.bbs', '..s.'], keys(c.skin)),
  'horns-curved': (c) => {
    const y = crownY(c);
    c.p.stamp(c.f.hx + 1, y - 7, [
      'l.......',
      'lb......',
      'lbs.....',
      '.lbs....',
      '.lbbs...',
      '..lbbs..',
      '...lbbbs',
      '....lbbs',
      '......bs',
    ], keys(HORN_R));
    c.p.stamp(c.f.hx + 13, y - 5, ['..s', '.bs', '.bs', 'bbs', 'bs.', 's..'], keys(HORN_R));
  },
  'horns-ram': (c) => c.p.stamp(c.f.hx - 1, c.f.hy + 2, ['..lbbb..', '.lbbbbs.', 'lbs..bbs', 'lb.lb.bs', 'lbs.sbs.', '.lbbb...', '..ls....'], keys(HORN_R)),
  'horns-straight': (c) => {
    const y = crownY(c);
    c.p.stamp(c.f.hx + 5, y - 8, ['l...', 'lb..', 'lbs.', 'lbs.', '.lbs', '.lbs', '.lbs', '..bs', '..bs'], keys(HORN_R));
    c.p.stamp(c.f.hx + 14, y - 6, ['.s', 'bs', 'bs', 'bs', 'bs', '.s'], keys(HORN_R));
  },
  'horns-back': (c) => {
    const r = c.v.head === 'reptile' ? BONE_R : HORN_R;
    c.p.stamp(c.f.hx - 5, c.f.hy + 1, ['lbb.......', '.lbbbb....', '..lbbbbbbs', '....sbbbbs'], keys(r));
  },
  'horns-nubs': (c) => {
    const y = crownY(c);
    c.p.stamp(c.f.hx + 6, y - 2, ['lb', 'bs'], keys(HORN_R));
    c.p.stamp(c.f.hx + 14, y - 1, ['bs'], keys(HORN_R));
  },
  'horns-antlers': (c) => {
    const y = crownY(c);
    c.p.stamp(c.f.hx - 1, y - 10, [
      'l...l....',
      'l..lb....',
      'lb.lb..l.',
      '.lblb.lb.',
      '..lbbbb..',
      '...lbs...',
      '....lbs..',
      '.....lbs.',
      '......bs.',
      '.......bs',
    ], keys(ANTLER_R));
    c.p.stamp(c.f.hx + 13, y - 8, ['..s.s', '.bs.s', '.bsbs', 'bbs..', 'bs...', 's....'], keys(ANTLER_R));
  },
  'horns-bull': (c) => {
    c.p.stamp(c.f.hx - 6, c.f.hy - 3, ['l..........', 'lb.........', 'lbs........', '.lbbs......', '..lbbbbbbbs', '....sssssss'], keys(BONE_R));
    c.p.stamp(c.f.hx + 17, c.f.hy - 2, ['......s', '.....bs', '...bbs.', 'bbbbs..', 'sss....'], keys(BONE_R));
  },
  halo: (c) => {
    const y = crownY(c) - 7;
    c.p.stamp(c.f.hx + 1, y, ['...hhhhhhhhhh...', '.hb..........bs.', '...ssssssssss...'], keys(GOLD_R));
  },
  'beard-full': (c) => beard(c, 8),
  'beard-braided': (c) => {
    beard(c, 4);
    const { hx, chinY } = c.f;
    const r = acc(c);
    for (let y = chinY + 2; y <= chinY + 8; y++) c.p.hline(hx + 12, hx + 13, y, y % 2 ? r.base : r.shadow);
    c.p.hline(hx + 12, hx + 13, chinY + 9, GOLD_R.base);
  },
  'beard-short': (c) => beard(c, 1),
  sideburns: (c) => {
    const { hx, eyeY } = c.f;
    const r = acc(c);
    for (let y = eyeY - 1; y <= eyeY + 5; y++) c.p.hline(hx + 7, hx + 8, y, y > eyeY + 3 ? r.shadow : r.base);
  },
  crest: (c) => {
    const r = acc(c);
    c.p.stamp(c.f.hx + 1, crownY(c) - 6, ['..l...l...', '..lb..lb.l', '.lbb.lbblb', '.lbbslbbbs', 'lbbbbbbbbs', '.sssssss..'], keys(r));
  },
  spines: (c) => {
    const r = acc(c);
    c.p.stamp(c.f.hx - 1, crownY(c) - 3, ['..l....l....', '.lb...lbs.l.', '.lbs.lbbslbs', 'lbbsslbbsbbs'], keys(r));
  },
  antennae: (c) => {
    const { hx, hy } = c.f;
    const col = c.skin.deep;
    c.p.dots([[hx + 8, hy], [hx + 7, hy - 1], [hx + 7, hy - 2], [hx + 6, hy - 3], [hx + 5, hy - 4], [hx + 5, hy - 5]], col);
    c.p.dots([[hx + 14, hy], [hx + 15, hy - 1], [hx + 15, hy - 2], [hx + 16, hy - 3]], col);
    c.p.stamp(hx + 3, hy - 8, ['.l.', 'lbs', '.s.'], keys(acc(c)));
    c.p.stamp(hx + 15, hy - 6, ['bs', 's.'], keys(acc(c)));
  },
  fins: (c) => {
    const r = acc(c);
    if (c.v.head === 'fish') {
      c.p.stamp(c.f.hx + 2, c.f.hy - 5, ['l..l..l...', 'lb.lb.lb.l', 'lbslbslbsb', 'lbbbbbbbbs', '.sssssss..'], keys(r));
      return;
    }
    c.p.stamp(c.f.hx - 2, c.f.eyeY - 4, ['l......', 'lb.....', 'lsb....', 'lbsb...', 'lsbsbs.', 'lbsbsbs', '.lbbbbs', '...sss.'], keys(r));
  },
  gem: (c) => c.p.stamp(c.f.hx + 12, c.f.eyeY - 4, ['.lb.', 'lhbs', '.bs.'], { l: '#7ae0f0', h: '#e6fcff', b: '#3ab0d0', s: '#1a7090' }),
  'third-eye': (c) => c.p.stamp(c.f.hx + 12, c.f.eyeY - 5, ['.kk.', 'whdw', '.ii.'], { k: INK, w: '#f4f1ea', h: '#ffffff', d: c.eyes.deep, i: c.eyes.base }),
  'flame-hair': (c) => {
    const r = acc(c);
    const t = hairTemplate(2);
    const h = t.front.length;
    hairShape(c, 2, (k, _x, y) => {
      const f = y / h;
      if (k === 'h') return '#fff2b0';
      return f < 0.2 ? '#fff2b0' : f < 0.4 ? r.hi : f < 0.65 ? r.light : k === 'd' || k === 'x' || k === 'X' ? r.shadow : r.base;
    });
  },
  'water-hair': (c) => {
    const r = acc(c);
    hairShape(c, 5, (k, x, y) => (k === 'h' || (x * 3 + y) % 7 === 0 ? '#ffffff' : k === 's' ? r.light : k === 'd' || k === 'x' || k === 'X' ? r.shadow : r.base));
  },
  'stone-hair': (c) => {
    const r = acc(c);
    hairShape(c, 1, (k, x, y) => {
      const cell = (Math.floor(x / 3) + Math.floor(y / 3) * 2) % 4;
      if (k === 'd' || k === 'x' || k === 'X') return r.deep;
      return x % 3 === 0 || y % 3 === 0 ? r.shadow : cell === 0 ? r.light : r.base;
    });
  },
  'air-hair': (c) => {
    const r = acc(c);
    hairShape(c, 11, (k, x, y) => ((x + y * 2) % 5 === 0 ? null : `${k === 'h' || k === 'l' ? r.hi : k === 's' || k === 'd' ? r.base : r.light}c0`));
  },
  'mushroom-cap': (c) => {
    const { hx, hy } = c.f;
    const r = acc(c);
    for (let x = hx - 6; x <= hx + 23; x++) {
      const nx = (x - (hx + 8.5)) / 15.5;
      const top = hy + 4 - Math.round(Math.sqrt(Math.max(0, 1 - nx * nx)) * 11);
      for (let y = top; y <= hy + 4; y++) c.p.set(x, y, y === top ? r.light : nx > 0.55 ? r.shadow : y > hy + 2 ? r.shadow : r.base);
    }
    c.p.hline(hx - 5, hx + 22, hy + 5, mix(c.skin.base, '#f4efe0', 0.5));
    c.p.hline(hx - 3, hx + 20, hy + 6, mix(c.skin.shadow, '#f4efe0', 0.3));
    for (const [x, y] of [[0, -1], [7, -5], [14, -3], [4, 1], [18, 1]] as [number, number][]) c.p.ellipse(hx + x, hy + y, 1.3, 1, '#f6f2ea');
  },
  leaves: (c) => {
    const leaf = ramp('#5a9a3a');
    const y = crownY(c);
    for (const [x, dy, flip] of [[1, -1, false], [6, -3, false], [12, -3, true], [17, -1, true]] as [number, number, boolean][]) {
      c.p.stamp(c.f.hx + x, y + dy, ['..lb', '.lbs', 'lbs.', 's...'], keys(leaf), flip);
    }
  },
};

/** Beard over the lower face following the three-quarter jaw; `len` rows below the chin. */
function beard(c: DrawCtx, len: number) {
  const { p, f } = c;
  const r = acc(c);
  const { hx, hy, eyeY, mouthY, chinY } = f;
  for (let y = eyeY + 3; y <= chinY + len; y++) {
    let x1: number;
    let x2: number;
    const row = HEAD_HUMAN[y - hy];
    if (row) {
      x1 = Math.max(hx + 6, hx + row.search(/[^.]/));
      x2 = hx + row.length;
    } else {
      // Narrows to a point under the chin, right of centre.
      const t = (y - chinY) / (len + 1);
      x1 = hx + 11 + Math.round(t * 3);
      x2 = hx + 17 - Math.round(t * 3);
    }
    for (let x = x1; x <= x2; x++) {
      if (y === mouthY && x >= hx + 12 && x <= hx + 15) continue;
      const k = x === x1 ? r.light : x >= x2 - 1 ? r.shadow : (x + y) % 3 === 0 && y > mouthY ? r.shadow : r.base;
      p.set(x, y, y >= chinY + len - 1 ? r.shadow : k);
    }
  }
  // Moustache over the mouth.
  p.hline(hx + 12, hx + 16, mouthY - 1, r.light);
  p.hline(hx + 13, hx + 14, mouthY, mix(c.skin.deep, '#5a1a2a', 0.4));
}

const LAYERS: Record<Layer, Partial<Record<Part, Drawer>>> = { 'body-back': BODY_BACK, back: BACK, skin: SKIN, face: FACE, head: HEAD };

/** Draws the parts of one layer; body-back parts go to the canonical body painter `bodyP`. */
export function drawFeatures(c: DrawCtx, layer: Layer, bodyP?: Painter) {
  const table = LAYERS[layer];
  const p = bodyP ?? c.p;
  p.tag = layer === 'skin' ? 'skin' : `part-${layer}`;
  for (const part of c.parts) table[part]?.(c, p);
  p.tag = null;
}
