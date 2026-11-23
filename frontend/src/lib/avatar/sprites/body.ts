/* Neck, hands, heads and faces of the HD-2D avatar (character-appearance.md § Art direction → Face).
   Front three-quarter view turned to the viewer's left: the face plane fills the left two thirds of
   the skull, the ear and the back of the head (under the hair) the right third. Light from the top
   left. Clothes, hair and race parts are drawn on top. */
import { mix, ramp, type Ramp } from '../color';
import { CANON, type Painter } from '../painter';
import { BONE, KERATIN } from '../palettes';
import { EYE_WHITE, INK, keys, type DrawCtx } from './context';

/*
 * Human skull, 15 × 18 from the skull box (CANON.hx, CANON.hy): a big rounded head for the
 * super-deformed figure. Face plane (tag 'face'): l b s, light → shadow. Scalp and back of the head
 * (tag 'scalp', under the hair): L C S. The ear is drawn apart (drawPlainEar) over the scalp at
 * columns 10–11, rows 10–13, so race ears can replace it. Eyes on rows 10–11, nose on row 13, mouth
 * on row 15; the chin narrows over rows 16–17.
 */
const HEAD_HUMAN = [
  '....LLLCCCS....',
  '..LLLCCCCCCCS..',
  '.LLLCCCCCCCCCS.',
  'lllllllllbCCCCS',
  'lllllllllbCCCCS',
  'lllllllllbCCCSS',
  'lllllllllbCCSSS',
  'lllllllllbCSSSS',
  'lllllllllbSSSSS',
  'lllllllllbSSSSS',
  'lllllllllbSSSSS',
  'lllllllllbSSSS.',
  'lllllllllbSSS..',
  'lllllllllbSS...',
  'llllllllb......',
  'bllllllb.......',
  '.bllllb........',
  '..bbbbb........',
];

/** Face plane columns of the skull (0–9) and the rows of the eyes, nose, mouth and chin. */
export const FACE_COLS = 10;
const EYE_ROW = 10;
const NOSE_ROW = 13;
const MOUTH_ROW = 15;

const HEAD_TAGS: Record<string, string> = { h: 'face', l: 'face', b: 'face', s: 'face', d: 'face', L: 'scalp', C: 'scalp', S: 'scalp' };

function skullKeys(r: Ramp): Record<string, string> {
  return { h: r.hi, l: r.light, b: r.base, s: r.shadow, d: r.deep, L: r.light, C: r.base, S: r.shadow };
}

/* Neck in the shadow of the jaw, behind the head (body layer, canonical coordinates). */
const NECK = [
  '.bss',
  'bsss',
  '.ss.',
];

export function drawNeck(c: DrawCtx, p: Painter) {
  p.tag = 'skin';
  p.stamp(CANON.neckX + 1, CANON.torsoTop - 3, NECK, keys(c.skin));
  p.tag = null;
}

/* Hands by the hips (body layer, canonical coordinates): the far one open and relaxed, the near one a
   fist that grips the prop (drawn over its shaft). */
const FAR_HAND = ['llb', 'lbs', 'bbs'];
const NEAR_HAND = ['llb', 'lbs', 'bss'];

export function drawHands(c: DrawCtx, p: Painter) {
  p.tag = 'skin';
  p.stamp(CANON.farHand.x - 1, CANON.farHand.y - 1, FAR_HAND, keys(c.skin));
  p.stamp(CANON.nearHand.x - 1, CANON.nearHand.y - 1, NEAR_HAND, keys(c.skin));
  p.tag = null;
}

/* Plain human ear between the face plane and the back of the head (mostly framed by the hair). */
const EAR = ['bs', 'ls', 'bs', 'ss'];

export function drawPlainEar(c: DrawCtx) {
  const { p, f, skin, parts, v } = c;
  if (v.head !== 'human') return;
  for (const part of parts) if (part.startsWith('ears-')) return;
  p.tag = 'ear';
  p.stamp(f.hx + FACE_COLS, f.hy + EYE_ROW, EAR, keys(skin));
  p.tag = null;
}

function skull(c: DrawCtx, rows: readonly string[] = HEAD_HUMAN, r = c.skin) {
  c.p.stamp(c.f.hx, c.f.hy, rows, skullKeys(r), false, HEAD_TAGS);
}

/*
 * Non-human heads (character-appearance.md § Art direction → Face). Same skull box, eye rows and
 * three-quarter turn as the human head: the face looks to the viewer's left, so snouts, beaks, trunks
 * and jaws come out of the lower face towards the left, and the nape (right) is darker. Templates
 * start HEAD_DX columns left of the skull box (column 0 = hx − 4) so a snout fits in front of the
 * face; nothing is wider than the human hair plus 2 px. Keys: h highlight, l light, b base, s shadow,
 * d deep of the head colour; m/n light and shaded muzzle, throat or belly; k ink (nose, nostril,
 * gape); q nose; o mouth; w bone or tooth; p pink (inner ear, lips).
 */
const HEAD_DX = -4;

/* Round cranium shared by the non-human heads (rows 0–11): a dome lit from the top left, the
   terminator curving round the near side and a deep band on the nape. */
const CRANIUM = [
  '.........hllbs......',
  '.......hhlllbbs.....',
  '......hhhllllbbs....',
  '.....lhhhllllbbbs...',
  '.....llhhllllbbbsd..',
  '....blhhhllllbbbss..',
  '....llhhhllllbbbssd.',
  '....lllhlllllbbbssd.',
  '....lllllllllbbbssd.',
  '....llllllllbbbsssd.',
  '....bllllllbbbbssdd.',
  '....bbllllbbbbsssdd.',
];

/* Lower half of each head (from row 12): jaw, snout, beak or trunk. */
const LOWER: Record<string, readonly string[]> = {
  // Furred jaw: full round cheeks, the chin shaded from above.
  beast: [
    '....sbbbbbbbbbsssdd.',
    '....sbbbbbbbbsssdd..',
    '.....sbbbbbbsssdd...',
    '......ssbbbbsssd....',
    '.......ssssssdd.....',
    '.........dddd.......',
  ],
  // Birds: pale throat feathers under the beak.
  bird: [
    '....mmmmmbbbbsssdd..',
    '....mmmmmmbbsssdd...',
    '.....nmmmmmbssdd....',
    '......nmmmmbssd.....',
    '.......nnnnssd......',
    '.........sss........',
  ],
  // Dragon: lit snout top, 1-px nostril, the gape curving up at the cheek, pale lower jaw.
  dragon: [
    '..hllllbbbbbbsssdd..',
    '.hkllllbbbbbbssdd...',
    'hllbbbbbbbbbbsdd....',
    'koooooooobbbssd.....',
    '.mmmmmmmnbbssd......',
    '...nnnnnnsss........',
  ],
  // Kobold: the same snout one pixel shorter.
  kobold: [
    '...hlllbbbbbbsssdd..',
    '..hkllllbbbbbssdd...',
    '.hllbbbbbbbbbsdd....',
    '.kooooooobbbssd.....',
    '..mmmmmmnbbssd......',
    '....nnnnnsss........',
  ],
  // Lizard: a flatter, longer snout and a heavier jaw.
  lizard: [
    '.hhlllllbbbbbsssdd..',
    'hkllllllbbbbbssdd...',
    'lbbbbbbbbbbbbsdd....',
    'koooooooooobssd.....',
    'nmmmmmmmmnbbsd......',
    '..nnnnnnnsss........',
  ],
  // Turtle: short rounded snout with a horny beak edge and a wrinkled throat.
  turtle: [
    '...hllllbbbbbbsssd..',
    '..hkllllbbbbbbssd...',
    '..lbbbbbbbbbbbsdd...',
    '..wwkooooobbbssd....',
    '...mmmmmmmnbssd.....',
    '....nmnmnmsss.......',
  ],
  // Elephant: heavy jaw; the trunk falls from the centre-left of the face over the chest.
  elephant: [
    '....sbblllbbbbsssdd.',
    '....sbblllbbbbssdd..',
    '.....sblllbbbsssd...',
    '......slllbbsssd....',
    '......slllbssdd.....',
    '......slllb.........',
    '.....slllb..........',
    '....sllbb...........',
    '....bbbs............',
  ],
  // Insect: narrow chitin jaw, mandibles hooking to the lower left.
  insect: [
    '....sbbbbbbbbbsssdd.',
    '.....sbbbbbbbsssdd..',
    '...ll.sbbbbbbssdd...',
    '..lbbs.ssssssdd.....',
    '..bs...sbs..........',
    '..s.................',
  ],
  // Skull: cheekbone, nasal hole, upper teeth and the jaw jutting to the left.
  skull: [
    '....sbbbbbbbbbsssd..',
    '....sbbbkbbbbssdd...',
    '....dssssssssdd.....',
    '...wkwkwkwkwsd......',
    '...bwbwbwbwbs.......',
    '....bbbbbbs.........',
  ],
  // Fish: a round pouting mouth at the left, gill slits on the cheek, pale throat.
  fish: [
    '...lbbbbbdbbbsssdd..',
    '..plbbbbdbbbbssdd...',
    '.pkpbbbbdbbbssdd....',
    '..pmmmmmmmbbsdd.....',
    '...nmmmmmmbsdd......',
    '.....nnnnsss........',
  ],
  // Ooze: the blob sags over the shoulders and drips under the jaw.
  ooze: [
    '....sbbbbbbbbbsssdd.',
    '...lsbbbbbbbbbssddd.',
    '...bssbbbbbbbsssddd.',
    '...bsssssssssssdddd.',
    '....ss.sddddsd..dd..',
    '.....s...dd.....d...',
  ],
};

const LOWER_OF: Record<string, string> = { kobold: 'kobold', lizardfolk: 'lizard', tortle: 'turtle' };

/* Muzzles over the beast jaw, from row 11: the bridge under the eyes, the nose at the tip (left). */
const MUZZLE: Record<string, readonly string[]> = {
  cat: [
    '....................',
    '...mmmm.............',
    '..qmmmmn............',
    '..mmmmmnn...........',
    '...onnnn............',
    '....nn..............',
  ],
  dog: [
    '...ll...............',
    '.llllmm.............',
    'kmmmmmmn............',
    '.mmmmmmnn...........',
    '.ooonnnn............',
    '..nnnnn.............',
  ],
  fox: [
    '....................',
    '..lll...............',
    'klmmmmn.............',
    '.mmmmnn.............',
    '..oonn..............',
    '...n................',
  ],
  bear: [
    '....................',
    '..mmmm..............',
    '.kkmmmmn............',
    '.mmmmmmnn...........',
    '..oommnn............',
    '...nnnn.............',
  ],
  bull: [
    '...ll...............',
    '..llmm..............',
    '.mmmmmmn............',
    'kmmmmmmnn...........',
    'mmmmmmnn............',
    '.ooonnn.............',
    '..nnnn..............',
  ],
  rabbit: [
    '....................',
    '....................',
    '..qmmm..............',
    '...mmmn.............',
    '...onn..............',
  ],
  mouse: [
    '....................',
    '...ll...............',
    '.qlmmmn.............',
    '..mmmmn.............',
    '...onn..............',
  ],
  deer: [
    '....................',
    '..lll...............',
    '.klmmmn.............',
    '..mmmmn.............',
    '...onn..............',
    '....n...............',
  ],
};

const MUZZLE_OF: Record<string, string> = {
  tabaxi: 'cat', leonin: 'cat', gnoll: 'dog', fox: 'fox', bear: 'bear', raccoon: 'fox',
  minotaur: 'bull', harengon: 'rabbit', rodent: 'mouse', cervan: 'deer',
};

/* Beaks from the centre-left of the face (row 11): crow, hooked raptor, small owl hook. */
const BEAK: Record<string, readonly string[]> = {
  crow: [
    '....................',
    '....lbb.............',
    '..llbbbbs...........',
    'lkkkkkkks...........',
    '..sbbbbs............',
  ],
  raptor: [
    '....................',
    '...lbbb.............',
    '..lbbbbbs...........',
    '.lbkkkkks...........',
    '.b.sbbbs............',
  ],
  owl: [
    '....................',
    '........lb..........',
    '........bs..........',
    '.........s..........',
  ],
};
const BEAK_OF: Record<string, string> = { kenku: 'crow', aarakocra: 'raptor', owlin: 'owl' };
/* Three nape feathers swept back (to the right), for every bird. */
const NAPE_FEATHERS = [
  '................sbs.',
  '...............sbbsd',
  '.................sbd',
  '..................sd',
];

/* Reptile brow ridge over the eyes (rows 8–9). */
const BROW = ['....hhh..hhh........', '....sss.ssss........'];

/* Elephant ears from row 1: the near one (viewer's right) a big flap over the side of the head, out
   past the skull; the far one peeking behind the face at the left. */
const ELEPHANT_EARS = [
  '..............lbbs..',
  '............llbbbbs.',
  '...........lbpppbbsd',
  '...b.......lppppbbsd',
  '..lb.......lppppbbsd',
  '..lb.......lppppbbsd',
  '..lb.......lppppbsd.',
  '..lb.......lpppbbsd.',
  '...b.......lppbbbsd.',
  '...........lbbbbssd.',
  '...........lbbbssd..',
  '............bbsdd...',
  '.............dd.....',
];

/* Frog: wide flat head with the eyes on two bumps (from row 2), a wide gape and a pale throat. */
const FROG = [
  '...........hhlb.......',
  '...hlb....hhllbbs.....',
  '..hllbs..hlllllbbs....',
  '..lllbbbblllllbbbs....',
  '.hllllllllllllbbbss...',
  'hllllllllllllllbbbss..',
  'llllllllllllllbbbsss..',
  'lllllllllllllbbbbsss..',
  'llllllllllllbbbbssss..',
  'bbbllllllllbbbbsssdd..',
  'kkkkkkkkkkkkkkksssdd..',
  '.mmmmmmmmmmmmmsssdd...',
  '..mmmmmmmmmmmnssdd....',
  '...nnmmmmmmnnssd......',
  '.....nnnnnnnss........',
];
/** Frog eyes, one row under the top of each bump (column 0 = hx, row 0 = hy): a glint over the iris and pupil. */
const FROG_EYE = ['wk', 'ik', 'kd'];
const FROG_EYE_AT = { far: { x: 0, y: 4 }, near: { x: 8, y: 3 } };

/** Head shape plus snout, beak or trunk. Eyes and mouth are drawn by drawFace. */
export function drawHead(c: DrawCtx) {
  const { p, f, v, skin } = c;
  const { hx, hy } = f;
  const x0 = hx + HEAD_DX;
  p.tag = 'face';
  if (v.head === 'human') {
    skull(c);
    p.tag = null;
    return;
  }
  const pale = ramp(mix(skin.base, '#fff4e0', 0.5));
  const k = keys(skin, {
    m: pale.light, n: pale.shadow, k: INK, q: mix(skin.deep, '#c04a5a', 0.45), o: skin.deep, w: BONE,
    p: mix(skin.base, '#f0a0a0', 0.55),
  });
  if (v.head === 'frog') {
    p.stamp(x0, hy + 2, FROG, k);
    p.tag = null;
    return;
  }
  p.stamp(x0, hy, CRANIUM, k);
  switch (v.head) {
    case 'beast':
      p.stamp(x0, hy + 12, LOWER.beast, k);
      p.stamp(x0, hy + 11, MUZZLE[MUZZLE_OF[v.key] ?? 'cat'], k);
      break;
    case 'beak': {
      const kind = BEAK_OF[v.key] ?? 'crow';
      p.stamp(x0, hy + 12, kind === 'owl' ? LOWER.beast : LOWER.bird, k);
      p.stamp(x0, hy + 2, NAPE_FEATHERS, k);
      const beak = ramp(v.key === 'kenku' ? '#4a4a56' : KERATIN);
      p.stamp(x0, hy + 11, BEAK[kind], keys(beak, { k: beak.deep }));
      break;
    }
    case 'reptile':
      p.stamp(x0, hy + 12, LOWER[LOWER_OF[v.key] ?? 'dragon'], k);
      p.stamp(x0, hy + 8, BROW, k);
      break;
    case 'elephant':
      p.stamp(x0, hy + 12, LOWER.elephant, k);
      p.stamp(x0, hy + 1, ELEPHANT_EARS, { ...k, p: mix(skin.shadow, '#c98a8a', 0.35) });
      break;
    case 'fish':
      p.stamp(x0, hy + 12, LOWER.fish, { ...k, p: mix(skin.base, '#e0707a', 0.6) });
      break;
    default:
      p.stamp(x0, hy + 12, LOWER[v.head], k);
  }
  p.tag = null;
}

/** Eye colour keys: k lash, w white, d/i/l iris dark → light. */
function eyeMap(c: DrawCtx, glow: boolean): Record<string, string> {
  const { eyes } = c;
  return glow
    ? { k: INK, w: eyes.hi, d: eyes.base, i: eyes.light, l: eyes.hi }
    : { k: INK, w: EYE_WHITE, d: INK, i: eyes.base, l: eyes.light };
}

/*
 * Small eyes, 2 × 3, the same template for both (D-0033): a near-black lash row, the iris on the diagonal and one light
 * pixel at the bottom right. The far eye (the character's right, on the viewer's left) sits one pixel from the edge of
 * the face; the near one leaves a three-pixel gap.
 */
const EYE = ['kk', 'di', 'il'];
/* Eyes of the other heads, also one template for both eyes (2 × 2–3): the cyclops' single central eye, empty skull
   sockets, glossy insect eyes, round fish eyes with a white, slit reptile pupils. */
const CYCLOPS_EYE = ['kk', 'di'];
const SOCKET = ['kk', 'kk'];
const SOCKET_MAP = { k: INK };
const INSECT_EYE = ['dd', 'di', 'li'];
const FISH_EYE = ['kw', 'id'];
const REPTILE_EYE = ['kk', 'ki'];
const FAR_EYE_DX = 1;
const NEAR_EYE_DX = 6;

/** Both eyes from one template at the far and near eye columns, so they are always identical. */
function eyePair(p: Painter, hx: number, y: number, rows: readonly string[], map: Record<string, string>) {
  p.stamp(hx + FAR_EYE_DX, y, rows, map);
  p.stamp(hx + NEAR_EYE_DX, y, rows, map);
}

/** Eyes, brows, nose and mouth for each head type. */
export function drawFace(c: DrawCtx) {
  const { p, f, a, v, skin, parts, hair, eyes } = c;
  const { hx, eyeY } = f;
  const glow = parts.has('glow-eyes');
  const map = eyeMap(c, glow);
  const farX = hx + FAR_EYE_DX;
  const nearX = hx + NEAR_EYE_DX;
  p.tag = 'eye';

  if (parts.has('cyclops')) {
    p.stamp(hx + 3, eyeY, CYCLOPS_EYE, map);
    p.tag = 'face';
    p.hline(hx + 2, hx + 5, eyeY - 2, skin.shadow);
    p.hline(hx + 3, hx + 4, f.mouthY, skin.deep);
    p.tag = null;
    return;
  }
  switch (v.head) {
    case 'skull':
      eyePair(p, hx, eyeY, SOCKET, SOCKET_MAP);
      if (glow) {
        p.hline(farX, farX + 1, eyeY + 1, eyes.hi);
        p.hline(nearX, nearX + 1, eyeY + 1, eyes.hi);
      }
      break;
    case 'insect':
      eyePair(p, hx, eyeY - 1, INSECT_EYE, { d: eyes.deep, i: glow ? eyes.hi : eyes.base, l: eyes.light });
      break;
    case 'fish':
      eyePair(p, hx, eyeY, FISH_EYE, map);
      break;
    case 'frog':
      p.stamp(hx + FROG_EYE_AT.far.x, f.hy + FROG_EYE_AT.far.y, FROG_EYE, map);
      p.stamp(hx + FROG_EYE_AT.near.x, f.hy + FROG_EYE_AT.near.y, FROG_EYE, map);
      break;
    case 'reptile':
      eyePair(p, hx, eyeY, REPTILE_EYE, map);
      break;
    default: {
      eyePair(p, hx, eyeY, EYE, map);
      // Brows only show without hair (bangs cover them otherwise).
      if (v.head === 'human' && (!v.hair || a.hair === 0)) {
        p.tag = 'face';
        p.hline(farX, farX + 1, eyeY - 2, hair.deep);
        p.hline(nearX, nearX + 1, eyeY - 2, hair.deep);
      }
      if (v.head === 'human' || v.head === 'ooze') {
        const bearded = parts.has('beard-full') || parts.has('beard-braided') || parts.has('beard-short');
        p.tag = 'face';
        // Nose: one shadow pixel under the gap between the eyes, on the side away from the light.
        p.set(hx + 4, f.hy + NOSE_ROW, skin.base);
        if (!bearded) p.set(hx + 4, f.hy + MOUTH_ROW, a.body === 1 ? mix(skin.shadow, '#b04a50', 0.35) : skin.shadow);
      }
    }
  }
  p.tag = null;
}

const HEAD_SKIN = new Set(['face', 'ear', 'scalp']);

/** Head skin right under the hair (or a hat) goes one tone darker: the bangs cast it on the forehead. */
export function castHairShadow(c: DrawCtx) {
  const { p, f, skin } = c;
  for (let y = f.hy + 1; y <= f.chinY; y++) {
    for (let x = f.hx - 2; x <= f.hx + 15; x++) {
      const t = p.tagAt(x, y);
      if (!t || !HEAD_SKIN.has(t) || p.tagAt(x, y - 1) !== 'hair') continue;
      const now = p.get(x, y);
      p.tag = t;
      if (now === skin.light) p.set(x, y, skin.base);
      else if (now === skin.base) p.set(x, y, skin.shadow);
    }
  }
  p.tag = null;
}
