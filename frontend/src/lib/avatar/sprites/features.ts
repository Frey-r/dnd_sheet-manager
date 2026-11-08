/* Race parts: ears, horns, tails, wings, beards, elemental hair, marks…
   Each part belongs to one layer:
   back  – behind the body (tails, wings, mane, frill, shadow)
   mid   – over the clothes, under the head (shell)
   skin  – painted on the bare head before hair (spots, stripes)
   head  – over the hair (ears, horns, beards, crests, elemental hair)
   face  – after the eyes (marks, tusks, whiskers, visor) */
import { mix, shade } from '../color';
import { BONE, HORN } from '../palettes';

const HORN_LIGHT = '#cdbcae';
import type { Part } from '../types';
import { INK, type DrawCtx } from './context';

export type Layer = 'back' | 'mid' | 'skin' | 'head' | 'face';

type Drawer = (c: DrawCtx) => void;

/** Accent colour: hair colour, used for crests, fins, plumage, shells, elemental hair. */
const accent = (c: DrawCtx) => c.hair;

function geo(c: DrawCtx) {
  const { x: hx, y: hy, w: hw, h: hh } = c.f.head;
  return { hx, hy, hw, hh, front: hx + hw, ex: c.f.eye.x, ey: c.f.eye.y, T: c.f.torso, hip: c.f.hipY };
}

const BACK: Partial<Record<Part, Drawer>> = {
  'tail-devil': (c) => {
    const { T, hip } = geo(c);
    const x = T.x;
    c.p.dots([[x - 1, hip], [x - 2, hip + 1], [x - 3, hip + 2], [x - 4, hip + 2], [x - 5, hip + 1], [x - 6, hip], [x - 6, hip - 1]], c.skinDark);
    c.p.dots([[x - 7, hip - 2], [x - 6, hip - 2], [x - 5, hip - 2], [x - 6, hip - 3]], shade(c.skinDark, 0.8));
  },
  'tail-reptile': (c) => {
    const { T, hip } = geo(c);
    const x = T.x;
    const floor = c.f.backFoot.y;
    c.p.rect(x - 2, hip - 1, 3, 3, c.skinDark);
    c.p.rect(x - 4, hip + 1, 3, 2, c.skinDark);
    c.p.rect(x - 6, Math.min(floor - 1, hip + 3), 3, 2, c.skinDark);
    c.p.set(x - 7, Math.min(floor, hip + 4), c.skinDark);
    c.p.hline(x - 6, x - 1, Math.min(floor, hip + 2), mix(c.skinDark, '#f2e6c0', 0.25));
  },
  'tail-cat': (c) => {
    const { T, hip } = geo(c);
    const x = T.x;
    c.p.dots([[x - 1, hip], [x - 2, hip], [x - 3, hip - 1], [x - 4, hip - 2], [x - 4, hip - 3], [x - 4, hip - 4]], c.skinDark);
    c.p.set(x - 3, hip - 5, accent(c));
  },
  'tail-fox': (c) => {
    const { T, hip } = geo(c);
    c.p.ellipse(T.x - 4, hip + 1, 3, 2, c.skinDark);
    c.p.dots([[T.x - 7, hip + 1], [T.x - 7, hip], [T.x - 6, hip + 2]], '#f2eee4');
  },
  'tail-horse': (c) => {
    const { T, hip } = geo(c);
    for (let i = 0; i < 7; i++) c.p.hline(T.x - 2 - Math.floor(i / 2), T.x - Math.floor(i / 2), hip - 1 + i, i % 2 ? accent(c) : shade(accent(c), 0.8));
  },
  'tail-rat': (c) => {
    const { T, hip } = geo(c);
    c.p.dots([[T.x - 1, hip], [T.x - 2, hip + 1], [T.x - 3, hip + 2], [T.x - 4, hip + 3], [T.x - 5, hip + 3], [T.x - 6, hip + 2], [T.x - 7, hip + 1]], '#d9a0a0');
  },
  'tail-stub': (c) => {
    const { T, hip } = geo(c);
    c.p.rect(T.x - 2, hip - 2, 2, 2, mix(c.skin, '#ffffff', 0.35));
  },
  'wings-fairy': (c) => {
    const { T } = geo(c);
    const wing = '#d6f0ffb8';
    c.p.ellipse(T.x - 3, T.y, 3, 4, wing);
    c.p.ellipse(T.x - 2, T.y + 6, 2, 2, wing);
    c.p.dots([[T.x - 3, T.y - 1], [T.x - 4, T.y + 1], [T.x - 2, T.y + 6]], '#ffffffd0');
  },
  'wings-feather': (c) => {
    const { T } = geo(c);
    const col = c.v.head === 'beak' ? shade(c.skin, 0.85) : '#f4f1ea';
    c.p.ellipse(T.x - 3, T.y + 2, 4, 6, col);
    for (let j = T.y + 4; j <= T.y + 8; j += 2) c.p.hline(T.x - 6, T.x - 2, j, shade(col, 0.85));
    c.p.dots([[T.x - 7, T.y + 8], [T.x - 6, T.y + 9]], c.v.head === 'beak' ? accent(c) : shade(col, 0.8));
  },
  'wings-bat': (c) => {
    const { T } = geo(c);
    const col = shade(c.skin, 0.6);
    c.p.rect(T.x - 4, T.y, 4, 4, col);
    c.p.dots([[T.x - 5, T.y - 1], [T.x - 6, T.y - 2], [T.x - 5, T.y + 1], [T.x - 5, T.y + 3], [T.x - 4, T.y + 4], [T.x - 2, T.y + 4]], col);
    c.p.vline(T.x - 3, T.y, T.y + 3, shade(col, 0.7));
  },
  shadow: (c) => {
    const { T } = geo(c);
    const smoke = '#2b2140a8';
    c.p.dots([[T.x - 2, T.y + 3], [T.x - 3, T.y + 5], [T.x - 2, T.y + 7], [T.x - 4, T.y + 8], [T.x - 3, T.y + 10]], smoke);
    c.p.hline(c.f.backFoot.x - 2, c.f.frontFoot.x + c.f.frontFoot.w + 1, c.f.backFoot.y, smoke);
  },
  mane: (c) => {
    const { hx, hy } = geo(c);
    c.p.ellipse(hx + 4, hy + 5, 6, 7, accent(c));
    for (let j = hy; j < hy + 12; j += 3) c.p.set(hx - 2, j, shade(accent(c), 0.75));
  },
  frill: (c) => {
    const { hx, hy } = geo(c);
    c.p.rect(hx - 2, hy + 1, 4, 8, accent(c));
    for (let j = hy + 2; j < hy + 9; j += 2) c.p.hline(hx - 2, hx, j, shade(accent(c), 0.7));
  },
  'water-hair': (c) => {
    const { hx, hy, hh } = geo(c);
    c.p.rect(hx - 1, hy + 2, 5, hh + 2, shade(accent(c), 0.85));
    c.p.dots([[hx - 2, hy + 5], [hx - 2, hy + hh + 2], [hx, hy + hh + 4]], shade(accent(c), 1.3));
  },
};

const MID: Partial<Record<Part, Drawer>> = {
  shell: (c) => {
    const { T } = geo(c);
    const col = accent(c);
    c.p.ellipse(T.x - 1, T.y + T.h / 2, 3, T.h / 2 + 1, col);
    for (let j = T.y + 2; j < T.y + T.h; j += 3) c.p.hline(T.x - 3, T.x, j, shade(col, 0.7));
    c.p.vline(T.x + 1, T.y, T.y + T.h - 1, shade(col, 0.6));
  },
};

const SKIN: Partial<Record<Part, Drawer>> = {
  spots: (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 3, hy + 3], [hx + 5, hy + 6], [hx + 7, hy + 2], [hx + 2, hy + 7], [hx + 6, hy + 8]], shade(accent(c), 0.8));
  },
  stripes: (c) => {
    const { hx, hy } = geo(c);
    const col = shade(accent(c), 0.7);
    c.p.vline(hx + 3, hy + 2, hy + 4, col);
    c.p.vline(hx + 6, hy + 1, hy + 3, col);
    c.p.vline(hx + 2, hy + 6, hy + 8, col);
  },
};

const HEAD: Partial<Record<Part, Drawer>> = {
  'ears-elf': (c) => {
    const { hx, ey } = geo(c);
    const s = shade(c.skin, 0.92);
    c.p.rect(hx + 4, ey, 2, 3, s);
    c.p.dots([[hx + 3, ey - 1], [hx + 4, ey - 1], [hx + 2, ey - 2], [hx + 3, ey - 2], [hx + 1, ey - 3], [hx + 2, ey - 3], [hx + 1, ey - 4]], s);
    c.p.dots([[hx + 4, ey + 1], [hx + 3, ey - 1], [hx + 2, ey - 2]], shade(c.skin, 0.74));
  },
  'ears-elf-short': (c) => {
    const { hx, ey } = geo(c);
    c.p.rect(hx + 4, ey, 2, 3, shade(c.skin, 0.9));
    c.p.dots([[hx + 3, ey - 1], [hx + 4, ey - 1]], shade(c.skin, 0.9));
    c.p.set(hx + 4, ey + 1, shade(c.skin, 0.72));
  },
  'ears-swept': (c) => {
    const { hx, ey } = geo(c);
    const s = shade(c.skin, 0.9);
    c.p.rect(hx + 4, ey, 2, 3, s);
    c.p.dots([[hx + 3, ey], [hx + 2, ey], [hx + 1, ey - 1], [hx, ey - 1], [hx - 1, ey - 2]], s);
    c.p.set(hx + 4, ey + 1, shade(c.skin, 0.72));
  },
  'ears-gnome': (c) => {
    const { hx, ey } = geo(c);
    c.p.rect(hx + 3, ey - 1, 3, 4, shade(c.skin, 0.9));
    c.p.dots([[hx + 2, ey - 2], [hx + 2, ey - 1]], shade(c.skin, 0.9));
    c.p.set(hx + 4, ey + 1, shade(c.skin, 0.72));
  },
  'ears-cat': (c) => {
    const { hx, hy } = geo(c);
    const s = c.v.head === 'beak' ? shade(c.skin, 0.8) : c.skin;
    c.p.dots([[hx + 2, hy - 1], [hx + 3, hy - 1], [hx + 4, hy - 1], [hx + 3, hy - 2], [hx + 4, hy - 2], [hx + 4, hy - 3]], shade(s, 0.9));
    c.p.dots([[hx + 6, hy - 1], [hx + 7, hy - 1], [hx + 8, hy - 1], [hx + 7, hy - 2], [hx + 8, hy - 2], [hx + 8, hy - 3]], s);
    if (c.v.head !== 'beak') c.p.dots([[hx + 7, hy - 1], [hx + 3, hy - 1]], mix(c.skin, '#f0a0a0', 0.5));
  },
  'ears-rabbit': (c) => {
    const { hx, hy } = geo(c);
    c.p.rect(hx + 3, hy - 6, 2, 6, shade(c.skin, 0.88));
    c.p.rect(hx + 6, hy - 7, 2, 7, c.skin);
    c.p.vline(hx + 7, hy - 6, hy - 1, mix(c.skin, '#f0a0a0', 0.45));
  },
  'ears-mouse': (c) => {
    const { hx, hy } = geo(c);
    c.p.ellipse(hx + 3, hy, 2, 2, c.skin);
    c.p.ellipse(hx + 3, hy, 1, 1, mix(c.skin, '#f0a0a0', 0.5));
  },
  'ears-dog': (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 2, hy - 1], [hx + 3, hy - 1], [hx + 4, hy - 1], [hx + 3, hy - 2], [hx + 4, hy - 2], [hx + 3, hy - 3], [hx + 4, hy - 3], [hx + 4, hy - 4]], shade(c.skin, 0.85));
    c.p.dots([[hx + 7, hy - 1], [hx + 8, hy - 1], [hx + 8, hy - 2]], c.skin);
  },
  'ears-bear': (c) => {
    const { hx, hy } = geo(c);
    c.p.ellipse(hx + 3, hy, 1.5, 1.5, shade(c.skin, 0.85));
    c.p.ellipse(hx + 7, hy - 0.5, 1, 1, c.skin);
  },
  'ears-fox': (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 2, hy - 1], [hx + 3, hy - 1], [hx + 4, hy - 1], [hx + 5, hy - 1], [hx + 3, hy - 2], [hx + 4, hy - 2], [hx + 5, hy - 2], [hx + 4, hy - 3], [hx + 5, hy - 3], [hx + 5, hy - 4]], c.skin);
    c.p.set(hx + 5, hy - 4, INK);
    c.p.dots([[hx + 4, hy - 1], [hx + 4, hy - 2]], '#f2eee4');
  },
  'ears-floppy': (c) => {
    const { hx, ey } = geo(c);
    c.p.rect(hx + 3, ey - 2, 2, 5, shade(c.skin, 0.82));
    c.p.set(hx + 3, ey + 3, shade(c.skin, 0.82));
  },
  'horns-curved': (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 7, hy], [hx + 8, hy], [hx + 7, hy - 1], [hx + 6, hy - 1], [hx + 6, hy - 2], [hx + 5, hy - 2], [hx + 5, hy - 3], [hx + 4, hy - 3], [hx + 3, hy - 3], [hx + 2, hy - 2]], HORN);
    c.p.dots([[hx + 7, hy - 1], [hx + 6, hy - 2], [hx + 5, hy - 3]], HORN_LIGHT);
  },
  'horns-ram': (c) => {
    const { hx, hy } = geo(c);
    c.p.ellipse(hx + 4, hy + 1, 2.5, 2.5, HORN);
    c.p.dots([[hx + 5, hy - 1], [hx + 6, hy], [hx + 3, hy + 2]], HORN_LIGHT);
    c.p.set(hx + 4, hy + 1, shade(HORN, 0.7));
  },
  'horns-straight': (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 6, hy], [hx + 7, hy], [hx + 6, hy - 1], [hx + 7, hy - 1], [hx + 6, hy - 2], [hx + 7, hy - 2], [hx + 6, hy - 3], [hx + 6, hy - 4], [hx + 5, hy - 5]], HORN);
    c.p.dots([[hx + 7, hy - 1], [hx + 7, hy - 2], [hx + 6, hy - 4]], HORN_LIGHT);
  },
  'horns-back': (c) => {
    const { hx, hy } = geo(c);
    const col = c.v.head === 'reptile' ? BONE : HORN;
    c.p.dots([[hx + 6, hy], [hx + 5, hy], [hx + 5, hy - 1], [hx + 4, hy - 1], [hx + 3, hy - 1], [hx + 3, hy - 2], [hx + 2, hy - 2], [hx + 1, hy - 2], [hx, hy - 3]], col);
    c.p.dots([[hx + 4, hy - 1], [hx + 2, hy - 2]], c.v.head === 'reptile' ? shade(BONE, 0.8) : HORN_LIGHT);
  },
  'horns-nubs': (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 6, hy - 1], [hx + 7, hy - 1], [hx + 6, hy - 2]], HORN);
  },
  'horns-antlers': (c) => {
    const { hx, hy } = geo(c);
    const col = '#c9b48a';
    c.p.vline(hx + 5, hy - 5, hy - 1, col);
    c.p.dots([[hx + 4, hy - 3], [hx + 3, hy - 4], [hx + 6, hy - 4], [hx + 7, hy - 5], [hx + 4, hy - 6], [hx + 6, hy - 6], [hx + 2, hy - 5]], col);
  },
  'horns-bull': (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 6, hy], [hx + 7, hy], [hx + 8, hy], [hx + 9, hy - 1], [hx + 10, hy - 2], [hx + 4, hy], [hx + 3, hy], [hx + 2, hy - 1]], BONE);
    c.p.set(hx + 10, hy - 2, shade(BONE, 0.7));
  },
  halo: (c) => {
    const { hx, hy } = geo(c);
    const gold = '#f2d050';
    c.p.hline(hx + 3, hx + 8, hy - 4, gold);
    c.p.dots([[hx + 2, hy - 3], [hx + 9, hy - 3]], shade(gold, 0.85));
  },
  'beard-full': (c) => {
    const { hx, hy, hh, front, ey } = geo(c);
    const col = accent(c);
    c.p.rect(hx + 5, ey + 3, front - hx - 5, hy + hh - ey - 3, col);
    c.p.rect(hx + 6, hy + hh, front - hx - 7, 3, col);
    c.p.hline(hx + 8, front - 3, hy + hh + 3, shade(col, 0.8));
    c.p.rect(hx + 5, ey, 2, 3, col);
    c.p.hline(front - 4, front - 1, ey + 3, shade(col, 1.2));
  },
  'beard-braided': (c) => {
    const { hx, hy, hh, front, ey } = geo(c);
    const col = accent(c);
    c.p.rect(hx + 5, ey + 3, front - hx - 5, hy + hh - ey - 3, col);
    c.p.rect(hx + 6, ey, 1, 3, col);
    for (let j = hy + hh; j < hy + hh + 5; j++) c.p.hline(front - 4, front - 3, j, j % 2 ? col : shade(col, 0.75));
    c.p.hline(front - 4, front - 3, hy + hh + 5, '#e0c050');
  },
  'beard-short': (c) => {
    const { hx, hy, hh, front, ey } = geo(c);
    const col = accent(c);
    c.p.rect(hx + 6, ey + 3, front - hx - 6, hy + hh - ey - 3, col);
    c.p.hline(front - 4, front - 1, hy + hh, col);
  },
  sideburns: (c) => {
    const { hx, ey } = geo(c);
    c.p.rect(hx + 5, ey, 2, 4, accent(c));
  },
  crest: (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 3, hy - 1], [hx + 4, hy - 1], [hx + 5, hy - 1], [hx + 6, hy - 1], [hx + 2, hy - 2], [hx + 3, hy - 2], [hx + 4, hy - 2], [hx + 1, hy - 3], [hx + 2, hy - 3]], accent(c));
  },
  spines: (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 2, hy - 1], [hx + 1, hy], [hx, hy + 2], [hx - 1, hy + 3], [hx - 1, hy + 5], [hx - 2, hy + 6], [hx - 1, hy + 8]], accent(c));
  },
  antennae: (c) => {
    const { hx, hy } = geo(c);
    const col = shade(c.skin, 0.6);
    c.p.dots([[hx + 7, hy - 1], [hx + 8, hy - 2], [hx + 9, hy - 3], [hx + 5, hy - 1], [hx + 5, hy - 2], [hx + 6, hy - 3]], col);
    c.p.dots([[hx + 10, hy - 4], [hx + 7, hy - 4]], accent(c));
  },
  fins: (c) => {
    const { hx, hy, ey } = geo(c);
    const col = accent(c);
    if (c.v.head === 'fish') {
      for (let i = 0; i < 7; i++) c.p.vline(hx + 2 + i, hy - 1 - (i % 2), hy - 1, i % 2 ? col : shade(col, 0.8));
      return;
    }
    c.p.dots([[hx + 4, ey], [hx + 3, ey - 1], [hx + 2, ey - 2], [hx + 3, ey], [hx + 2, ey], [hx + 3, ey + 1], [hx + 4, ey + 1]], col);
    c.p.dots([[hx + 2, ey - 1], [hx + 1, ey]], shade(col, 0.75));
  },
  'flame-hair': (c) => {
    const { hx, hy, hw } = geo(c);
    const heights = [2, 4, 3, 6, 4, 5, 3, 4, 2];
    const base = accent(c);
    for (let i = 0; i < heights.length && hx + 1 + i < hx + hw - 1; i++) {
      for (let k = 0; k < heights[i]; k++) {
        const y = hy + 1 - k;
        c.p.set(hx + 1 + i, y, k >= heights[i] - 1 ? '#ffe08a' : k > 1 ? shade(base, 1.25) : base);
      }
    }
    c.p.rect(hx, hy + 1, 3, 4, base);
  },
  'water-hair': (c) => {
    const { hx, hy, hw } = geo(c);
    const col = accent(c);
    c.p.hline(hx + 2, hx + hw - 3, hy - 1, col);
    c.p.hline(hx + 1, hx + hw - 2, hy, col);
    c.p.hline(hx, hx + hw - 1, hy + 1, col);
    c.p.rect(hx, hy + 2, 4, 6, col);
    c.p.dots([[hx + 3, hy - 1], [hx + 6, hy], [hx + 2, hy + 4], [hx + 1, hy + 6]], shade(col, 1.35));
  },
  'stone-hair': (c) => {
    const { hx, hy } = geo(c);
    const col = accent(c);
    c.p.dots([[hx + 2, hy - 1], [hx + 3, hy - 1], [hx + 3, hy - 2], [hx + 3, hy - 3], [hx + 6, hy - 1], [hx + 6, hy - 2], [hx + 7, hy - 1], [hx + 7, hy - 2], [hx + 7, hy - 3], [hx + 7, hy - 4], [hx + 9, hy - 1], [hx + 9, hy - 2]], col);
    c.p.dots([[hx + 3, hy - 3], [hx + 7, hy - 4], [hx + 9, hy - 2]], shade(col, 1.45));
    c.p.rect(hx, hy + 1, 2, 3, shade(col, 0.85));
  },
  'air-hair': (c) => {
    const { hx, hy, hw } = geo(c);
    const col = `${accent(c)}c0`;
    c.p.hline(hx + 1, hx + hw - 2, hy, col);
    c.p.hline(hx, hx + hw - 2, hy + 1, col);
    c.p.dots([[hx + 2, hy - 2], [hx + 3, hy - 3], [hx + 5, hy - 2], [hx + 6, hy - 4], [hx + 8, hy - 2], [hx - 1, hy + 3], [hx - 2, hy + 5]], col);
  },
  'mushroom-cap': (c) => {
    const { hx, hy } = geo(c);
    const col = accent(c);
    c.p.ellipse(hx + 5.5, hy, 8, 3, col);
    c.p.hline(hx - 1, hx + 12, hy + 2, shade(col, 0.7));
    c.p.dots([[hx + 2, hy - 1], [hx + 6, hy - 2], [hx + 9, hy], [hx + 4, hy + 1]], '#f4f1ea');
  },
  leaves: (c) => {
    const { hx, hy } = geo(c);
    c.p.dots([[hx + 2, hy - 1], [hx + 3, hy - 2], [hx + 4, hy - 1], [hx + 7, hy - 1], [hx + 8, hy - 2], [hx + 9, hy - 1], [hx + 1, hy + 1]], '#5a9a3a');
    c.p.dots([[hx + 3, hy - 1], [hx + 8, hy - 1], [hx + 5, hy - 2]], '#3f7a2a');
  },
};

const FACE: Partial<Record<Part, Drawer>> = {
  freckles: (c) => {
    const { ex, ey } = geo(c);
    c.p.dots([[ex - 1, ey + 2], [ex + 1, ey + 2], [ex, ey + 3]], shade(c.skin, 0.75));
  },
  scar: (c) => {
    const { ex, ey } = geo(c);
    c.p.dots([[ex - 2, ey + 1], [ex - 1, ey + 2], [ex, ey + 3]], mix(c.skin, '#a04040', 0.55));
  },
  tattoo: (c) => {
    const { ex, ey, hy } = geo(c);
    const col = c.v.hair ? '#2e4a7a' : accent(c);
    c.p.dots([[ex - 2, ey + 2], [ex - 2, ey + 3], [ex - 3, ey + 3], [ex - 1, hy + 2], [ex, hy + 2]], col);
  },
  mark: (c) => {
    const { ex, hy } = geo(c);
    c.p.dots([[ex - 1, hy + 2], [ex, hy + 3], [ex - 1, hy + 3], [ex - 2, hy + 3]], '#8a3aa8');
  },
  gem: (c) => {
    const { ex, hy } = geo(c);
    c.p.dots([[ex, hy + 2], [ex + 1, hy + 2]], '#5ad0e0');
    c.p.set(ex, hy + 2, '#d6f6ff');
  },
  'third-eye': (c) => {
    const { ex, hy } = geo(c);
    c.p.dots([[ex - 1, hy + 2]], '#f4f1ea');
    c.p.set(ex, hy + 2, c.a.eyes);
  },
  plates: (c) => {
    const { hx, hy, hh, front, ex, ey } = geo(c);
    const line = shade(c.skin, 0.68);
    c.p.hline(hx + 1, front - 2, hy + 3, line);
    c.p.vline(hx + 6, hy + 3, hy + hh - 2, line);
    c.p.hline(ex, ex + 1, ey + 4, INK);
    const T = c.f.torso;
    c.p.hline(T.x, T.x + T.w - 1, c.f.waistY, shade(c.skin, 0.68));
  },
  visor: (c) => {
    const { ex, ey, front } = geo(c);
    c.p.rect(ex - 2, ey, front - ex + 2, 2, '#2b2b30');
    c.p.dots([[ex, ey], [ex + 1, ey]], shade(c.a.eyes, 1.3));
  },
  stitches: (c) => {
    const { ex, hy } = geo(c);
    const col = shade(c.skin, 0.5);
    for (let j = hy + 2; j <= hy + 7; j++) c.p.set(ex - 2, j, col);
    for (let j = hy + 3; j <= hy + 7; j += 2) c.p.dots([[ex - 3, j], [ex - 1, j]], col);
  },
  tusks: (c) => {
    const { front, ey } = geo(c);
    c.p.dots([[front - 2, ey + 4], [front - 2, ey + 3], [front - 1, ey + 2]], BONE);
  },
  fangs: (c) => {
    const { front, ex, ey } = geo(c);
    if (c.v.head === 'beast') c.p.set(front, ey + 5, BONE);
    else c.p.set(ex + 1, ey + 5, BONE);
  },
  whiskers: (c) => {
    const { front, ey } = geo(c);
    c.p.dots([[front + 3, ey + 3], [front + 4, ey + 3], [front + 4, ey + 2]], '#e8e2d0');
  },
  gills: (c) => {
    const { hx, ey } = geo(c);
    c.p.dots([[hx + 6, ey + 2], [hx + 7, ey + 3], [hx + 6, ey + 4]], shade(c.skin, 0.65));
  },
  'trunk-tusks': (c) => {
    const { front, ey } = geo(c);
    c.p.dots([[front, ey + 4], [front + 1, ey + 5], [front + 2, ey + 5]], BONE);
  },
};

const LAYERS: Record<Layer, Partial<Record<Part, Drawer>>> = { back: BACK, mid: MID, skin: SKIN, head: HEAD, face: FACE };

export function drawFeatures(c: DrawCtx, layer: Layer) {
  const table = LAYERS[layer];
  for (const part of c.parts) table[part]?.(c);
}
