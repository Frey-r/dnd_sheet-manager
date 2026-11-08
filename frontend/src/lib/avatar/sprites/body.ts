/* Bare body and heads. Clothes, hair and race parts are drawn on top. */
import { mix, shade } from '../color';
import { KERATIN } from '../palettes';
import { EYE_WHITE, INK, type DrawCtx } from './context';

export function drawBackLimbs({ p, f, skinDark }: DrawCtx) {
  p.fill(f.backArm, skinDark);
  p.fill(f.backHand, skinDark);
  p.fill(f.backLeg, skinDark);
  p.fill(f.backFoot, skinDark);
}

export function drawTorsoAndFrontLeg({ p, f, skin }: DrawCtx) {
  p.fill(f.neck, shade(skin, 0.88));
  for (let y = f.torso.y; y < f.torso.y + f.torso.h; y++) {
    const [x1, x2] = f.span(y);
    p.hline(x1, x2, y, skin);
  }
  p.fill(f.frontLeg, skin);
  p.fill(f.frontFoot, skin);
}

export function drawFrontArm({ p, f, skin }: DrawCtx) {
  p.fill(f.frontArm, skin);
  p.fill(f.frontHand, skin);
}

function headBlock({ p, f }: DrawCtx, color: string) {
  const { x, y, w, h } = f.head;
  p.rect(x, y, w, h, color);
  for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + w - 1, y], [x + w - 2, y], [x + w - 1, y + 1], [x, y + h - 1], [x + 1, y + h - 1], [x + w - 1, y + h - 1]] as [number, number][]) {
    p.clear(cx, cy);
  }
  // Back of the head slightly darker, like a light from the front.
  p.vline(x, y + 2, y + h - 2, shade(color, 0.9));
}

/** Head shape, snout/beak/trunk. Eyes and mouth are drawn later by drawFace. */
export function drawHead(c: DrawCtx) {
  const { p, f, v, skin } = c;
  const { x, y, w, h } = f.head;
  const { x: ex, y: ey } = f.eye;
  const front = x + w; // first column outside the head, facing right

  switch (v.head) {
    case 'beast': {
      headBlock(c, skin);
      p.rect(front - 1, ey + 2, 4, 3, mix(skin, '#ffffff', 0.3));
      p.set(front + 2, ey + 2, INK);
      p.dots([[front, ey + 4], [front + 1, ey + 4]], shade(skin, 0.55));
      break;
    }
    case 'beak': {
      headBlock(c, skin);
      const beak = v.key === 'kenku' ? '#4a4a52' : KERATIN;
      p.hline(front, front + 2, ey + 1, beak);
      p.hline(front, front + 3, ey + 2, beak);
      p.hline(front, front + 1, ey + 3, shade(beak, 0.8));
      p.set(front + 3, ey + 3, shade(beak, 0.6));
      break;
    }
    case 'reptile': {
      headBlock(c, skin);
      p.hline(front, front + 2, ey + 1, skin);
      p.hline(front, front + 3, ey + 2, skin);
      p.hline(front, front + 3, ey + 3, shade(skin, 0.9));
      p.hline(front, front + 2, ey + 4, mix(skin, '#f2e6c0', 0.35));
      p.hline(x + w - 4, front + 3, ey + 3, shade(skin, 0.6));
      p.set(front + 2, ey + 1, INK);
      p.hline(ex - 1, ex + 2, ey - 1, shade(skin, 0.75));
      break;
    }
    case 'elephant': {
      headBlock(c, skin);
      p.rect(x + 1, y + 2, 5, 8, shade(skin, 0.85));
      p.rect(x + 2, y + 3, 3, 6, shade(skin, 0.72));
      p.rect(front, ey + 1, 2, 2, skin);
      p.vline(front + 1, ey + 3, ey + 8, skin);
      p.vline(front, ey + 3, ey + 6, shade(skin, 0.9));
      p.dots([[front + 2, ey + 8], [front + 2, ey + 7]], shade(skin, 0.85));
      break;
    }
    case 'insect': {
      headBlock(c, skin);
      p.clear(x + 2, y);
      p.clear(x + w - 3, y);
      p.dots([[front, ey + 3], [front + 1, ey + 3], [front + 1, ey + 4]], shade(skin, 0.5));
      break;
    }
    case 'skull': {
      headBlock(c, skin);
      p.hline(x + w - 5, x + w - 1, ey + 3, INK);
      for (let i = x + w - 5; i <= x + w - 1; i++) p.set(i, ey + 4, (i - x) % 2 ? INK : skin);
      p.set(x + w - 2, ey + 2, INK);
      break;
    }
    case 'fish': {
      headBlock(c, skin);
      p.dots([[front, ey + 2], [front, ey + 3]], shade(skin, 0.8));
      p.set(front - 1, ey + 3, INK);
      p.dots([[x + 4, ey + 1], [x + 5, ey + 2], [x + 4, ey + 3]], shade(skin, 0.68));
      break;
    }
    case 'frog': {
      p.rect(x, y + 2, w + 1, h - 2, skin);
      p.clear(x, y + 2);
      p.clear(x, y + h - 1);
      p.ellipse(ex + 0.5, y + 1.5, 2, 2, skin);
      p.hline(x + 3, front, ey + 3, shade(skin, 0.55));
      p.hline(x + 4, front - 1, ey + 4, mix(skin, '#f2e6c0', 0.4));
      break;
    }
    case 'ooze': {
      p.ellipse(x + w / 2 - 0.5, y + h / 2, w / 2 - 0.5, h / 2 - 0.5, skin);
      p.dots([[x + 3, y + 2], [x + 4, y + 2], [x + 3, y + 3]], shade(skin, 1.4));
      p.dots([[x + 2, y + h], [x + 2, y + h + 1], [x + 8, y + h]], skin);
      break;
    }
    default: {
      headBlock(c, skin);
      p.set(front, ey + 2, shade(skin, 0.85));
    }
  }
}

/** Default side-view ear for humanoid heads without an ear part. */
export function drawPlainEar(c: DrawCtx) {
  const { p, f, skin, parts } = c;
  if (c.v.head !== 'human') return;
  for (const part of parts) if (part.startsWith('ears-')) return;
  const { x } = f.head;
  const { y: ey } = f.eye;
  p.rect(x + 4, ey, 2, 3, shade(skin, 0.85));
  p.set(x + 5, ey + 1, shade(skin, 0.7));
}

export function drawFace(c: DrawCtx) {
  const { p, f, a, v, skin, parts } = c;
  const { y } = f.head;
  const { x: ex, y: ey } = f.eye;
  const glow = parts.has('glow-eyes');
  if (parts.has('cyclops')) {
    const cx = ex - 1;
    p.rect(cx, ey - 1, 3, 3, EYE_WHITE);
    p.dots([[cx + 1, ey], [cx + 2, ey]], a.eyes);
    p.hline(cx - 1, cx + 3, ey - 2, shade(skin, 0.7));
    p.dots([[ex, ey + 4], [ex + 1, ey + 4]], shade(skin, 0.62));
    return;
  }
  switch (v.head) {
    case 'skull':
      p.rect(ex, ey, 2, 2, INK);
      if (glow) p.set(ex + 1, ey, a.eyes);
      return;
    case 'insect':
      p.rect(ex - 1, ey - 1, 3, 3, a.eyes);
      p.set(ex, ey - 1, shade(a.eyes, 1.5));
      p.set(ex + 1, ey + 1, shade(a.eyes, 0.6));
      return;
    case 'fish':
      p.rect(ex - 1, ey - 1, 3, 3, EYE_WHITE);
      p.dots([[ex, ey], [ex + 1, ey]], glow ? shade(a.eyes, 1.3) : a.eyes);
      return;
    case 'frog':
      p.dots([[ex, y + 1], [ex + 1, y + 1]], glow ? shade(a.eyes, 1.3) : a.eyes);
      p.set(ex + 1, y + 1, INK);
      return;
    case 'reptile':
      p.dots([[ex, ey], [ex + 1, ey]], glow ? shade(a.eyes, 1.4) : a.eyes);
      p.set(ex + 1, ey, INK);
      p.dots([[ex, ey + 1], [ex + 1, ey + 1]], shade(a.eyes, 0.7));
      return;
    default: {
      p.dots([[ex, ey], [ex, ey + 1]], glow ? shade(a.eyes, 1.6) : EYE_WHITE);
      p.dots([[ex + 1, ey], [ex + 1, ey + 1]], glow ? shade(a.eyes, 1.3) : a.eyes);
      if (v.hair || v.head === 'human') p.hline(ex, ex + 1, ey - 1, shade(c.hair, 0.85));
      if (a.body === 1) p.set(ex + 2, ey - 1, INK);
      const bearded = parts.has('beard-full') || parts.has('beard-braided') || parts.has('beard-short');
      if (!bearded && (v.head === 'human' || v.head === 'ooze')) p.dots([[ex, ey + 4], [ex + 1, ey + 4]], shade(skin, 0.62));
    }
  }
}
