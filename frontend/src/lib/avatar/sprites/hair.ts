/* Twelve stylised hair styles (0 bald … 11 wavy). Any body may wear any of them.
   Hair = a crown dome over the skull + pointed locks (bangs, side locks, spikes) + an optional
   back layer behind the body. Each lock is shaded on its own (lit left edge, dark right edge and
   tip), which gives the layered, strand-separated look of the art direction. */
import { mix, type Ramp } from '../color';
import { mx } from '../painter';
import type { DrawCtx } from './context';

interface Lock {
  /** Left column of the lock base. */
  x: number;
  /** Row offset of the base from the skull top. */
  y: number;
  len: number;
  /** Width at the base. */
  w: number;
  /** Horizontal drift of the tip. */
  lean?: number;
  /** Grows upwards (spikes) instead of hanging down. */
  up?: boolean;
  /** Sideways wave amplitude (wavy hair). */
  wave?: number;
  /** Extra darkness (back locks). */
  bias?: number;
  /** Keeps the width until this fraction of the length (blunt locks). */
  hold?: number;
  /** Starts narrow at a tie, swells, then tapers (tails). */
  bulge?: boolean;
}

const mirrorLock = (l: Lock): Lock => ({ ...l, x: mx(l.x + l.w - 1), lean: -(l.lean ?? 0) });
const both = (...locks: Lock[]) => locks.flatMap((l) => [l, mirrorLock(l)]);

function tone(r: Ramp, k: number) {
  return k >= 2 ? r.hi : k === 1 ? r.light : k === 0 ? r.base : k === -1 ? r.shadow : r.deep;
}

function drawLock(c: DrawCtx, l: Lock) {
  const { p, f, hair } = c;
  const lean = l.lean ?? 0;
  const hold = l.hold ?? 0;
  for (let t = 0; t < l.len; t++) {
    const frac = t / l.len;
    const taper = l.bulge
      ? (frac < 0.3 ? 0.45 + (frac / 0.3) * 0.55 : 1 - (frac - 0.3) / 0.7)
      : frac <= hold ? 1 : 1 - (frac - hold) / (1 - hold);
    const wt = Math.max(1, Math.round(l.w * taper));
    const drift = Math.round(lean * Math.pow(frac, 1.4) + (l.wave ? Math.sin(t / 2.2) * l.wave : 0));
    const x0 = l.x + drift + Math.floor((l.w - wt) / 2);
    const y = l.up ? f.hy + l.y - t : f.hy + l.y + t;
    for (let i = 0; i < wt; i++) {
      let k = 0;
      if (wt >= 3 && i === 0) k = 1;
      if (wt >= 2 && i === wt - 1) k = -1;
      if (t >= l.len - 2 && !(wt >= 2 && i === 0)) k = Math.min(k, -1);
      if (l.up && t >= l.len - 2 && i === 0) k = 1;
      p.set(x0 + i, y, tone(hair, k - (l.bias ?? 0)));
    }
  }
}

interface DomeOpts {
  /** Rows above the skull top. */
  top: number;
  /** Extra half width over the skull (2 = two pixels of volume each side). */
  pad: number;
  /** Last row offset (from the skull top) at the sides and in the middle. */
  side: number;
  mid: number;
  /** Shine streak on the crown. */
  shine?: boolean;
}

/** Crown dome: covers the skull, lit from the top left, with a highlight streak. */
function dome(c: DrawCtx, o: DomeOpts) {
  const { p, f, hair } = c;
  const cx = 23.5;
  const rx = 10 + o.pad;
  const top = f.hy - o.top;
  const cy = f.hy + 7;
  const ry = cy - top;
  for (let x = Math.ceil(cx - rx - 0.5); x <= Math.floor(cx + rx + 0.5); x++) {
    const nx = (x - cx) / (rx + 0.5);
    if (Math.abs(nx) > 1) continue;
    const yTop = Math.round(cy - ry * Math.sqrt(1 - nx * nx));
    const bottom = f.hy + Math.round(o.mid + (o.side - o.mid) * Math.min(1, Math.abs(nx) * 1.15));
    for (let y = yTop; y <= bottom; y++) {
      let k = 0;
      if (y === yTop) k = nx < 0.35 ? 1 : 0;
      if (nx < -0.82) k = 1;
      if (nx > 0.72) k = -1;
      if (nx > 0.9) k = -2;
      p.set(x, y, tone(hair, k));
    }
    // Highlight streak two rows under the outline, on the lit half, with gaps between strands.
    if (o.shine !== false && nx > -0.75 && nx < 0.25 && (x % 4 !== 1)) {
      p.set(x, yTop + 2, hair.hi);
      if (nx > -0.5 && nx < 0.05 && x % 4 === 3) p.set(x, yTop + 3, hair.light);
    }
  }
}

/** Dark strand lines that run from the crown towards the bangs. */
function strands(c: DrawCtx, lines: [number, number, number, number][]) {
  const { p, f, hair } = c;
  for (const [x1, y1, x2, y2] of lines) {
    const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= n; i++) {
      p.set(Math.round(x1 + ((x2 - x1) * i) / n), f.hy + Math.round(y1 + ((y2 - y1) * i) / n), hair.shadow);
    }
  }
}

/** Hair mass behind the head and shoulders, ending in points. */
function backMass(c: DrawCtx, halfW: number, bottom: number, tipLen = 3, wave = 0) {
  const { p, f, hair } = c;
  const top = f.hy + 3;
  const end = f.hy + bottom;
  for (let x = 24 - halfW; x <= 23 + halfW; x++) {
    const col = x - (24 - halfW);
    const tip = Math.abs(((col + 2) % 4) - 2) * Math.round(tipLen / 2);
    const wv = wave ? Math.round(Math.sin(col / 1.7) * wave) : 0;
    for (let y = top; y <= end - tip + wv; y++) {
      const edge = x === 24 - halfW ? 0 : x >= 22 + halfW ? -2 : (col % 4 === 3 ? -2 : -1);
      p.set(x, y, tone(hair, y >= end - tip + wv - 1 ? -2 : edge));
    }
  }
}

/** Hair tie in the outfit's second colour. */
function tie(c: DrawCtx, x: number, y: number, w = 3, h = 2) {
  const r = c.cloth[1];
  c.p.rect(x, c.f.hy + y, w, h, r.base);
  c.p.set(x, c.f.hy + y, r.light);
  c.p.vline(x + w - 1, c.f.hy + y, c.f.hy + y + h - 1, r.shadow);
}

function braid(c: DrawCtx, x: number, y1: number, y2: number) {
  const { p, f, hair } = c;
  for (let y = y1; y <= y2; y++) {
    const k = (y - y1) % 3;
    const row = k === 0 ? [1, 0, -1, -2] : k === 1 ? [0, 0, -1, -2] : [-1, 1, 0, -2];
    row.forEach((t, i) => p.set(x + i, f.hy + y, tone(hair, t)));
  }
}

const SHORT_SIDES = both({ x: 12, y: 4, len: 8, w: 4, lean: 0 });

interface Style {
  back?: (c: DrawCtx) => void;
  front: (c: DrawCtx) => void;
}

const STYLES: Record<number, Style> = {
  // 1 Corto: tousled short hair, sides over the ears.
  1: {
    front: (c) => {
      dome(c, { top: 4, pad: 2, side: 7, mid: 4 });
      [
        ...SHORT_SIDES,
        { x: 15, y: 3, len: 7, w: 5, lean: -1 },
        { x: 19, y: 3, len: 6, w: 5, lean: 1 },
        { x: 23, y: 2, len: 7, w: 5, lean: 2 },
        { x: 28, y: 3, len: 6, w: 5, lean: 2 },
        { x: 18, y: -3, len: 3, w: 4, lean: -3, up: true },
        { x: 25, y: -3, len: 3, w: 4, lean: 2, up: true },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[19, -2, 17, 3], [26, -2, 27, 3]]);
    },
  },
  // 2 Puntas: big spikes all round.
  2: {
    front: (c) => {
      dome(c, { top: 3, pad: 2, side: 7, mid: 4, shine: false });
      [
        { x: 11, y: 4, len: 6, w: 4, lean: -4, up: true },
        { x: 13, y: 0, len: 6, w: 5, lean: -4, up: true },
        { x: 17, y: -2, len: 7, w: 5, lean: -2, up: true },
        { x: 21, y: -3, len: 8, w: 5, lean: 0, up: true },
        { x: 26, y: -2, len: 7, w: 5, lean: 3, up: true },
        { x: 30, y: 0, len: 6, w: 5, lean: 4, up: true },
        { x: 33, y: 4, len: 6, w: 4, lean: 4, up: true },
        { x: 12, y: 4, len: 8, w: 4, lean: -1 },
        { x: 32, y: 4, len: 8, w: 4, lean: 1 },
        { x: 15, y: 3, len: 8, w: 5, lean: -1 },
        { x: 19, y: 3, len: 9, w: 5, lean: 1 },
        { x: 24, y: 3, len: 8, w: 5, lean: 2 },
        { x: 28, y: 3, len: 7, w: 5, lean: 2 },
      ].forEach((l) => drawLock(c, l));
      c.p.dots([[19, c.f.hy - 1], [20, c.f.hy - 2], [23, c.f.hy - 4], [23, c.f.hy - 3], [24, c.f.hy - 5]], c.hair.hi);
    },
  },
  // 3 Coleta: high ponytail falling to one side.
  3: {
    back: (c) => {
      drawLock(c, { x: 31, y: -2, len: 26, w: 7, lean: 7, bulge: true, wave: 0.5 });
      tie(c, 30, -3, 4, 2);
    },
    front: (c) => {
      dome(c, { top: 3, pad: 2, side: 7, mid: 3 });
      [
        { x: 12, y: 4, len: 10, w: 4, lean: -1 },
        { x: 32, y: 4, len: 7, w: 4, lean: 1 },
        { x: 15, y: 3, len: 7, w: 6, lean: -2 },
        { x: 20, y: 2, len: 6, w: 7, lean: 4 },
        { x: 26, y: 2, len: 6, w: 6, lean: 3 },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[22, -2, 19, 3], [27, -2, 28, 2]]);
    },
  },
  // 4 Cresta: shaved sides and a tall crest.
  4: {
    front: (c) => {
      const { p, f, hair, skin } = c;
      const stubble = mix(skin.base, hair.base, 0.45);
      for (let y = f.hy; y <= f.hy + 7; y++) {
        for (let x = 14; x <= 33; x++) if (p.tagAt(x, y) === 'skin') p.set(x, y, (x + y) % 3 ? stubble : mix(stubble, hair.deep, 0.3));
      }
      p.tag = 'hair';
      p.rect(20, f.hy - 1, 8, 4, hair.base);
      p.vline(20, f.hy - 1, f.hy + 2, hair.light);
      p.vline(27, f.hy - 1, f.hy + 2, hair.shadow);
      [
        { x: 18, y: 1, len: 6, w: 4, lean: -3, up: true },
        { x: 20, y: 0, len: 8, w: 4, lean: -2, up: true },
        { x: 22, y: 0, len: 10, w: 4, lean: 0, up: true },
        { x: 25, y: 0, len: 8, w: 4, lean: 2, up: true },
        { x: 27, y: 1, len: 6, w: 3, lean: 3, up: true },
        { x: 21, y: 2, len: 5, w: 5, lean: -1 },
      ].forEach((l) => drawLock(c, l));
      p.dots([[22, f.hy - 4], [22, f.hy - 5], [23, f.hy - 7], [21, f.hy - 2]], hair.hi);
    },
  },
  // 5 Largo: long straight hair with curtain bangs.
  5: {
    back: (c) => backMass(c, 12, 30, 3),
    front: (c) => {
      dome(c, { top: 3, pad: 2, side: 8, mid: 3 });
      [
        { x: 11, y: 4, len: 26, w: 5, lean: 0, hold: 0.6 },
        { x: 32, y: 4, len: 26, w: 5, lean: 0, hold: 0.6, bias: 1 },
        { x: 14, y: 3, len: 9, w: 5, lean: -1 },
        { x: 17, y: 2, len: 7, w: 6, lean: -3 },
        { x: 25, y: 2, len: 7, w: 6, lean: 3 },
        { x: 29, y: 3, len: 9, w: 5, lean: 1 },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[23, -2, 22, 3], [24, -2, 25, 3], [16, 1, 14, 8], [31, 1, 33, 8]]);
    },
  },
  // 6 Trenza: side braid over the shoulder.
  6: {
    back: (c) => backMass(c, 11, 14, 3),
    front: (c) => {
      dome(c, { top: 3, pad: 2, side: 8, mid: 4 });
      braid(c, 12, 9, 27);
      tie(c, 12, 28, 4, 2);
      drawLock(c, { x: 12, y: 30, len: 4, w: 4, lean: -1 });
      [
        { x: 12, y: 4, len: 7, w: 4, lean: 0 },
        { x: 32, y: 4, len: 9, w: 4, lean: 1 },
        { x: 15, y: 3, len: 7, w: 6, lean: 3 },
        { x: 20, y: 2, len: 7, w: 6, lean: 4 },
        { x: 26, y: 3, len: 6, w: 5, lean: 3 },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[19, -2, 16, 3], [25, -2, 26, 3]]);
    },
  },
  // 7 Moño: top bun, forehead free, two face-framing strands.
  7: {
    front: (c) => {
      const { p, f, hair } = c;
      dome(c, { top: 2, pad: 1, side: 6, mid: 2 });
      p.tag = 'hair';
      p.ellipse(23.5, f.hy - 5, 4.2, 3.2, hair.base);
      p.ellipse(22.5, f.hy - 6, 2.2, 1.4, hair.light);
      p.dots([[21, f.hy - 7], [22, f.hy - 7]], hair.hi);
      p.hline(25, 27, f.hy - 3, hair.shadow);
      p.dots([[27, f.hy - 4], [27, f.hy - 5]], hair.shadow);
      tie(c, 20, -2, 8, 1);
      [
        { x: 13, y: 4, len: 11, w: 3, lean: 1, wave: 0.6 },
        { x: 32, y: 4, len: 11, w: 3, lean: -1, wave: 0.6 },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[18, 0, 16, 4], [23, -1, 23, 2], [28, 0, 30, 4]]);
    },
  },
  // 8 Melena: wild layered mane with spikes in every direction.
  8: {
    back: (c) => {
      backMass(c, 13, 22, 4);
      [
        { x: 8, y: 8, len: 16, w: 5, lean: -5, bias: 1 },
        { x: 35, y: 8, len: 16, w: 5, lean: 5, bias: 1 },
        { x: 9, y: 16, len: 12, w: 5, lean: -3, bias: 1 },
        { x: 34, y: 16, len: 12, w: 5, lean: 3, bias: 1 },
      ].forEach((l) => drawLock(c, l));
    },
    front: (c) => {
      dome(c, { top: 5, pad: 3, side: 9, mid: 4 });
      [
        { x: 13, y: -1, len: 5, w: 5, lean: -4, up: true },
        { x: 18, y: -4, len: 4, w: 5, lean: -2, up: true },
        { x: 25, y: -4, len: 4, w: 5, lean: 2, up: true },
        { x: 30, y: -1, len: 5, w: 5, lean: 4, up: true },
        { x: 10, y: 5, len: 12, w: 5, lean: -3 },
        { x: 33, y: 5, len: 12, w: 5, lean: 3 },
        { x: 12, y: 5, len: 14, w: 4, lean: 0 },
        { x: 32, y: 5, len: 14, w: 4, lean: 0, bias: 1 },
        { x: 14, y: 3, len: 9, w: 5, lean: -2 },
        { x: 18, y: 3, len: 10, w: 5, lean: 0 },
        { x: 22, y: 3, len: 9, w: 5, lean: 2 },
        { x: 26, y: 3, len: 10, w: 5, lean: 2 },
        { x: 30, y: 3, len: 9, w: 4, lean: 2 },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[17, -3, 15, 3], [23, -4, 22, 3], [28, -3, 30, 3]]);
    },
  },
  // 9 Media melena: rounded bob with straight-cut bangs.
  9: {
    back: (c) => backMass(c, 12, 18, 1),
    front: (c) => {
      dome(c, { top: 4, pad: 2, side: 8, mid: 4 });
      [
        { x: 11, y: 4, len: 15, w: 5, lean: 1, hold: 0.55 },
        { x: 32, y: 4, len: 15, w: 5, lean: -1, hold: 0.55, bias: 1 },
        ...[15, 18, 21, 24, 27, 30].map((x): Lock => ({ x, y: 3, len: 6, w: 4, lean: 0, hold: 0.5 })),
      ].forEach((l) => drawLock(c, l));
      strands(c, [[20, -3, 18, 3], [27, -3, 29, 3]]);
    },
  },
  // 10 Dos coletas: twin tails tied high at the sides.
  10: {
    back: (c) => {
      drawLock(c, { x: 8, y: 4, len: 22, w: 6, lean: -2, bulge: true, wave: 0.6 });
      drawLock(c, { x: 34, y: 4, len: 22, w: 6, lean: 2, bulge: true, wave: 0.6, bias: 1 });
    },
    front: (c) => {
      dome(c, { top: 3, pad: 2, side: 7, mid: 4 });
      tie(c, 10, 3, 3, 3);
      tie(c, 35, 3, 3, 3);
      [
        { x: 12, y: 4, len: 9, w: 4, lean: -1 },
        { x: 32, y: 4, len: 9, w: 4, lean: 1 },
        { x: 15, y: 3, len: 7, w: 5, lean: 0 },
        { x: 19, y: 3, len: 7, w: 5, lean: 1 },
        { x: 23, y: 3, len: 6, w: 5, lean: 1 },
        { x: 27, y: 3, len: 7, w: 5, lean: 1 },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[20, -2, 18, 3], [27, -2, 28, 3]]);
    },
  },
  // 11 Ondas: long wavy hair with a side parting.
  11: {
    back: (c) => backMass(c, 13, 30, 4, 1),
    front: (c) => {
      dome(c, { top: 4, pad: 2, side: 8, mid: 3 });
      [
        { x: 11, y: 4, len: 27, w: 6, lean: 1, hold: 0.55, wave: 1 },
        { x: 31, y: 4, len: 27, w: 6, lean: -1, hold: 0.55, wave: 1, bias: 1 },
        { x: 13, y: 3, len: 8, w: 5, lean: -2 },
        { x: 18, y: 2, len: 9, w: 9, lean: 7, hold: 0.2 },
        { x: 25, y: 3, len: 9, w: 6, lean: 5 },
      ].forEach((l) => drawLock(c, l));
      strands(c, [[19, -3, 17, 2], [20, -3, 21, 3]]);
    },
  },
};

const hasStyle = (c: DrawCtx) => c.a.hair > 0 && STYLES[c.a.hair] !== undefined;

/** Layer behind the body (long hair, tails). */
export function drawHairBack(c: DrawCtx) {
  if (!hasStyle(c)) return;
  c.p.tag = 'hair-back';
  STYLES[c.a.hair].back?.(c);
  c.p.tag = null;
}

/** Crown, bangs and front locks, over the face. */
export function drawHairFront(c: DrawCtx) {
  if (!hasStyle(c)) {
    // Bald: a little shine on the scalp.
    if (c.a.hair === 0 && c.v.head === 'human') c.p.dots([[19, c.f.hy + 2], [20, c.f.hy + 1], [21, c.f.hy + 1]], c.skin.light);
    return;
  }
  c.p.tag = 'hair';
  STYLES[c.a.hair].front(c);
  c.p.tag = null;
}
