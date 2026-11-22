/* Ten preset outfits, each with a primary (P) and a secondary (Q) colour.
   0 túnica · 1 jubón · 2 camisa y chaleco · 3 abrigo largo · 4 vestido · 5 corsé y falda ·
   6 blusa y pantalón · 7 capa corta · 8 armadura ligera · 9 túnica de mago.
   Any body may wear any outfit (character-appearance.md). */
import { mix, ramp, type Ramp } from '../color';
import { FOOT_Y, mx } from '../painter';
import { shadeSpan } from './body';
import type { DrawCtx } from './context';

const LEATHER = ramp('#7a4e2c');
const BOOT = ramp('#4e3427');
const DARK = ramp('#3a3644');
const METAL = ramp('#a9b2bd');
const GOLD = ramp('#e2b043');

/** Torso rows y1…y2 (grow widens them, e.g. for loose tunics). */
function torso(c: DrawCtx, r: Ramp, y1: number, y2: number, grow = 0) {
  for (let y = y1; y <= y2; y++) {
    const [x1, x2] = c.f.span(Math.min(y, c.f.torsoBottom));
    shadeSpan(c.p, y, x1 - grow, x2 + grow, r, y === y2 && y2 > c.f.waistY ? 1 : 0);
  }
}

/** Both sleeves from the shoulder, `rows` long (the hands are never covered). */
function sleeves(c: DrawCtx, r: Ramp, rows: number, cuff?: Ramp, puff = 0) {
  const { arm, handH } = c.f;
  const n = Math.min(rows, arm.h - handH);
  for (const right of [false, true]) {
    for (let j = 0; j < n; j++) {
      const y = arm.y + j;
      const grow = j < puff ? 1 : 0;
      const x1 = right ? mx(arm.x + arm.w - 1) : arm.x - grow;
      const x2 = right ? mx(arm.x) + grow : arm.x + arm.w - 1;
      const rr = cuff && j === n - 1 ? cuff : r;
      shadeSpan(c.p, y, x1, x2, rr, right ? 1 : 0);
    }
    // Rounded shoulder.
    c.p.clear(right ? mx(arm.x) + (puff ? 1 : 0) : arm.x - (puff ? 1 : 0), arm.y);
  }
}

/** Trousers: hips and both legs down to the ankle. */
function pants(c: DrawCtx, r: Ramp, fromY = c.f.waistY + 2) {
  const { leg } = c.f;
  torso(c, r, fromY, c.f.torsoBottom);
  for (const right of [false, true]) {
    const x = right ? mx(leg.x + leg.w - 1) : leg.x;
    for (let y = leg.y; y < leg.y + leg.h; y++) shadeSpan(c.p, y, x, x + leg.w - 1, r, right ? 1 : 0);
  }
}

/** Shoes, plus `height` rows of boot shaft over the leg. */
function boots(c: DrawCtx, r: Ramp, height: number) {
  const { leg } = c.f;
  for (const right of [false, true]) {
    const x = right ? mx(leg.x + leg.w - 1) : leg.x;
    for (let y = leg.y + leg.h - height; y < leg.y + leg.h; y++) shadeSpan(c.p, y, x, x + leg.w - 1, r, right ? 1 : 0);
    const fx = right ? x : x - 1;
    shadeSpan(c.p, FOOT_Y - 1, fx, fx + leg.w, r, right ? 1 : 0);
    shadeSpan(c.p, FOOT_Y, fx, fx + leg.w, r, 1);
    if (height > 2) c.p.hline(x, x + leg.w - 1, leg.y + leg.h - height, r.light);
  }
}

/** Skirt or coat tail from y1 to y2, flaring out; vertical folds every few columns. */
function skirt(c: DrawCtx, r: Ramp, y1: number, y2: number, flare: number, hem?: Ramp) {
  const [hx1, hx2] = c.f.span(c.f.torsoBottom);
  for (let y = y1; y <= y2; y++) {
    const t = (y - y1) / Math.max(1, y2 - y1);
    const g = Math.round(t * flare);
    const x1 = hx1 - g;
    const x2 = hx2 + g;
    const rr = hem && y >= y2 - 1 ? hem : r;
    shadeSpan(c.p, y, x1, x2, rr, y === y2 && !hem ? 1 : 0);
    for (let x = x1 + 3; x < x2 - 1; x += 4) if (y > y1 + 1) c.p.set(x, y, rr.shadow);
  }
}

function belt(c: DrawCtx, y: number, r: Ramp = LEATHER, buckle = true) {
  const [x1, x2] = c.f.span(y);
  shadeSpan(c.p, y, x1, x2, r, 0);
  if (buckle) { c.p.hline(23, 24, y, GOLD.base); c.p.set(23, y, GOLD.hi); }
}

/** V neckline showing skin, with a trim in r. */
function vNeck(c: DrawCtx, trim: Ramp, depth = 2) {
  const { p, f, skin } = c;
  for (let j = 0; j < depth; j++) {
    const hw = depth - j;
    p.hline(24 - hw, 23 + hw, f.torsoTop + j, j === depth - 1 ? skin.shadow : skin.base);
    p.set(23 - hw, f.torsoTop + j, trim.base);
    p.set(24 + hw, f.torsoTop + j, trim.shadow);
  }
  p.hline(23, 24, f.torsoTop + depth, trim.base);
}

/** Bare forearm rows are already skin; this darkens the arm edge next to the torso. */
function armContour(c: DrawCtx) {
  const { p, f } = c;
  const { arm } = f;
  const inner = arm.x + arm.w - 1;
  for (let y = arm.y + 1; y < arm.y + arm.h; y++) {
    for (const x of [inner, mx(inner)]) {
      const col = p.get(x, y);
      if (col) p.set(x, y, mix(col.slice(0, 7), '#140c18', 0.45));
    }
  }
}

interface Outfit {
  /** Behind the body (capes). */
  back?: (c: DrawCtx, P: Ramp, Q: Ramp) => void;
  body: (c: DrawCtx, P: Ramp, Q: Ramp) => void;
}

const OUTFITS: Outfit[] = [
  { // 0 Túnica: belted tunic over trousers.
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, ramp(mix(Q.base, '#2b2b30', 0.55)));
      boots(c, BOOT, 3);
      torso(c, P, f.torsoTop, f.torsoBottom);
      skirt(c, P, f.torsoBottom + 1, f.torsoBottom + 3, 1);
      c.p.hline(f.span(f.torsoBottom)[0] - 1, f.span(f.torsoBottom)[1] + 1, f.torsoBottom + 3, Q.base);
      sleeves(c, P, 99, Q);
      vNeck(c, Q, 3);
      belt(c, f.waistY + 1);
    },
  },
  { // 1 Jubón: doublet with puffed, slashed shoulders and buttons.
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, ramp(shadeHex(Q.base, 0.75)));
      boots(c, DARK, 5);
      torso(c, P, f.torsoTop, f.torsoBottom - 1);
      c.p.hline(f.span(f.torsoTop)[0], f.span(f.torsoTop)[1], f.torsoTop, Q.light);
      torso(c, Q, f.torsoBottom - 1, f.torsoBottom - 1);
      for (let y = f.torsoTop + 2; y < f.torsoBottom - 1; y += 2) c.p.set(23, y, GOLD.light);
      c.p.vline(24, f.torsoTop + 1, f.torsoBottom - 2, P.shadow);
      sleeves(c, P, 99, Q);
      sleeves(c, Q, 3, undefined, 3);
      for (const x of [f.arm.x, mx(f.arm.x)]) c.p.vline(x + 1, f.arm.y, f.arm.y + 2, P.base);
    },
  },
  { // 2 Camisa y chaleco: rolled-up shirt, open vest and a neckerchief.
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, ramp('#5a4636'));
      boots(c, BOOT, 3);
      torso(c, Q, f.torsoTop, f.torsoBottom);
      for (let y = f.torsoTop; y <= f.torsoBottom; y++) {
        const [x1, x2] = f.span(y);
        const open = y < f.torsoTop + 3 ? 2 : 1;
        shadeSpan(c.p, y, x1, 23 - open, P, 0);
        shadeSpan(c.p, y, 24 + open, x2, P, 1);
      }
      sleeves(c, Q, Math.ceil((f.arm.h - f.handH) * 0.55), ramp(shadeHex(Q.base, 0.85)));
      c.p.stamp(21, f.torsoTop, ['lbbbbs', '.lbbs.', '..bs..'], { l: P.light, b: P.base, s: P.shadow });
      belt(c, f.waistY + 2, LEATHER, false);
    },
  },
  { // 3 Abrigo largo: long open coat with lapels and cuffs.
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, DARK);
      boots(c, DARK, 5);
      torso(c, P, f.torsoTop, f.torsoBottom);
      const knee = f.leg.y + Math.round(f.leg.h * 0.6);
      skirt(c, P, f.torsoBottom + 1, knee, 2);
      for (let y = f.waistY + 1; y <= knee; y++) c.p.hline(23, 24, y, y > f.torsoBottom ? DARK.shadow : Q.shadow);
      c.p.stamp(19, f.torsoTop, ['.bbs..sbb.', '..bbsbbs..', '...bss....', '....bs....'], { b: Q.base, s: Q.shadow });
      for (let y = f.torsoTop + 4; y <= f.waistY; y += 2) c.p.set(22, y, GOLD.base);
      sleeves(c, P, 99, Q);
    },
  },
  { // 4 Vestido: fitted bodice, sash and a long flared skirt.
    body: (c, P, Q) => {
      const f = c.f;
      boots(c, ramp(shadeHex(Q.base, 0.6)), 0);
      torso(c, P, f.torsoTop, f.waistY);
      c.p.hline(f.span(f.torsoTop)[0], f.span(f.torsoTop)[1], f.torsoTop, P.light);
      torso(c, Q, f.waistY + 1, f.waistY + 2);
      c.p.stamp(21, f.waistY, ['ll..ss', '.lbbs.', 'lb..bs'], { l: Q.light, b: Q.base, s: Q.shadow });
      skirt(c, P, f.waistY + 3, FOOT_Y - 2, 4, Q);
      sleeves(c, Q, 3, undefined, 3);
    },
  },
  { // 5 Corsé y falda: blouse, laced corset and knee skirt.
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, DARK);
      boots(c, LEATHER, 4);
      torso(c, Q, f.torsoTop, f.torsoBottom);
      const top = f.torsoTop + 3;
      torso(c, P, top, f.torsoBottom);
      for (let y = top + 1; y <= f.torsoBottom - 1; y++) c.p.set(y % 2 ? 23 : 24, y, Q.light);
      c.p.hline(f.span(top)[0], f.span(top)[1], top, P.light);
      const knee = f.leg.y + Math.round(f.leg.h * 0.5);
      skirt(c, P, f.torsoBottom + 1, knee, 3, ramp(shadeHex(P.base, 0.7)));
      sleeves(c, Q, 99, undefined, 2);
    },
  },
  { // 6 Blusa y pantalón: loose blouse with a knotted sash.
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, Q);
      boots(c, LEATHER, 3);
      torso(c, P, f.torsoTop, f.torsoBottom - 1, 0);
      c.p.stamp(22, f.torsoTop, ['l..s', '.ls.'], { l: P.shadow, s: P.deep });
      const sash = ramp(shadeHex(Q.base, 1.25));
      torso(c, sash, f.waistY + 1, f.waistY + 2);
      c.p.stamp(25, f.waistY + 1, ['bs', 'bs', '.b', '.s'], { b: sash.base, s: sash.shadow });
      sleeves(c, P, 99, undefined);
      for (const right of [false, true]) {
        const y = f.arm.y + f.arm.h - f.handH - 1;
        const x = right ? mx(f.arm.x) + 1 : f.arm.x - 1;
        c.p.set(x, y, right ? P.shadow : P.light);
      }
    },
  },
  { // 7 Capa corta: shirt, shoulder mantle and a cape that flutters to one side.
    back: (c, _P, Q) => {
      const { p, f } = c;
      const bottom = f.leg.y + Math.round(f.leg.h * 0.7);
      const [x1, x2] = f.span(f.torsoTop);
      for (let y = f.torsoTop + 1; y <= bottom + 2; y++) {
        const t = (y - f.torsoTop) / (bottom - f.torsoTop);
        // Billows to the viewer's left; the hem is cut in soft points.
        const left = x1 - 3 - Math.round(Math.pow(t, 1.3) * 5);
        const right = x2 + 3 + Math.round(t * 1.5);
        for (let x = left; x <= right; x++) {
          const hem = bottom + Math.round(Math.abs(Math.sin((x - left) / 2.3)) * 2) - (x < 20 ? 0 : 1);
          if (y > hem) continue;
          const fold = (x - left) % 4 === 2;
          const k = y >= hem - 1 ? Q.deep : x === left ? Q.base : fold ? Q.deep : x > right - 2 ? Q.deep : Q.shadow;
          p.set(x, y, k);
        }
      }
    },
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, ramp(shadeHex(P.base, 0.45)));
      boots(c, ramp(shadeHex(Q.base, 0.55)), 4);
      torso(c, P, f.torsoTop, f.torsoBottom);
      belt(c, f.waistY + 1);
      sleeves(c, P, 99, undefined);
      // Mantle over the shoulders.
      const [x1, x2] = f.span(f.torsoTop + 1);
      for (let j = 0; j < 3; j++) shadeSpan(c.p, f.torsoTop + j, x1 - f.arm.w - (j === 0 ? 0 : 1) + j, x2 + f.arm.w + (j === 0 ? 0 : 1) - j, Q, 0);
      c.p.hline(x1 - f.arm.w + 2, x2 + f.arm.w - 2, f.torsoTop + 3, Q.shadow);
      c.p.stamp(22, f.torsoTop + 1, ['hb', 'bs'], { h: GOLD.hi, b: GOLD.base, s: GOLD.shadow });
    },
  },
  { // 8 Armadura ligera: padded coat, breastplate, pauldrons, bracers, greaves and a tabard.
    body: (c, P, Q) => {
      const f = c.f;
      pants(c, ramp(shadeHex(P.base, 0.6)));
      boots(c, METAL, 5);
      torso(c, P, f.torsoTop, f.torsoBottom);
      for (let y = f.torsoTop + 1; y <= f.waistY; y++) {
        const [x1, x2] = f.span(y);
        shadeSpan(c.p, y, x1 + 1, x2 - 1, METAL, y === f.waistY ? 1 : 0);
      }
      c.p.set(20, f.torsoTop + 2, METAL.hi);
      c.p.set(21, f.torsoTop + 3, METAL.hi);
      belt(c, f.waistY + 1);
      const tabEnd = f.leg.y + Math.round(f.leg.h * 0.45);
      for (let y = f.waistY + 2; y <= tabEnd; y++) shadeSpan(c.p, y, 21, 26, Q, y === tabEnd ? 1 : 0);
      sleeves(c, P, 99, undefined);
      sleeves(c, METAL, 3, undefined, 3);
      const { arm, handH } = f;
      const by = arm.y + arm.h - handH - 3;
      for (const right of [false, true]) {
        const x = right ? mx(arm.x + arm.w - 1) : arm.x;
        for (let y = by; y < by + 3; y++) shadeSpan(c.p, y, x, x + arm.w - 1, METAL, right ? 1 : 0);
      }
    },
  },
  { // 9 Túnica de mago: long robe with a trim, bell sleeves and a rope belt.
    body: (c, P, Q) => {
      const f = c.f;
      boots(c, DARK, 0);
      torso(c, P, f.torsoTop, f.torsoBottom);
      skirt(c, P, f.torsoBottom + 1, FOOT_Y - 1, 3);
      for (let y = f.torsoTop + 1; y <= FOOT_Y - 1; y++) c.p.hline(23, 24, y, y % 2 ? Q.base : Q.light);
      const [hx1, hx2] = f.span(f.torsoBottom);
      c.p.hline(hx1 - 3, hx2 + 3, FOOT_Y - 1, Q.shadow);
      // Hood resting on the shoulders.
      const [x1, x2] = f.span(f.torsoTop);
      c.p.hline(x1 - 1, x2 + 1, f.torsoTop, P.shadow);
      c.p.hline(x1, x2, f.torsoTop + 1, P.deep);
      c.p.hline(22, 25, f.torsoTop, c.skin.shadow);
      sleeves(c, P, 99, undefined);
      const { arm, handH } = f;
      const cy = arm.y + arm.h - handH - 2;
      for (const right of [false, true]) {
        const x = right ? mx(arm.x + arm.w - 1) : arm.x;
        shadeSpan(c.p, cy, x - (right ? 0 : 1), x + arm.w - (right ? 0 : 1), P, right ? 1 : 0);
        shadeSpan(c.p, cy + 1, x - (right ? 0 : 1), x + arm.w - (right ? 0 : 1), Q, right ? 1 : 0);
      }
      belt(c, f.waistY + 1, GOLD, false);
      c.p.dots([[25, f.waistY + 2], [25, f.waistY + 3], [26, f.waistY + 4]], GOLD.shadow);
      for (const [x, y] of [[19, 3], [28, 5], [20, 8], [27, 10]]) c.p.set(x, f.torsoBottom + y, P.light);
    },
  },
];

function shadeHex(hex: string, k: number) {
  return k <= 1 ? mix('#000000', hex, k) : mix(hex, '#ffffff', Math.min(1, k - 1));
}

const outfitOf = (c: DrawCtx) => OUTFITS[Math.max(0, Math.min(OUTFITS.length - 1, c.a.outfit))];

export function drawOutfitBack(c: DrawCtx) {
  c.p.tag = 'cloth';
  outfitOf(c).back?.(c, c.cloth[0], c.cloth[1]);
  c.p.tag = null;
}

export function drawOutfitBody(c: DrawCtx) {
  c.p.tag = 'cloth';
  outfitOf(c).body(c, c.cloth[0], c.cloth[1]);
  armContour(c);
  c.p.tag = null;
}
