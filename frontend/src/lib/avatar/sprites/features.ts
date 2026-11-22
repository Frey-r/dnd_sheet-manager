/* Race parts for the front-facing chibi: ears, horns, tails, wings, beards, elemental hair, marks…
   Each part belongs to one layer:
   back  – behind the body (tails, wings, mane, frill, shell, shadow)
   skin  – painted on the bare head before the face and hair (spots, stripes)
   face  – after the eyes, under the hair (marks, tusks, whiskers, visor)
   head  – over the hair (ears, horns, beards, crests, elemental hair, halo) */
import { mix, ramp, type Ramp } from '../color';
import { FOOT_Y, mx } from '../painter';
import { BONE, HORN } from '../palettes';
import type { Part } from '../types';
import { shadeSpan } from './body';
import { INK, type DrawCtx } from './context';

export type Layer = 'back' | 'skin' | 'face' | 'head';

type Drawer = (c: DrawCtx) => void;

const HORN_R = ramp(HORN);
const BONE_R = ramp(BONE);
const GOLD_R = ramp('#f0c850');
const ANTLER_R = ramp('#c9b48a');

/** Accent ramp: hair colour, used for crests, fins, plumage, shells, elemental hair. */
const acc = (c: DrawCtx) => c.hair;

const keys = (r: Ramp, extra: Record<string, string> = {}) => ({ h: r.hi, l: r.light, b: r.base, s: r.shadow, d: r.deep, ...extra });

/** Stamps a template for the viewer's left side and its mirror for the right side. */
function pair(c: DrawCtx, x: number, y: number, rows: string[], map: Record<string, string>) {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  c.p.stamp(x, y, rows, map);
  c.p.stamp(mx(x + w - 1), y, rows, map, true);
}

/** Thick polyline (tails). Width shrinks from w0 to w1 along the path. */
function path(c: DrawCtx, pts: [number, number][], r: Ramp, w0 = 2, w1 = 1) {
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
      for (let k = 0; k < w; k++) c.p.set(x, y + k, k === 0 ? r.light : k === w - 1 ? r.shadow : r.base);
    }
  }
}

/** Mirror-symmetric pixel list on the head. */
const sym = (c: DrawCtx, pts: [number, number][], col: string) => c.p.sym(pts, col);

/** Feathered wings: an arched top, a row of coverts and long primaries ending in points. */
function featherWings(c: DrawCtx, r: Ramp) {
  pair(c, c.f.arm.x - 9, c.f.torsoTop - 6, [
    '.....lllll.',
    '...llbbbbbl',
    '..lbbbbbbbb',
    '.lbbbbbbbbs',
    '.lbsssbbbss',
    'lbbbbbsbbs.',
    'lbsbbbsbs..',
    'lbsbbsbbs..',
    'lbsbsbbs...',
    'lbsbsbs....',
    'lbsbsbs....',
    '.bsbsb.....',
    '.bs.sb.....',
    '..s..s.....',
  ], keys(r));
}

const BACK: Partial<Record<Part, Drawer>> = {
  'tail-devil': (c) => {
    const { torsoBottom: b } = c.f;
    const r = c.skin;
    path(c, [[28, b - 1], [32, b + 1], [36, b], [38, b - 4], [38, b - 7]], ramp(r.shadow), 2, 1);
    c.p.stamp(36, b - 10, ['..l..', '.lbs.', 'lbbbs', '..s..'], keys(ramp(r.shadow)));
  },
  'tail-reptile': (c) => {
    const { torsoBottom: b } = c.f;
    path(c, [[27, b - 2], [32, b + 2], [36, b + 6], [40, FOOT_Y - 1], [43, FOOT_Y]], c.skin, 4, 1);
  },
  'tail-cat': (c) => {
    const { torsoBottom: b } = c.f;
    path(c, [[28, b - 1], [33, b], [36, b - 3], [37, b - 8], [35, b - 12]], c.skin, 2, 2);
    c.p.dots([[35, b - 13], [34, b - 12]], acc(c).base);
  },
  'tail-fox': (c) => {
    const { torsoBottom: b } = c.f;
    c.p.ellipse(35, b - 3, 4, 7, c.skin.base);
    c.p.ellipse(34, b - 4, 2, 5, c.skin.light);
    for (let y = b + 1; y <= b + 4; y++) c.p.set(38, y - 1, c.skin.shadow);
    c.p.ellipse(35, b - 9, 2.5, 2, '#f4efe4');
  },
  'tail-horse': (c) => {
    const { torsoBottom: b } = c.f;
    const r = acc(c);
    for (let t = 0; t < 14; t++) {
      const x = 29 + Math.round(t * 0.5);
      c.p.hline(x, x + 2 - Math.floor(t / 7), b - 2 + t, t % 3 === 0 ? r.light : r.base);
      c.p.set(x + 2, b - 2 + t, r.shadow);
    }
  },
  'tail-rat': (c) => {
    const { torsoBottom: b } = c.f;
    path(c, [[28, b], [33, b + 4], [37, b + 7], [41, b + 7], [43, b + 5]], ramp('#d99a9a'), 2, 1);
  },
  'tail-stub': (c) => {
    const { torsoBottom: b } = c.f;
    c.p.ellipse(31, b - 2, 2, 2, mix(c.skin.base, '#ffffff', 0.4));
    c.p.set(32, b - 1, c.skin.base);
  },
  'wings-fairy': (c) => {
    const { f, p } = c;
    for (const right of [false, true]) {
      const cx = right ? 36 : 11;
      p.ellipse(cx, f.torsoTop - 1, 5, 6, '#cfeeffb0');
      p.ellipse(cx + (right ? -1 : 1), f.torsoTop + 8, 3.5, 3.5, '#e6d6ffb0');
      p.ellipse(cx + (right ? -1 : 1), f.torsoTop - 2, 2.5, 3.5, '#f4fbffd0');
      const vx = right ? -1 : 1;
      for (let i = 0; i < 5; i++) p.set(cx + vx * (4 - i), f.torsoTop + 3 - i * 2, '#ffffffe0');
    }
  },
  'wings-feather': (c) => {
    const col = c.v.head === 'beak' ? c.skin : ramp('#eeeae2');
    featherWings(c, col);
  },
  'wings-bat': (c) => {
    const { f } = c;
    const r = ramp(mix(c.skin.base, '#2a1a2a', 0.45));
    pair(c, f.arm.x - 10, f.torsoTop - 6, [
      'b.........',
      'bb.......d',
      'bsb.....db',
      'bssb...dbb',
      'bsssbbdbbb',
      'bssssbbbb.',
      'bsss.sbb..',
      'bss...sb..',
      'bs.....b..',
      'b.........',
    ], { b: r.base, s: r.shadow, d: r.deep });
  },
  shadow: (c) => {
    const { f, p } = c;
    const smoke = '#2b2140a0';
    for (const [x, y] of [[13, 4], [11, 8], [12, 12], [10, 15], [35, 6], [37, 10], [36, 14]] as [number, number][]) {
      p.ellipse(x, f.torsoTop + y, 1.5, 1.5, smoke);
    }
    p.hline(14, 33, FOOT_Y + 1, smoke);
  },
  mane: (c) => {
    const { f, p } = c;
    const r = acc(c);
    p.ellipse(23.5, f.hy + 9, 14, 13, r.shadow);
    p.ellipse(22.5, f.hy + 8, 13, 12, r.base);
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const x = Math.round(23.5 + Math.cos(ang) * 15);
      const y = Math.round(f.hy + 9 + Math.sin(ang) * 14);
      p.set(x, y, Math.cos(ang) < 0 ? r.light : r.shadow);
    }
    p.ellipse(18, f.hy + 1, 4, 2, r.light);
  },
  frill: (c) => {
    const { f, p } = c;
    const r = acc(c);
    p.ellipse(23.5, f.hy + 10, 16, 12, r.base);
    for (let a = 0; a < 12; a++) {
      const ang = Math.PI + (a / 11) * Math.PI;
      for (let d = 6; d < 16; d++) p.set(Math.round(23.5 + Math.cos(ang) * d), Math.round(f.hy + 10 + Math.sin(ang) * d * 0.8), r.shadow);
    }
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      p.set(Math.round(23.5 + Math.cos(ang) * 16), Math.round(f.hy + 10 + Math.sin(ang) * 12), a % 2 ? r.light : r.deep);
    }
  },
  shell: (c) => {
    const { f, p } = c;
    const r = acc(c);
    const cy = f.torsoTop + 6;
    p.ellipse(23.5, cy, 11, 10, r.shadow);
    p.ellipse(22.5, cy - 1, 10, 9, r.base);
    for (let y = cy - 8; y <= cy + 8; y += 4) p.hline(12, 35, y, r.deep);
    p.ellipse(18, cy - 6, 3, 1.5, r.light);
  },
  'water-hair': (c) => {
    const { f, p } = c;
    const r = acc(c);
    for (let x = 11; x <= 36; x++) {
      const len = 22 + Math.round(Math.sin(x / 2) * 2);
      for (let y = f.hy + 3; y <= f.hy + len; y++) p.set(x, y, (x + y) % 7 === 0 ? r.light : r.shadow);
    }
  },
};

const SKIN: Partial<Record<Part, Drawer>> = {
  spots: (c) => {
    const { hy, eyeY } = c.f;
    const col = acc(c).shadow;
    c.p.dots([[17, hy + 3], [19, hy + 2], [18, hy + 4], [30, hy + 4], [31, hy + 6], [15, eyeY + 5], [32, eyeY + 5], [31, eyeY + 6]], col);
  },
  stripes: (c) => {
    const { hy, eyeY } = c.f;
    const col = acc(c).deep;
    sym(c, [[21, hy + 1], [21, hy + 2], [21, hy + 3], [18, hy + 2], [18, hy + 3], [14, eyeY + 4], [15, eyeY + 4], [14, eyeY + 6], [15, eyeY + 6], [16, eyeY + 6]], col);
    c.p.dots([[23, hy + 1], [24, hy + 1], [23, hy + 2], [24, hy + 2], [23, hy + 4], [24, hy + 4]], col);
  },
};

const FACE: Partial<Record<Part, Drawer>> = {
  freckles: (c) => {
    const { eyeY } = c.f;
    sym(c, [[16, eyeY + 5], [18, eyeY + 6], [19, eyeY + 5]], mix(c.skin.shadow, '#7a3a1a', 0.35));
  },
  scar: (c) => {
    const { eyeY } = c.f;
    const col = mix(c.skin.base, '#a04040', 0.5);
    c.p.dots([[18, eyeY - 4], [19, eyeY - 3], [19, eyeY - 2], [21, eyeY + 4], [21, eyeY + 5], [22, eyeY + 6]], col);
    c.p.dots([[20, eyeY - 1], [17, eyeY - 4]], mix(c.skin.base, '#ffffff', 0.25));
  },
  tattoo: (c) => {
    const { eyeY, hy } = c.f;
    const col = c.v.hair ? '#2e4a7a' : acc(c).deep;
    sym(c, [[16, eyeY + 4], [17, eyeY + 5], [17, eyeY + 6], [15, eyeY + 6]], col);
    c.p.dots([[23, hy + 5], [24, hy + 5], [23, hy + 6], [24, hy + 6], [23, hy + 7], [24, hy + 7]], col);
  },
  mark: (c) => {
    const { eyeY } = c.f;
    c.p.dots([[17, eyeY + 4], [16, eyeY + 5], [18, eyeY + 5], [17, eyeY + 6]], '#8a3aa8');
    c.p.set(17, eyeY + 5, '#c07ad8');
  },
  plates: (c) => {
    const { hy, eyeY, mouthY, chinY, waistY } = c.f;
    const line = c.skin.deep;
    c.p.hline(15, 32, hy + 5, line);
    c.p.vline(16, hy + 5, chinY - 2, line);
    c.p.vline(31, hy + 5, chinY - 2, line);
    c.p.hline(21, 26, mouthY, INK);
    c.p.dots([[22, mouthY], [24, mouthY]], c.skin.shadow);
    c.p.dots([[18, hy + 3], [19, hy + 2]], c.skin.hi);
    c.p.set(24, eyeY + 4, c.skin.shadow);
    c.p.hline(c.f.span(waistY)[0], c.f.span(waistY)[1], waistY, line);
  },
  visor: (c) => {
    const { eyeY } = c.f;
    c.p.rect(15, eyeY, 18, 4, '#2b2b33');
    c.p.hline(15, 32, eyeY - 1, '#4a4a55');
    c.p.hline(17, 30, eyeY + 1, c.eyes.light);
    c.p.hline(18, 29, eyeY + 2, c.eyes.base);
    c.p.set(18, eyeY + 1, '#ffffff');
  },
  stitches: (c) => {
    const { hy, chinY } = c.f;
    const col = c.skin.deep;
    for (let y = hy + 3; y <= chinY - 2; y++) c.p.set(30, y, col);
    for (let y = hy + 4; y <= chinY - 2; y += 2) c.p.dots([[29, y], [31, y]], col);
  },
  tusks: (c) => {
    const { mouthY } = c.f;
    pair(c, 20, mouthY - 2, ['l.', 'lb', 'lb', '.b'], keys(BONE_R));
  },
  fangs: (c) => {
    const { mouthY, eyeY } = c.f;
    if (c.v.head === 'beast') c.p.sym([[22, eyeY + 7]], BONE);
    else c.p.sym([[22, mouthY + 1]], BONE);
  },
  whiskers: (c) => {
    const { eyeY } = c.f;
    const col = '#ece6d4';
    sym(c, [[18, eyeY + 5], [17, eyeY + 5], [16, eyeY + 4], [15, eyeY + 4], [18, eyeY + 6], [17, eyeY + 7], [16, eyeY + 7]], col);
  },
  gills: (c) => {
    const { eyeY } = c.f;
    sym(c, [[15, eyeY + 4], [16, eyeY + 5], [15, eyeY + 6], [16, eyeY + 7]], c.skin.deep);
  },
  'trunk-tusks': (c) => {
    const { eyeY } = c.f;
    pair(c, 18, eyeY + 6, ['.lb', 'lb.', 'b..'], keys(BONE_R));
  },
};

const HEAD: Partial<Record<Part, Drawer>> = {
  'ears-elf': (c) => pair(c, 5, c.f.eyeY - 6, [
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
  'ears-elf-short': (c) => pair(c, 9, c.f.eyeY - 3, ['l....', 'lb...', '.lbs.', '.lbbs', '..lbs', '...bs'], keys(c.skin)),
  'ears-swept': (c) => pair(c, 6, c.f.eyeY - 1, ['ll......', '.lbbb...', '..lbbbbs', '....sbbs', '......s.'], keys(c.skin)),
  'ears-gnome': (c) => pair(c, 8, c.f.eyeY - 3, ['.l....', 'lbb...', 'lbbbs.', 'lbsbbs', '.lbbbs', '..lbs.'], keys(c.skin)),
  'ears-cat': (c) => {
    const pink = mix(c.skin.base, '#f0a0a0', 0.5);
    pair(c, 13, c.f.hy - 4, ['l.....', 'lb....', 'lpb...', 'lppb..', 'lpppbs', 'lbbbbs'], keys(c.skin, { p: pink }));
  },
  'ears-rabbit': (c) => {
    const pink = mix(c.skin.base, '#f0a0a0', 0.5);
    pair(c, 16, c.f.hy - 10, ['.lb.', 'lbbs', 'lpbs', 'lpbs', 'lpbs', 'lpbs', 'lpbs', 'lpbs', '.pbs', '.lbs', '.lbs'], keys(c.skin, { p: pink }));
  },
  'ears-mouse': (c) => {
    for (const right of [false, true]) {
      const x = right ? 33 : 14;
      c.p.ellipse(x, c.f.hy + 1, 4, 4, right ? c.skin.shadow : c.skin.base);
      c.p.ellipse(x, c.f.hy + 1, 2.5, 2.5, mix(c.skin.base, '#f0a0a0', 0.5));
    }
  },
  'ears-dog': (c) => {
    const pink = mix(c.skin.base, '#d08080', 0.35);
    pair(c, 11, c.f.hy - 4, ['l......', 'lb.....', 'lpb....', 'lppbs..', '.lppbs.', '.lbbbbs'], keys(c.skin, { p: pink }));
  },
  'ears-bear': (c) => {
    for (const right of [false, true]) {
      const x = right ? 31 : 16;
      c.p.ellipse(x, c.f.hy, 2.6, 2.6, right ? c.skin.shadow : c.skin.base);
      c.p.ellipse(x, c.f.hy + 0.5, 1.2, 1.2, c.skin.deep);
    }
  },
  'ears-fox': (c) => {
    const pink = '#f4efe4';
    pair(c, 13, c.f.hy - 6, ['k.....', 'kb....', 'lbb...', 'lpbb..', 'lppbb.', 'lpppbs', 'lppbbs', '.lbbbs'], keys(c.skin, { p: pink, k: INK }));
  },
  'ears-floppy': (c) => pair(c, 9, c.f.eyeY - 4, ['..lb', '.lbb', 'lbbs', 'lbbs', 'lbbs', 'lbbs', '.bbs', '..s.'], keys(c.skin)),
  'horns-curved': (c) => pair(c, 11, c.f.hy - 6, [
    'l.......',
    'lb......',
    'lbs.....',
    '.lbs....',
    '.lbbs...',
    '..lbbs..',
    '...lbbbs',
    '....lbbs',
    '......bs',
  ], keys(HORN_R)),
  'horns-ram': (c) => pair(c, 8, c.f.hy + 1, ['..lbbb..', '.lbbbbs.', 'lbs..bbs', 'lb.lb.bs', 'lbs.sbs.', '.lbbb...', '..ls....'], keys(HORN_R)),
  'horns-straight': (c) => pair(c, 15, c.f.hy - 7, ['l...', 'lb..', 'lbs.', 'lbs.', '.lbs', '.lbs', '.lbs', '..bs', '..bs'], keys(HORN_R)),
  'horns-back': (c) => {
    const r = c.v.head === 'reptile' ? BONE_R : HORN_R;
    pair(c, 7, c.f.hy, ['lbb......', '.lbbbb...', '..lbbbbbs', '....sbbbs'], keys(r));
  },
  'horns-nubs': (c) => pair(c, 18, c.f.hy, ['lb', 'bs'], keys(HORN_R)),
  'horns-antlers': (c) => pair(c, 9, c.f.hy - 9, [
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
  ], keys(ANTLER_R)),
  'horns-bull': (c) => pair(c, 4, c.f.hy - 4, ['l..........', 'lb.........', 'lbs........', '.lbbs......', '..lbbbbbbbs', '....sssssss'], keys(BONE_R)),
  halo: (c) => {
    const y = c.f.hy - 9;
    c.p.stamp(17, y, ['...hhhhhhhh...', '.hb........bs.', '...ssssssss...'], keys(GOLD_R));
  },
  'beard-full': (c) => beard(c, 9),
  'beard-braided': (c) => {
    beard(c, 5);
    const { chinY } = c.f;
    const r = acc(c);
    for (const x of [20, 26]) {
      for (let y = chinY + 2; y <= chinY + 8; y++) c.p.hline(x, x + 1, y, (y % 2) ? r.base : r.shadow);
      c.p.hline(x, x + 1, chinY + 9, GOLD_R.base);
    }
  },
  'beard-short': (c) => beard(c, 2),
  sideburns: (c) => {
    const { eyeY } = c.f;
    const r = acc(c);
    for (let y = eyeY - 1; y <= eyeY + 4; y++) { c.p.hline(14, 15, y, r.base); c.p.hline(32, 33, y, r.shadow); }
  },
  crest: (c) => {
    const r = acc(c);
    const { hy } = c.f;
    c.p.stamp(19, hy - 7, ['..l...l...', '..lb..lb.l', '.lbb.lbblb', '.lbbslbbbs', 'lbbbbbbbbs', '.sssssss..'], keys(r));
  },
  spines: (c) => {
    const r = acc(c);
    const { hy } = c.f;
    c.p.stamp(18, hy - 4, ['..l....l....', '.lb...lbs.l.', '.lbs.lbbslbs', 'lbbsslbbsbbs'], keys(r));
  },
  antennae: (c) => {
    const { hy } = c.f;
    const col = c.skin.deep;
    sym(c, [[20, hy], [19, hy - 1], [19, hy - 2], [18, hy - 3], [17, hy - 4], [17, hy - 5]], col);
    pair(c, 15, hy - 8, ['.l.', 'lbs', '.s.'], keys(acc(c)));
  },
  fins: (c) => {
    const r = acc(c);
    if (c.v.head === 'fish') {
      c.p.stamp(19, c.f.hy - 5, ['l..l..l...', 'lb.lb.lb.l', 'lbslbslbsb', 'lbbbbbbbbs', '.sssssss..'], keys(r));
      return;
    }
    pair(c, 7, c.f.eyeY - 4, ['l......', 'lb.....', 'lsb....', 'lbsb...', 'lsbsbs.', 'lbsbsbs', '.lbbbbs', '...sss.'], keys(r));
  },
  gem: (c) => {
    const { eyeY } = c.f;
    c.p.stamp(22, eyeY - 4, ['.lb.', 'lhbs', '.bs.'], { l: '#7ae0f0', h: '#e6fcff', b: '#3ab0d0', s: '#1a7090' });
  },
  'third-eye': (c) => {
    const { eyeY } = c.f;
    c.p.stamp(22, eyeY - 5, ['.kk.', 'whdw', '.ii.'], { k: INK, w: '#f4f1ea', h: '#ffffff', d: c.eyes.deep, i: c.eyes.base });
  },
  'flame-hair': (c) => {
    const { hy } = c.f;
    const r = acc(c);
    const heights = [3, 6, 4, 8, 5, 10, 7, 9, 5, 8, 4, 6, 3];
    for (let i = 0; i < heights.length; i++) {
      const x = 12 + i * 2;
      const h = heights[i];
      for (let k = 0; k < h + 5; k++) {
        const y = hy + 4 - k;
        const t = k / (h + 5);
        const col = t > 0.8 ? '#fff2b0' : t > 0.55 ? r.hi : t > 0.25 ? r.light : r.base;
        c.p.hline(x, x + (t > 0.7 ? 0 : 1), y, col);
      }
    }
    c.p.hline(13, 34, hy + 5, r.shadow);
    for (const x of [12, 35]) c.p.vline(x, hy + 4, hy + 9, r.base);
  },
  'water-hair': (c) => {
    const { hy } = c.f;
    const r = acc(c);
    for (let x = 12; x <= 35; x++) {
      const nx = (x - 23.5) / 12;
      const top = hy - 3 + Math.round(Math.abs(nx) * 4);
      const bottom = hy + 4 + (Math.abs(nx) > 0.75 ? 10 : 0) + Math.round(Math.sin(x) * 1);
      for (let y = top; y <= bottom; y++) c.p.set(x, y, y === top ? r.hi : (x + y) % 5 === 0 ? r.light : x > 30 ? r.shadow : r.base);
    }
    c.p.dots([[17, hy - 1], [18, hy - 1], [19, hy - 2], [16, hy + 2]], '#ffffff');
  },
  'stone-hair': (c) => {
    const { hy } = c.f;
    const r = acc(c);
    const rocks: [number, number, number][] = [[13, 1, 4], [16, -2, 5], [20, -4, 5], [25, -3, 5], [29, -1, 4], [32, 2, 3]];
    for (const [x, y, w] of rocks) {
      c.p.stamp(x, hy + y, ['.ll' + 'b'.repeat(w - 2), 'l' + 'b'.repeat(w) + 's', 'l' + 'b'.repeat(w - 1) + 'ss', '.' + 's'.repeat(w + 1)], keys(r));
    }
    c.p.hline(13, 34, hy + 4, r.shadow);
  },
  'air-hair': (c) => {
    const { hy } = c.f;
    const r = acc(c);
    const col = (k: string) => `${k}b8`;
    for (let i = 0; i < 5; i++) {
      const y = hy - 3 + i * 2;
      for (let x = 12 + i; x <= 35 - i; x++) if ((x + i) % 5 !== 0) c.p.set(x, y + Math.round(Math.sin(x / 2 + i)), col(i % 2 ? r.light : r.hi));
    }
  },
  'mushroom-cap': (c) => {
    const { hy } = c.f;
    const r = acc(c);
    for (let x = 8; x <= 39; x++) {
      const nx = (x - 23.5) / 16;
      const top = hy + 3 - Math.round(Math.sqrt(Math.max(0, 1 - nx * nx)) * 10);
      for (let y = top; y <= hy + 3; y++) c.p.set(x, y, y === top ? r.light : nx > 0.6 ? r.shadow : r.base);
    }
    c.p.hline(9, 38, hy + 4, mix(c.skin.base, '#f4efe0', 0.5));
    c.p.hline(11, 36, hy + 5, mix(c.skin.shadow, '#f4efe0', 0.3));
    for (const [x, y] of [[15, -1], [22, -4], [29, -2], [19, 1], [33, 1]] as [number, number][]) {
      c.p.ellipse(x, hy + y, 1.3, 1, '#f6f2ea');
    }
  },
  leaves: (c) => {
    const { hy } = c.f;
    const leaf = ramp('#5a9a3a');
    for (const [x, y, flip] of [[14, -2, false], [19, -4, false], [25, -4, true], [30, -2, true]] as [number, number, boolean][]) {
      c.p.stamp(x, hy + y, ['..lb', '.lbs', 'lbs.', 's...'], keys(leaf), flip);
    }
  },
};

/** Beard over the lower face; `len` rows below the chin. The mouth stays visible. */
function beard(c: DrawCtx, len: number) {
  const { p, f } = c;
  const r = acc(c);
  const { eyeY, mouthY, chinY } = f;
  for (let y = eyeY + 3; y <= chinY + len; y++) {
    let hw: number;
    if (y <= chinY) hw = 10 - Math.max(0, y - (chinY - 2));
    else hw = Math.max(1, Math.round(9 * (1 - (y - chinY) / (len + 1))));
    const x1 = 24 - hw;
    const x2 = 23 + hw;
    if (y < mouthY - 1) {
      // Sideburns down the cheeks.
      const sw = 2 + (y - (eyeY + 3));
      shadeSpan(p, y, x1, x1 + sw - 1, r, 0);
      shadeSpan(p, y, x2 - sw + 1, x2, r, 1);
      continue;
    }
    shadeSpan(p, y, x1, x2, r, y > chinY + len - 2 ? 1 : 0);
    for (let x = x1 + 2; x < x2; x += 3) if (y > mouthY) p.set(x, y, r.shadow);
  }
  // Moustache above the mouth, mouth gap below it.
  p.hline(20, 27, mouthY - 1, r.light);
  p.hline(22, 25, mouthY, mix(c.skin.deep, '#5a1a2a', 0.4));
  p.set(20, mouthY, r.shadow);
  p.set(27, mouthY, r.shadow);
}

const LAYERS: Record<Layer, Partial<Record<Part, Drawer>>> = { back: BACK, skin: SKIN, face: FACE, head: HEAD };

export function drawFeatures(c: DrawCtx, layer: Layer) {
  const table = LAYERS[layer];
  c.p.tag = layer === 'skin' ? 'skin' : `part-${layer}`;
  for (const part of c.parts) table[part]?.(c);
  c.p.tag = null;
}
