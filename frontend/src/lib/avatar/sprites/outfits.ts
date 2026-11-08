/* Eight preset outfits, each with a primary (P) and secondary (Q) colour.
   0–3 set A: túnica, jubón, camisa y chaleco, abrigo largo.
   4–7 set B: vestido, corsé y falda, blusa y pantalón, capa corta.
   Set B is its own design, not a recolour of set A; any body may wear any outfit. */
import { mix, shade } from '../color';
import type { Rect } from '../painter';
import type { DrawCtx } from './context';

const BOOT = '#3e2a1c';
const DARK_BOOT = '#2e2420';

const rows = (r: Rect, from: number, to: number) => ({ x: r.x, y: from, w: r.w, h: Math.max(0, to - from + 1) });

function torsoRows(c: DrawCtx, y1: number, y2: number, color: string, grow = 0) {
  for (let y = Math.max(y1, c.f.torso.y); y <= y2; y++) {
    const [a, b] = c.f.span(y);
    c.p.hline(a - grow, b + grow, y, color);
  }
}

function legsTop(c: DrawCtx) { return c.f.frontLeg.y; }
function legsBottom(c: DrawCtx) { return c.f.frontLeg.y + c.f.frontLeg.h - 1; }

function pants(c: DrawCtx, color: string, back: boolean) {
  const leg = back ? c.f.backLeg : c.f.frontLeg;
  c.p.fill(leg, back ? shade(color, 0.8) : color);
}

function boots(c: DrawCtx, color: string, height: number, back: boolean) {
  const leg = back ? c.f.backLeg : c.f.frontLeg;
  const foot = back ? c.f.backFoot : c.f.frontFoot;
  const col = back ? shade(color, 0.8) : color;
  c.p.fill(rows(leg, leg.y + leg.h - height, leg.y + leg.h - 1), col);
  c.p.fill(foot, col);
  if (!back) c.p.set(foot.x + foot.w - 1, foot.y, shade(color, 0.7));
}

function sleeve(c: DrawCtx, color: string, back: boolean, length = 1, cuff?: string) {
  const arm = back ? c.f.backArm : c.f.frontArm;
  const n = Math.max(1, Math.round(arm.h * length));
  const col = back ? shade(color, 0.8) : color;
  c.p.fill(rows(arm, arm.y, arm.y + n - 1), col);
  if (cuff && length >= 1) c.p.fill(rows(arm, arm.y + n - 1, arm.y + n - 1), back ? shade(cuff, 0.8) : cuff);
}

/** Skirt/coat tail from y1 to y2, flaring out towards the bottom. */
function skirt(c: DrawCtx, y1: number, y2: number, color: string, flare: number, hem?: string) {
  const { torso } = c.f;
  for (let y = y1; y <= y2; y++) {
    const t = (y - y1) / Math.max(1, y2 - y1);
    const grow = Math.round(t * flare);
    c.p.hline(torso.x - grow, torso.x + torso.w - 1 + Math.round(grow * 0.6), y, y === y2 && hem ? hem : color);
  }
}

interface Outfit {
  back?: (c: DrawCtx, P: string, Q: string) => void;
  backLimbs: (c: DrawCtx, P: string, Q: string) => void;
  body: (c: DrawCtx, P: string, Q: string) => void;
  frontArm: (c: DrawCtx, P: string, Q: string) => void;
}

const OUTFITS: Outfit[] = [
  { // 0 Túnica
    backLimbs: (c, P, Q) => { const pantsC = mix(Q, '#2b2b30', 0.5); sleeve(c, P, true); pants(c, pantsC, true); boots(c, BOOT, 3, true); },
    body: (c, P, Q) => {
      const { f, p } = c;
      pants(c, mix(Q, '#2b2b30', 0.5), false); boots(c, BOOT, 3, false);
      torsoRows(c, f.torso.y, f.torso.y + f.torso.h - 1, P);
      skirt(c, f.torso.y + f.torso.h, f.torso.y + f.torso.h + 2, P, 1);
      torsoRows(c, f.hipY - 1, f.hipY - 1, Q);
      const [, x2] = f.span(f.torso.y);
      p.hline(x2 - 2, x2, f.torso.y, Q);
      p.set(x2 - 1, f.hipY - 1, '#e0c050');
    },
    frontArm: (c, P) => sleeve(c, P, false),
  },
  { // 1 Jubón
    backLimbs: (c, P, Q) => { sleeve(c, P, true, 0.35); pants(c, Q, true); boots(c, DARK_BOOT, 2, true); },
    body: (c, P, Q) => {
      const { f, p } = c;
      pants(c, Q, false); boots(c, DARK_BOOT, 2, false);
      torsoRows(c, f.torso.y, f.torso.y + f.torso.h - 1, P);
      torsoRows(c, f.torso.y, f.torso.y, Q);
      const x = f.torso.x + f.torso.w - 2;
      for (let y = f.torso.y + 2; y < f.torso.y + f.torso.h; y += 2) p.set(x, y, Q);
      torsoRows(c, f.torso.y + f.torso.h - 1, f.torso.y + f.torso.h - 1, shade(P, 0.7));
    },
    frontArm: (c, P, Q) => { sleeve(c, P, false, 0.35); c.p.fill(rows(c.f.frontArm, c.f.frontArm.y, c.f.frontArm.y), Q); },
  },
  { // 2 Camisa y chaleco
    backLimbs: (c, P, Q) => { sleeve(c, Q, true, 1, P); pants(c, shade(P, 0.5), true); boots(c, DARK_BOOT, 2, true); },
    body: (c, P, Q) => {
      const { f } = c;
      pants(c, shade(P, 0.5), false); boots(c, DARK_BOOT, 2, false);
      torsoRows(c, f.torso.y, f.torso.y + f.torso.h - 1, Q);
      for (let y = f.torso.y; y < f.torso.y + f.torso.h - 1; y++) {
        const [a, b] = f.span(y);
        c.p.hline(a, b - 2, y, P);
      }
      c.p.vline(f.torso.x + Math.floor(f.torso.w / 2) - 1, f.torso.y + 2, f.waistY, shade(P, 0.75));
    },
    frontArm: (c, P, Q) => sleeve(c, Q, false, 1, P),
  },
  { // 3 Abrigo largo
    backLimbs: (c, P, Q) => { sleeve(c, P, true, 1, Q); pants(c, '#3a3a40', true); boots(c, DARK_BOOT, 4, true); },
    body: (c, P, Q) => {
      const { f, p } = c;
      pants(c, '#3a3a40', false); boots(c, DARK_BOOT, 4, false);
      torsoRows(c, f.torso.y, f.torso.y + f.torso.h - 1, P);
      const knee = legsTop(c) + Math.round((legsBottom(c) - legsTop(c)) * 0.55);
      skirt(c, f.torso.y + f.torso.h, knee, P, 2, Q);
      const [, x2] = f.span(f.torso.y);
      p.dots([[x2, f.torso.y], [x2 - 1, f.torso.y + 1], [x2 - 1, f.torso.y + 2], [x2 - 2, f.torso.y + 3]], Q);
      torsoRows(c, f.waistY + 1, f.waistY + 1, shade(P, 0.6));
    },
    frontArm: (c, P, Q) => sleeve(c, P, false, 1, Q),
  },
  { // 4 Vestido
    backLimbs: (c, _P, Q) => c.p.fill(rows(c.f.backArm, c.f.backArm.y, c.f.backArm.y + 1), shade(Q, 0.8)),
    body: (c, P, Q) => {
      const { f, p } = c;
      p.fill(f.frontFoot, shade(Q, 0.6));
      p.fill(f.backFoot, shade(Q, 0.5));
      torsoRows(c, f.torso.y, f.waistY, P);
      torsoRows(c, f.waistY + 1, f.waistY + 2, Q);
      skirt(c, f.waistY + 3, legsBottom(c), P, 3, Q);
      for (let y = f.waistY + 5; y < legsBottom(c); y += 3) p.set(f.torso.x + 2, y, shade(P, 0.8));
    },
    frontArm: (c, _P, Q) => {
      const a = c.f.frontArm;
      c.p.rect(a.x, a.y, a.w + 1, 2, Q);
      c.p.set(a.x + a.w, a.y + 1, shade(Q, 0.8));
    },
  },
  { // 5 Corsé y falda
    backLimbs: (c, P, Q) => { sleeve(c, Q, true, 0.8); pants(c, '#2b2b30', true); boots(c, shade(P, 0.5), 3, true); },
    body: (c, P, Q) => {
      const { f, p } = c;
      pants(c, '#2b2b30', false); boots(c, shade(P, 0.5), 3, false);
      torsoRows(c, f.torso.y, f.torso.y + f.torso.h - 1, Q);
      torsoRows(c, f.waistY - 2, f.hipY, P);
      const x = f.span(f.waistY)[1] - 1;
      for (let y = f.waistY - 2; y <= f.hipY; y += 2) p.set(x, y, shade(P, 1.45));
      const knee = legsTop(c) + Math.round((legsBottom(c) - legsTop(c)) * 0.5);
      skirt(c, f.hipY + 1, knee, P, 2, shade(P, 0.7));
    },
    frontArm: (c, _P, Q) => sleeve(c, Q, false, 0.8),
  },
  { // 6 Blusa y pantalón
    backLimbs: (c, P, Q) => { sleeve(c, P, true, 1, Q); pants(c, Q, true); boots(c, '#5a3a22', 3, true); },
    body: (c, P, Q) => {
      const { f } = c;
      pants(c, Q, false); boots(c, '#5a3a22', 3, false);
      torsoRows(c, f.torso.y, f.torso.y + f.torso.h - 1, P, 0);
      skirt(c, f.torso.y + f.torso.h, f.torso.y + f.torso.h, P, 0);
      torsoRows(c, f.torso.y + 1, f.torso.y + 1, shade(P, 1.25));
    },
    frontArm: (c, P, Q) => {
      sleeve(c, P, false, 1, Q);
      const a = c.f.frontArm;
      c.p.rect(a.x + a.w, a.y + a.h - 3, 1, 2, P);
    },
  },
  { // 7 Capa corta
    back: (c, _P, Q) => {
      const { f, p } = c;
      const bottom = f.hipY + Math.round(f.frontLeg.h * 0.45);
      p.rect(f.torso.x - 2, f.torso.y, 4, bottom - f.torso.y, shade(Q, 0.8));
      for (let i = f.torso.x - 2; i < f.torso.x + 2; i += 2) p.set(i, bottom, shade(Q, 0.8));
    },
    backLimbs: (c, P, Q) => { sleeve(c, P, true); pants(c, shade(P, 0.45), true); boots(c, shade(Q, 0.6), 4, true); },
    body: (c, P, Q) => {
      const { f, p } = c;
      pants(c, shade(P, 0.45), false); boots(c, shade(Q, 0.6), 4, false);
      torsoRows(c, f.torso.y, f.torso.y + f.torso.h - 1, P);
      skirt(c, f.torso.y + f.torso.h, f.torso.y + f.torso.h + 1, P, 0);
      torsoRows(c, f.torso.y, f.torso.y + 1, Q);
      p.set(f.span(f.torso.y + 1)[1] - 1, f.torso.y + 1, '#e0c050');
    },
    frontArm: (c, P) => sleeve(c, P, false),
  },
];

const outfitOf = (c: DrawCtx) => OUTFITS[Math.max(0, Math.min(OUTFITS.length - 1, c.a.outfit))];

export function drawOutfitBack(c: DrawCtx) { outfitOf(c).back?.(c, c.a.outfitColors[0], c.a.outfitColors[1]); }
export function drawOutfitBackLimbs(c: DrawCtx) { outfitOf(c).backLimbs(c, c.a.outfitColors[0], c.a.outfitColors[1]); }
export function drawOutfitBody(c: DrawCtx) { outfitOf(c).body(c, c.a.outfitColors[0], c.a.outfitColors[1]); }
export function drawOutfitFrontArm(c: DrawCtx) { outfitOf(c).frontArm(c, c.a.outfitColors[0], c.a.outfitColors[1]); }
