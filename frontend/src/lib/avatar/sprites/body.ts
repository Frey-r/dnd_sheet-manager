/* Neck, hands, three-quarter heads and faces (character-appearance.md, "Face"). The face is turned to
   the viewer's right: the face plane is on the right of the skull, the back of the head (left) is
   under the hair. Clothes, hair and race parts are drawn on top. Light comes from the top left. */
import { mix, ramp } from '../color';
import { CANON, type Painter } from '../painter';
import { BONE, KERATIN } from '../palettes';
import { EYE_WHITE, INK, keys, type DrawCtx } from './context';

/** Skull rows of the human head (20 × 19, from the head box top-left). Pointed chin right of centre. */
export const HEAD_HUMAN = [
  '......llllbb',
  '....llllllbbbb',
  '...lllllbbbbbbbb',
  '..lllbbbbbbbbbbbbb',
  '.llbbbbbbbbbbbbbbbb',
  '.lbbbbbbbbbbbbbbbbbb',
  'lbbbbbbbbbbbbbbbbbbb',
  'lbbbbbbbbbbbbbbbbbbb',
  'lbbbbbbbbbbbbbbbbbbb',
  'sbbbbbbbbbbbbbbbbbbb',
  'sbbbbbbbbbbbbbbbbbbb',
  '.sbbbbbbbbbbbbbbbbbs',
  '..ssbbbbbbbbbbbbbbbs',
  '....ssbbbbbbbbbbbbs',
  '......sbbbbbbbbbbbs',
  '.......sbbbbbbbbbs',
  '.........sbbbbbbbs',
  '...........sbbbbs',
  '............sbbs',
];

/** Columns [x1, x2] of the human skull on row y (absolute), or null. */
export function skullSpan(c: DrawCtx, y: number): [number, number] | null {
  const row = HEAD_HUMAN[y - c.f.hy];
  if (!row) return null;
  const x1 = row.search(/[^.]/);
  return x1 < 0 ? null : [c.f.hx + x1, c.f.hx + row.length - 1];
}

/** Neck, in the shadow of the head (body layer, canonical coordinates). */
export function drawNeck(c: DrawCtx, p: Painter) {
  const s = c.skin;
  p.tag = 'skin';
  p.rect(CANON.neckX - 1, 26, 4, 4, s.shadow);
  p.hline(CANON.neckX - 1, CANON.neckX + 2, 27, s.deep);
  p.tag = null;
}

/** Both hands, over the cuffs and the prop (body layer, canonical coordinates). */
export function drawHands(c: DrawCtx, p: Painter) {
  const s = c.skin;
  p.tag = 'skin';
  // Near hand: open, fingers down and out (cuff at its top right).
  p.stamp(9, 36, ['..b...', '.blbd.', 'blsbbs', 'bsbssb', '.ss...'], keys(s));
  // Far hand: a fist at shoulder height, gripping the prop.
  p.stamp(33, 32, ['s...', '.lbs', '.lsb', '.bsb', '.ss.'], keys(s));
  p.tag = null;
}

/** Plain human ear on the near side (mostly hidden by hair). */
export function drawPlainEar(c: DrawCtx) {
  const { p, f, skin, parts, v } = c;
  if (v.head !== 'human') return;
  for (const part of parts) if (part.startsWith('ears-')) return;
  p.tag = 'skin';
  p.stamp(f.hx + 5, f.eyeY, ['.lb', 'lsb', 'bsb', '.bs'], keys(skin));
  p.tag = null;
}

function skull(c: DrawCtx, rows: readonly string[] = HEAD_HUMAN, r = c.skin) {
  c.p.stamp(c.f.hx, c.f.hy, rows, keys(r));
}

/** Head shape plus snout, beak or trunk (all pointing right). Eyes and mouth are drawn by drawFace. */
export function drawHead(c: DrawCtx) {
  const { p, f, v, skin } = c;
  const { hx, hy, eyeY } = f;
  p.tag = 'skin';
  switch (v.head) {
    case 'beast': {
      skull(c);
      // Fur tufts along the back of the jaw and a pale muzzle pointing right with a dark nose.
      p.stamp(hx + 2, hy + 12, ['bs....', '.bbs..', 'bsbbs.', '.bsbbs', '..sbbb'], keys(skin));
      const m = ramp(mix(skin.base, '#fff4e0', 0.45));
      p.stamp(hx + 14, eyeY + 2, [
        '..lbbbb',
        '.lbbbbbbk',
        'lbbbbbbkk',
        'bbbbbbbs.',
        '.sbbbbs..',
        '..ssss...',
      ], keys(m, { k: INK }));
      p.dots([[hx + 19, eyeY + 5], [hx + 18, eyeY + 6]], skin.deep);
      break;
    }
    case 'beak': {
      skull(c);
      // Feather tuft on the crown, ruffled cheeks, beak pointing right.
      p.stamp(hx + 3, hy - 3, ['..l..l', '.lb.lbs', 'lbbsbbbs'], keys(skin));
      p.stamp(hx + 3, hy + 13, ['bs...', '.bs..', 'sbbs.', '.sbbs'], keys(skin));
      const beak = ramp(v.key === 'kenku' ? '#4a4a56' : KERATIN);
      p.stamp(hx + 15, eyeY + 2, [
        '.lbb',
        'lbbbbb',
        'lbbbbbbs',
        'ddddddd',
        'sbbbs',
        '.ss',
      ], keys(beak));
      break;
    }
    case 'reptile': {
      skull(c);
      // Long flat snout pointing right, heavy brow, wide jaw.
      p.stamp(hx + 12, eyeY - 1, [
        'sssss',
        'bbbbbbbbl',
        'bbbbbbbbbbl',
        'bbbbbbbbbbbs',
        'bbbbbbbbbbbk',
        'dddddddddds',
        'bbbbbbbbbs',
        'sbbbbbbs',
        '.ssss',
      ], keys(skin, { k: INK }));
      const belly = ramp(mix(skin.base, '#f2e6c0', 0.45));
      p.hline(hx + 13, hx + 20, eyeY + 6, belly.base);
      p.hline(hx + 13, hx + 18, eyeY + 7, belly.shadow);
      p.dots([[hx + 9, hy + 3], [hx + 11, hy + 5], [hx + 7, hy + 6]], skin.light);
      break;
    }
    case 'elephant': {
      // Big ear behind the skull on the left, then the trunk curling down on the right.
      const ear = ramp(mix(skin.base, '#000000', 0.08));
      p.stamp(hx - 8, hy + 2, [
        '...lbbbbb',
        '.lbbbbbbbb',
        'lbbssssbbb',
        'lbsddddsbb',
        'lbsddddsbb',
        'lbsddddsbb',
        'lbsddddsbb',
        'lbbssssbb',
        '.lbbbbbbb',
        '..lbbbbbb',
        '...bbbbb',
        '....sss',
      ], { ...keys(ear), d: mix(ear.shadow, '#c98a8a', 0.35) });
      skull(c);
      p.stamp(hx + 14, eyeY + 2, [
        'lbbs',
        'lbbbs',
        '.lbbs',
        '.lbbs',
        '..lbbs',
        '..lbbs',
        '...lbs',
        '..sbbs',
        '..ss',
      ], keys(skin));
      p.dots([[hx + 16, eyeY + 4], [hx + 17, eyeY + 7]], skin.shadow);
      break;
    }
    case 'insect': {
      skull(c);
      p.dots([[hx + 6, hy + 1], [hx + 5, hy + 2]], skin.hi);
      // Mandibles under the chin.
      p.stamp(hx + 12, hy + 17, ['s..s', 'ds.ds', '.d..d'], keys(skin));
      break;
    }
    case 'skull': {
      skull(c);
      // Cheekbone, nose hole and teeth.
      p.dots([[hx + 9, eyeY + 4], [hx + 10, eyeY + 5]], skin.shadow);
      p.stamp(hx + 16, eyeY + 4, ['k', 'kk'], { k: INK });
      p.stamp(hx + 11, hy + 15, ['bbbbbbb', 'kbkbkbk', '.skbks'], { b: BONE, k: INK, s: skin.shadow });
      break;
    }
    case 'fish': {
      skull(c);
      // Blunt wide jaw pushed to the right, cheek fin on the near side.
      p.stamp(hx + 11, eyeY + 3, [
        '.bbbbbbbb',
        'bbbbbbbbbs',
        'bbbbbbbbbs',
        'dddddddds',
        'sbbbbbbs',
        '.sssss',
      ], keys(skin));
      p.hline(hx + 12, hx + 18, eyeY + 7, mix(skin.base, '#e08a8a', 0.4));
      p.stamp(hx + 3, eyeY - 1, ['l..', 'lb.', 'lbs', 'bbs', '.s.'], keys(c.hair));
      break;
    }
    case 'frog': {
      // Wide flat head with the eye bumps on top.
      p.stamp(hx, hy + 3, [
        '.....lllbbbb',
        '...lllbbbbbbbbbbb',
        '.llbbbbbbbbbbbbbbbbb',
        'lbbbbbbbbbbbbbbbbbbbb',
        'lbbbbbbbbbbbbbbbbbbbbb',
        'lbbbbbbbbbbbbbbbbbbbbb',
        'sbbbbbbbbbbbbbbbbbbbbs',
        '.sbbbbbbbbbbbbbbbbbbs',
        '..sddddddddddddddddd',
        '...bbbbbbbbbbbbbbbb',
        '....sbbbbbbbbbbbbs',
        '......ssssssssss',
      ], keys(skin));
      p.ellipse(hx + 8.5, hy + 3, 3, 2.6, skin.base);
      p.ellipse(hx + 8, hy + 2.5, 1.8, 1.4, skin.light);
      p.ellipse(hx + 17, hy + 3.5, 2.4, 2.2, skin.shadow);
      const belly = mix(skin.base, '#f2e6c0', 0.5);
      p.hline(hx + 6, hx + 18, hy + 13, belly);
      break;
    }
    case 'ooze': {
      skull(c);
      p.ellipse(hx + 13, eyeY + 4, 4, 3, `${skin.shadow}cc`);
      p.dots([[hx + 5, hy + 2], [hx + 6, hy + 2], [hx + 5, hy + 3], [hx + 4, hy + 5]], skin.hi);
      p.dots([[hx + 4, hy + 15], [hx + 5, hy + 16], [hx + 18, hy + 14], [hx + 18, hy + 15]], skin.base);
      break;
    }
    default:
      skull(c);
  }
  p.tag = null;
}

/** Eye colour keys: k lash, w white, h highlight, d/i/l iris dark → light. */
function eyeMap(c: DrawCtx, glow: boolean): Record<string, string> {
  const { eyes } = c;
  return glow
    ? { k: INK, w: eyes.hi, h: '#ffffff', d: eyes.base, i: eyes.light, l: eyes.hi }
    : { k: INK, w: EYE_WHITE, h: '#ffffff', d: eyes.ink, i: eyes.shadow, l: eyes.light };
}

/*
 * Small eyes, low on the face. Near eye 4 × 4 (lash longer at the outer corner on the left, iris dark
 * → light, a white highlight); far eye 3 px wide close to the right edge of the face.
 */
const NEAR_EYE = ['kkkk', 'kddi', '.idh', '.ll.'];
const FAR_EYE = ['kkk', 'hdk', 'il.'];

/** Eyes, brows, nose and mouth for each head type. */
export function drawFace(c: DrawCtx) {
  const { p, f, a, v, skin, parts, hair, eyes } = c;
  const { hx, eyeY } = f;
  const glow = parts.has('glow-eyes');
  const map = eyeMap(c, glow);
  const nearX = hx + 8;
  const farX = hx + 16;
  p.tag = 'eye';

  if (parts.has('cyclops')) {
    p.stamp(hx + 11, eyeY - 1, ['.kkkk.', 'kkddhk', 'wdiddw', '.wlll.'], map);
    p.hline(hx + 10, hx + 17, eyeY - 3, skin.shadow);
    p.hline(hx + 13, hx + 14, f.mouthY, skin.deep);
    p.tag = null;
    return;
  }
  switch (v.head) {
    case 'skull':
      p.stamp(nearX, eyeY, ['.kk.', 'kkkk', 'kkkk', '.kk.'], { k: INK });
      p.stamp(farX, eyeY, ['kk.', 'kkk', '.k.'], { k: INK });
      if (glow) {
        p.stamp(nearX + 1, eyeY + 1, ['hi', 'il'], { h: '#ffffff', i: eyes.hi, l: eyes.light });
        p.set(farX + 1, eyeY + 1, eyes.hi);
      }
      break;
    case 'insect':
      p.stamp(nearX - 1, eyeY - 2, ['.ddd.', 'dhsid', 'dsiid', 'diild', '.ddd.'],
        { d: eyes.deep, s: eyes.shadow, i: glow ? eyes.hi : eyes.base, l: eyes.light, h: '#ffffff' });
      p.stamp(farX + 1, eyeY - 1, ['dd.', 'hid', 'iid', 'dd.'], { d: eyes.deep, i: glow ? eyes.hi : eyes.base, h: '#ffffff' });
      break;
    case 'fish':
      p.stamp(nearX - 1, eyeY - 1, ['.www.', 'whddw', 'wdiiw', 'wilhw', '.www.'], map);
      p.stamp(farX + 2, eyeY, ['ww', 'dh', 'iw'], map);
      break;
    case 'frog':
      p.stamp(hx + 6, f.hy + 1, ['.kkk.', 'khddk', 'kdiik', 'kiilk', '.kkk.'], map);
      p.stamp(hx + 16, f.hy + 2, ['kkk', 'hdk', 'ilk', 'kk.'], map);
      break;
    case 'reptile':
      p.stamp(nearX, eyeY, ['kkkk', 'hdkd', 'iiki', '.lk.'], map);
      p.stamp(farX, eyeY, ['kkk', 'dkh', 'ik.'], map);
      break;
    default: {
      p.stamp(nearX, eyeY, NEAR_EYE, map);
      p.stamp(farX, eyeY, FAR_EYE, map);
      // Body B: outer lash flick.
      if (a.body === 1) { p.set(nearX - 1, eyeY, INK); p.set(farX + 3, eyeY, INK); }
      // Brows only show without hair (bangs cover them otherwise).
      if (v.head === 'human' && (!v.hair || a.hair === 0)) {
        p.tag = 'brow';
        p.hline(nearX, nearX + 3, eyeY - 2, hair.deep);
        p.hline(farX, farX + 2, eyeY - 2, hair.deep);
      }
      if (v.head === 'human' || v.head === 'ooze') {
        const bearded = parts.has('beard-full') || parts.has('beard-braided') || parts.has('beard-short');
        p.tag = 'skin';
        p.set(hx + 15, eyeY + 5, skin.shadow);
        p.dots([[nearX, eyeY + 4], [nearX + 1, eyeY + 4]], mix(skin.base, '#ff8a8a', 0.22));
        if (!bearded) {
          p.hline(hx + 13, hx + 14, f.mouthY, skin.deep);
          if (a.body === 1) p.set(hx + 14, f.mouthY, mix(skin.shadow, '#c0505a', 0.35));
        }
      }
    }
  }
  p.tag = null;
}

/** Skin pixels right under the hair (or a hat) get the shadow tone. */
export function castHairShadow(c: DrawCtx) {
  const { p, f, skin } = c;
  p.tag = 'shade';
  for (let y = f.hy + 1; y <= f.chinY; y++) {
    for (let x = f.hx - 2; x <= f.hx + 22; x++) {
      if (p.tagAt(x, y) === 'skin' && p.tagAt(x, y - 1) === 'hair') p.set(x, y, skin.shadow);
    }
  }
  p.tag = null;
}
