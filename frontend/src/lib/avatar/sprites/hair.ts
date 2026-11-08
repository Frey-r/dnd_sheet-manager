/* Nine hair styles (0 bald, 1–4 set A, 5–8 set B). Any body may wear any of them. */
import { shade } from '../color';
import type { DrawCtx } from './context';

/** Cap shared by most styles: covers the crown and the back of the skull, leaves the face free. */
function cap(c: DrawCtx, backDown: number) {
  const { p, f, hair } = c;
  const { x, y, w } = f.head;
  const dark = shade(hair, 0.78);
  p.hline(x + 2, x + w - 3, y - 1, hair);
  p.hline(x + 1, x + w - 2, y, hair);
  p.hline(x, x + w - 1, y + 1, hair);
  p.hline(x, x + w - 3, y + 2, hair);
  p.rect(x, y + 3, 4, backDown - 2, hair);
  p.vline(x, y + 2, y + backDown, dark);
  p.hline(x + 3, x + w - 4, y - 1, shade(hair, 1.2));
}

/** Layer behind the body (long hair, braid). */
export function drawHairBack(c: DrawCtx) {
  const { p, f, a, hair } = c;
  const { x, y, h } = f.head;
  const dark = shade(hair, 0.72);
  if (a.hair === 5) {
    const bottom = f.torso.y + Math.min(6, f.torso.h - 2);
    p.rect(x - 1, y + 2, 6, bottom - y - 2, dark);
    for (let i = x - 1; i < x + 5; i += 2) p.set(i, bottom, dark);
  }
  if (a.hair === 6) {
    const end = f.torso.y + Math.min(8, f.torso.h);
    for (let j = y + h - 1; j <= end; j++) p.hline(x, x + 1, j, (j - y) % 2 ? hair : dark);
    p.hline(x, x + 1, end + 1, shade(hair, 1.3));
  }
  if (a.hair === 8) {
    const bottom = y + h + 3;
    p.rect(x - 2, y + 2, 6, bottom - y - 2, dark);
    for (let j = y + 3; j <= bottom; j += 2) p.set(x - 3, j, dark);
  }
}

export function drawHairFront(c: DrawCtx) {
  const { p, f, a, hair } = c;
  const { x, y, w, h } = f.head;
  const light = shade(hair, 1.2);
  const dark = shade(hair, 0.78);
  switch (a.hair) {
    case 1: // corto
      cap(c, 6);
      p.set(x + w - 2, y + 3, hair);
      break;
    case 2: // puntas
      cap(c, 5);
      for (let i = 0; i < 3; i++) {
        p.dots([[x + 2 + 3 * i, y - 2], [x + 3 + 3 * i, y - 2], [x + 3 + 3 * i, y - 3]], hair);
      }
      p.dots([[x + w, y + 1], [x + w - 1, y + 2], [x + w - 1, y + 3]], hair);
      p.dots([[x - 1, y + 3], [x - 1, y + 5]], dark);
      break;
    case 3: // coleta
      cap(c, 5);
      for (const [px, py] of [[x - 1, y + 3], [x - 2, y + 4], [x - 2, y + 5], [x - 3, y + 6], [x - 3, y + 7], [x - 2, y + 8]] as [number, number][]) {
        p.hline(px - 1, px, py, py % 2 ? hair : dark);
      }
      p.set(x - 1, y + 3, shade(hair, 1.4));
      break;
    case 4: // cresta
      p.hline(x + 4, x + 7, y - 3, hair);
      p.hline(x + 3, x + 8, y - 2, hair);
      p.rect(x + 3, y - 1, w - 6, 3, hair);
      p.hline(x + 4, x + 7, y - 3, light);
      p.dots([[x + 1, y + 1], [x + 2, y + 2], [x + 1, y + 3]], dark);
      break;
    case 5: // largo
      cap(c, h - 1);
      p.rect(x, y + 3, 5, h - 3, hair);
      p.dots([[x + w - 2, y + 3], [x + w - 3, y + 3]], hair);
      break;
    case 6: // trenza
      cap(c, 6);
      p.set(x + w - 2, y + 3, hair);
      break;
    case 7: // moño
      cap(c, 5);
      p.ellipse(x + 2.5, y - 2, 2, 1.5, hair);
      p.dots([[x + 2, y - 3], [x + 3, y - 3]], light);
      p.set(x + w - 2, y + 3, hair);
      break;
    case 8: // melena
      p.hline(x + 2, x + w - 3, y - 2, hair);
      p.hline(x, x + w - 2, y - 1, hair);
      p.hline(x - 1, x + w - 1, y, hair);
      p.hline(x - 1, x + w - 1, y + 1, hair);
      p.rect(x - 1, y + 2, 5, h - 1, hair);
      p.hline(x + w - 3, x + w - 1, y + 2, hair);
      p.set(x + w - 1, y + 3, hair);
      p.hline(x + 3, x + 7, y - 2, light);
      for (let j = y + 3; j < y + h + 1; j += 2) p.set(x - 1, j, dark);
      break;
    default:
      break;
  }
}
