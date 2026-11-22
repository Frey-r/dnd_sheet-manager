/* Bare chibi body, heads and faces. Clothes, hair and race parts are drawn on top.
   Light comes from the top left (character-appearance.md, "Shading"). */
import { mix, ramp, type Ramp } from '../color';
import { FOOT_Y, HEAD_PROFILE, HEAD_PROFILES, headSpan, mx, type Painter } from '../painter';
import { BONE, KERATIN } from '../palettes';
import { EYE_WHITE, INK, type DrawCtx } from './context';

/**
 * Fills columns x1…x2 of row y with a ramp: the left edge is lit, the right edge in shadow.
 * `bias` > 0 darkens the whole span (parts further from the light), < 0 lightens it.
 */
export function shadeSpan(p: Painter, y: number, x1: number, x2: number, r: Ramp, bias = 0) {
  const w = x2 - x1;
  for (let x = x1; x <= x2; x++) {
    const t = w <= 0 ? 0.5 : (x - x1) / w;
    let k = t < 0.18 && w >= 3 ? 1 : t > 0.78 ? -1 : 0;
    k -= bias;
    p.set(x, y, k >= 1 ? r.light : k <= -2 ? r.deep : k <= -1 ? r.shadow : r.base);
  }
}

/** A limb or garment column block, shaded like shadeSpan on each row. */
export function shadeRect(p: Painter, x: number, y: number, w: number, h: number, r: Ramp, bias = 0) {
  for (let j = y; j < y + h; j++) shadeSpan(p, j, x, x + w - 1, r, bias);
}

/** Both arms (skin) with hands; the viewer's right arm is in shadow. */
function drawArms({ p, f, skin }: DrawCtx) {
  const { arm } = f;
  for (const right of [false, true]) {
    const x = right ? mx(arm.x + arm.w - 1) : arm.x;
    shadeRect(p, x, arm.y, arm.w, arm.h, skin, right ? 1 : 0);
    // Rounded shoulder.
    p.clear(right ? x + arm.w - 1 : x, arm.y);
  }
}

export function drawBody(c: DrawCtx) {
  const { p, f, skin } = c;
  p.tag = 'skin';
  const { leg } = f;
  // Legs and bare feet.
  for (const right of [false, true]) {
    const x = right ? mx(leg.x + leg.w - 1) : leg.x;
    shadeRect(p, x, leg.y, leg.w, leg.h, skin, right ? 1 : 0);
    const fx = right ? x : x - 1;
    shadeSpan(p, FOOT_Y - 1, fx, fx + leg.w, skin, right ? 1 : 0);
    shadeSpan(p, FOOT_Y, fx, fx + leg.w, skin, 1);
  }
  // Torso.
  for (let y = f.torsoTop; y <= f.torsoBottom; y++) {
    const [x1, x2] = f.span(y);
    shadeSpan(p, y, x1, x2, skin, y >= f.torsoBottom - 1 ? 1 : 0);
  }
  // Neck, in the shadow of the head.
  p.rect(22, f.chinY - 1, 4, f.torsoTop - f.chinY + 1, skin.shadow);
  p.hline(22, 25, f.chinY + 1, skin.deep);
  drawArms(c);
  p.tag = null;
}

/** Plain skull: rows of the head type's profile, lit from the top left. */
function skull(c: DrawCtx, r: Ramp = c.skin) {
  const { p, f } = c;
  const prof = HEAD_PROFILES[c.v.head];
  for (let y = f.hy; y <= f.chinY; y++) {
    const s = headSpan(f, y, prof);
    if (!s) continue;
    const [x1, x2] = s;
    p.hline(x1, x2, y, r.base);
    const row = y - f.hy;
    if (row >= 3) { p.set(x2, y, r.shadow); p.set(x2 - 1, y, row > 12 ? r.shadow : r.base); }
    if (row >= 2 && row <= 13) p.set(x1, y, r.light);
  }
  // Chin and jaw shadow.
  const [cx1, cx2] = headSpan(f, f.chinY, prof)!;
  p.hline(cx1, cx2, f.chinY, r.shadow);
  const [jx1, jx2] = headSpan(f, f.chinY - 1, prof)!;
  p.hline(Math.round((jx1 + jx2) / 2), jx2, f.chinY - 1, r.shadow);
  p.set(jx1, f.chinY - 1, r.shadow);
}

/** Default side ears for humanoid heads without an ear part (hidden by most hair styles). */
export function drawPlainEar(c: DrawCtx) {
  const { p, f, skin, parts, v } = c;
  if (v.head !== 'human') return;
  for (const part of parts) if (part.startsWith('ears-')) return;
  p.tag = 'skin';
  // Small ear against the side of the face, from the brow row down.
  const y = f.eyeY - 1;
  for (let j = 0; j < 4; j++) {
    const x1 = headSpan(f, y + j)![0];
    const pts: [number, number][] = j === 0 || j === 3 ? [[x1 - 1, y + j]] : [[x1 - 1, y + j], [x1 - 2, y + j]];
    p.sym(pts, skin.base);
    if (j === 1 || j === 2) { p.set(x1 - 1, y + j, skin.shadow); p.set(mx(x1 - 2), y + j, skin.shadow); }
  }
  p.tag = null;
}

/** Head shape plus snout, beak or trunk. Eyes and mouth are drawn by drawFace. */
export function drawHead(c: DrawCtx) {
  const { p, f, v, skin } = c;
  const { hy, eyeY, chinY } = f;
  p.tag = 'skin';
  switch (v.head) {
    case 'beast': {
      skull(c);
      // Fluffy cheeks and a pale muzzle with a dark nose.
      // Fur tufts break the cheek line so the head does not read as a ball.
      p.sym([[14, hy + 12], [13, hy + 13], [14, hy + 13], [15, hy + 14], [14, hy + 15], [15, hy + 15], [16, hy + 16], [16, hy + 17], [17, hy + 17]], skin.base);
      p.sym([[13, hy + 13], [14, hy + 15], [16, hy + 17]], skin.shadow);
      const muzzle = ramp(mix(skin.base, '#fff4e0', 0.45));
      for (let y = eyeY + 4; y <= chinY - 1; y++) {
        const hw = y === eyeY + 4 ? 2 : y === chinY - 1 ? 3 : 4;
        shadeSpan(p, y, 24 - hw, 23 + hw, muzzle);
      }
      p.hline(22, 25, eyeY + 4, INK);
      p.hline(23, 24, eyeY + 5, INK);
      p.set(22, eyeY + 4, mix(INK, skin.base, 0.3));
      p.sym([[23, eyeY + 6], [22, eyeY + 7], [21, eyeY + 7]], skin.deep);
      break;
    }
    case 'beak': {
      skull(c);
      // Ruffled cheek feathers.
      p.sym([[14, hy + 12], [13, hy + 13], [14, hy + 14], [15, hy + 15], [15, hy + 16], [16, hy + 17]], skin.shadow);
      // Feather tuft on the crown so the head is not a plain ball.
      p.stamp(20, hy - 3, ['..l..l..', '.lb.lbs.', 'lbbsbbbs'], { l: skin.light, b: skin.base, s: skin.shadow });
      const beak = ramp(v.key === 'kenku' ? '#4a4a56' : KERATIN);
      const top = eyeY + 3;
      p.stamp(20, top, [
        '.llbb...',
        'lllbbbs.',
        '.lbbbss.',
        '.dddddd.',
        '..sbbs..',
        '...ss...',
      ], { l: beak.light, b: beak.base, s: beak.shadow, d: beak.deep });
      break;
    }
    case 'reptile': {
      // Wider jaw and a long snout seen from the front.
      skull(c);
      for (let y = hy + 14; y <= chinY + 1; y++) {
        const hw = y <= chinY - 1 ? 10 : y === chinY ? 9 : 7;
        shadeSpan(p, y, 24 - hw, 23 + hw, skin, y >= chinY ? 1 : 0);
      }
      const belly = ramp(mix(skin.base, '#f2e6c0', 0.45));
      p.hline(18, 29, chinY, belly.shadow);
      p.hline(20, 27, chinY + 1, belly.base);
      p.hline(16, 31, chinY - 1, skin.deep);
      p.sym([[21, eyeY + 5], [22, eyeY + 5]], skin.deep);
      p.sym([[19, hy + 2], [20, hy + 3], [17, hy + 5], [21, hy + 6]], skin.light);
      p.sym([[15, eyeY - 1], [16, eyeY - 2], [17, eyeY - 2], [18, eyeY - 2], [19, eyeY - 2], [20, eyeY - 1]], skin.shadow);
      break;
    }
    case 'elephant': {
      // Big ears first (behind the skull), then the trunk.
      const ear = ramp(mix(skin.base, '#000000', 0.08));
      for (const right of [false, true]) {
        p.stamp(right ? 33 : 5, hy + 3, [
          '...lbbbb.',
          '.lbbbbbbb',
          'lbbssssbb',
          'lbsddddsb',
          'lbsddddsb',
          'lbsddddsb',
          'lbbssssbb',
          '.lbbbbbbb',
          '..lbbbbbb',
          '...bbbbb.',
          '....sss..',
        ], { l: ear.light, b: ear.base, s: ear.shadow, d: mix(ear.shadow, '#c98a8a', 0.35) }, right);
      }
      skull(c);
      p.stamp(22, eyeY + 2, [
        'lbbs',
        'lbbs',
        'lbbs',
        '.lbs',
        '.lbs',
        '.lbs',
        '.lbs',
        '..bs',
        '.lbs',
        'lbs.',
        'ss..',
      ], { l: skin.light, b: skin.base, s: skin.shadow });
      p.dots([[23, eyeY + 4], [23, eyeY + 7]], skin.shadow);
      break;
    }
    case 'insect': {
      skull(c);
      p.sym([[19, hy], [18, hy + 1]], skin.light);
      // Mandibles.
      p.sym([[20, chinY + 1], [21, chinY + 1], [21, chinY + 2], [22, chinY + 2]], skin.deep);
      p.hline(20, 27, chinY - 2, skin.shadow);
      break;
    }
    case 'skull': {
      skull(c);
      p.stamp(21, eyeY + 5, ['..ab..', '.abba.'], { a: INK, b: mix(INK, skin.base, 0.3) });
      p.stamp(20, chinY - 3, ['bbbbbbbb', 'kbkbkbkb', 'skbkbkbs'], { b: BONE, k: INK, s: skin.shadow });
      // Cheekbones.
      p.sym([[17, eyeY + 4], [18, eyeY + 5]], skin.shadow);
      break;
    }
    case 'fish': {
      skull(c);
      p.sym([[13, eyeY - 1], [12, eyeY], [12, eyeY + 1], [12, eyeY + 2], [13, eyeY + 3]], skin.base);
      p.sym([[12, eyeY + 1]], skin.shadow);
      p.hline(20, 27, chinY - 2, skin.deep);
      p.hline(21, 26, chinY - 1, mix(skin.base, '#e08a8a', 0.4));
      p.sym([[16, hy + 4], [18, hy + 6], [15, hy + 8]], skin.light);
      break;
    }
    case 'frog': {
      // Wide flat head with eye bumps on top.
      for (let y = hy + 3; y <= chinY - 1; y++) {
        const hw = y === hy + 3 ? 9 : y >= chinY - 2 ? 9 : 11;
        shadeSpan(p, y, 24 - hw, 23 + hw, skin, y >= chinY - 2 ? 1 : 0);
      }
      for (const right of [false, true]) {
        const cx = right ? 29.5 : 17.5;
        p.ellipse(cx, hy + 3, 3.2, 3, right ? skin.shadow : skin.base);
        p.ellipse(cx - 0.5, hy + 2.5, 2, 1.6, right ? skin.base : skin.light);
      }
      const belly = mix(skin.base, '#f2e6c0', 0.5);
      p.hline(16, 31, eyeY + 4, skin.deep);
      p.hline(17, 30, eyeY + 5, belly);
      p.hline(18, 29, eyeY + 6, belly);
      break;
    }
    case 'ooze': {
      for (let y = hy; y <= chinY + 1; y++) {
        const row = y - hy;
        const hw = (HEAD_PROFILE[row] ?? 9) + (row > 12 ? 1 : 0);
        shadeSpan(p, y, 24 - hw, 23 + hw, skin);
      }
      p.ellipse(25, eyeY + 4, 4, 3, `${skin.shadow}cc`);
      p.dots([[17, hy + 3], [18, hy + 3], [17, hy + 4], [16, hy + 6]], skin.hi);
      p.dots([[15, chinY + 2], [16, chinY + 3], [31, chinY + 2]], skin.base);
      break;
    }
    default:
      skull(c);
  }
  p.tag = null;
}

/** Colour keys shared by the eye templates: k lash, w white, h highlight, d/s/i/l iris top → bottom. */
function eyeMap(c: DrawCtx, glow: boolean): Record<string, string> {
  const { eyes } = c;
  return glow
    ? { k: INK, w: eyes.hi, h: '#ffffff', d: eyes.shadow, s: eyes.base, i: eyes.light, l: eyes.hi }
    : { k: INK, w: EYE_WHITE, h: '#ffffff', d: eyes.deep, s: eyes.shadow, i: eyes.base, l: eyes.light };
}

/*
 * Big chibi eye, 5 × 6 px: a dark lash on top that is two pixels thick at the outer corner, a white
 * sliver on the outer side, an iris that goes from dark (top) to light (bottom), a 2-px highlight at
 * its top left and a 1-px one at its bottom right. Light comes from the top left, so the highlights
 * sit on the same side of both eyes; only the lash and the white are mirrored.
 */
const EYE_L = ['kkkk', 'khdd', 'wsii', '.lll'];
const EYE_R = ['kkkk', 'hddk', 'siiw', 'lll.'];

function eye(c: DrawCtx, right: boolean, glow: boolean) {
  const { p, f, a } = c;
  const y0 = f.eyeY;
  p.tag = 'eye';
  p.stamp(right ? 27 : 17, y0, right ? EYE_R : EYE_L, eyeMap(c, glow));
  // Outer lash flick for body B.
  if (a.body === 1) p.set(right ? 31 : 16, y0, INK);
  p.tag = null;
}

/** Eyes, brows, mouth and blush for each head type. */
export function drawFace(c: DrawCtx) {
  const { p, f, a, v, skin, parts, hair, eyes } = c;
  const { eyeY, mouthY, hy } = f;
  const glow = parts.has('glow-eyes');
  const map = eyeMap(c, glow);

  if (parts.has('cyclops')) {
    // One centred eye, 6 × 5, white on both sides.
    p.stamp(21, eyeY - 1, ['.kkkk.', 'kkkkkk', 'whddsw', 'wsiiiw', '.llll.'], map);
    p.hline(20, 27, eyeY - 3, skin.shadow);
    p.hline(23, 24, mouthY, skin.deep);
    return;
  }
  switch (v.head) {
    case 'skull': {
      // Round dark sockets; glowing eyes show a pinpoint with a highlight.
      for (const right of [false, true]) {
        const x0 = right ? 27 : 17;
        p.stamp(x0, eyeY, ['.kk.', 'kkkk', 'kkkk', '.kk.'], { k: INK });
        if (glow) p.stamp(x0 + 1, eyeY + 1, ['hi', 'il'], { h: '#ffffff', i: eyes.hi, l: eyes.light });
      }
      return;
    }
    case 'insect': {
      // Big faceted eyes with the same two highlights.
      for (const right of [false, true]) {
        p.stamp(right ? 28 : 15, eyeY - 2, ['.ddd.', 'dhsid', 'dsiid', 'diild', '.ddd.'],
          { ...map, d: eyes.deep, s: eyes.shadow, i: glow ? eyes.hi : eyes.base, h: '#ffffff' });
      }
      return;
    }
    case 'fish': {
      // Round bulging eyes on the sides of the head.
      for (const right of [false, true]) {
        p.stamp(right ? 29 : 14, eyeY - 1, ['.www.', 'whhdw', 'wdssw', 'wsihw', '.www.'], map);
      }
      return;
    }
    case 'frog': {
      for (const right of [false, true]) {
        p.stamp(right ? 27 : 16, hy + 1, ['.kkk.', 'khhdk', 'kdssk', 'kiihk', '.kkk.'], map);
      }
      return;
    }
    case 'reptile': {
      // Slit pupil, heavy lid slanting down towards the snout.
      for (const right of [false, true]) {
        p.stamp(right ? 27 : 17, eyeY, right
          ? ['.kkk', 'kkdh', 'ikii', 'lkl.']
          : ['kkk.', 'hdkk', 'iiki', '.lkl'],
        map);
      }
      return;
    }
    default: {
      eye(c, false, glow);
      eye(c, true, glow);
      if (v.hair || v.head === 'human') {
        const brow = hair.deep;
        p.tag = 'brow';
        p.hline(17, 19, eyeY - 2, brow);
        p.hline(28, 30, eyeY - 2, brow);
        p.tag = null;
      }
      if (v.head === 'human' || v.head === 'ooze') {
        const bearded = parts.has('beard-full') || parts.has('beard-braided') || parts.has('beard-short');
        const blush = mix(skin.base, '#ff7a7a', 0.32);
        p.sym([[18, eyeY + 4], [19, eyeY + 4]], blush);
        p.set(24, eyeY + 4, skin.shadow);
        if (!bearded) {
          const lip = mix(skin.deep, '#8a2a3a', 0.35);
          p.hline(23, 24, mouthY, lip);
          if (a.body === 1) p.set(24, mouthY + 1, mix(skin.base, '#ff7a7a', 0.25));
        }
      }
    }
  }
}

/** Skin pixels right under the hair (or a hat) get the shadow tone. */
export function castHairShadow(c: DrawCtx) {
  const { p, f, skin } = c;
  p.tag = 'shade';
  for (let y = f.hy + 1; y <= f.chinY; y++) {
    for (let x = 12; x <= 35; x++) {
      if (p.tagAt(x, y) === 'skin' && p.tagAt(x, y - 1) === 'hair') p.set(x, y, skin.shadow);
    }
  }
  p.tag = null;
}
