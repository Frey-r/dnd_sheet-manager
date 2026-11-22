/* Ten outfits on the three-quarter pose, each with a primary (P) and a secondary (Q) colour.
   0 túnica · 1 jubón · 2 camisa y chaleco · 3 abrigo largo · 4 vestido · 5 corsé y falda ·
   6 blusa y pantalón · 7 capa corta · 8 armadura ligera · 9 túnica de mago.
   Drawn in canonical body coordinates (painter.ts, CANON); any body and size can wear any outfit.

   Template keys (one character per pixel, '.' = nothing):
   P 1 hi 2 light 3 base 4 shadow 5 deep · Q 6 hi 7 light 8 base 9 shadow 0 deep
   gold Y G M L F (hi → deep) · W white glint · leather a b c e · metal i j m u v
   skin k K D · n ink (fold lines, as in the reference sprite). */
import { mix, ramp, type Ramp } from '../color';
import type { Painter } from '../painter';
import type { DrawCtx } from './context';

const LEATHER = ramp('#7a4a2a');
const DARK = ramp('#3b3242');
const METAL = ramp('#a3adba');

/** Upper body templates start at this row and column. */
const TOP_Y = 27;
const TOP_X = 8;

function keyMap(c: DrawCtx, P: Ramp, Q: Ramp): Record<string, string> {
  const s = c.skin;
  return {
    1: P.hi, 2: P.light, 3: P.base, 4: P.shadow, 5: P.deep,
    6: Q.hi, 7: Q.light, 8: Q.base, 9: Q.shadow, 0: Q.deep,
    // Gold trims use the reference's fixed gold ramp.
    Y: '#fdf780', G: '#fed958', M: '#f7b61f', L: '#eaa211', F: '#bd7720', W: '#eef8f4',
    a: LEATHER.light, b: LEATHER.base, c: LEATHER.shadow, e: LEATHER.deep,
    i: METAL.hi, j: METAL.light, m: METAL.base, u: METAL.shadow, v: METAL.deep,
    k: s.base, K: s.shadow, D: s.deep,
    n: mix(P.ink, '#201e1e', 0.7),
  };
}

/* Legs (from row 44): hips, the near leg straight under the weight, the far leg stepping out to the
   right; the far foot sits one row higher (further away). Digits are tones of the leg material. */
const LEG_X = 16;
const LEG_Y = 44;
const LEGS = [
  '.2333333334444',
  '.2334...23345',
  '.2334....2334',
  '.2334....2334',
  '.2334.....2334',
  '..234.....2334',
  '..234......234',
  '..234......2334',
  '..23334....23345',
  '..44555',
];

function legs(c: DrawCtx, pants: Ramp, boots: Ramp, bootH: number) {
  const top = 53 - bootH + 1;
  LEGS.forEach((row, j) => {
    const y = LEG_Y + j;
    const r = y >= top || j >= 8 ? boots : pants;
    for (let i = 0; i < row.length; i++) {
      const t = row[i];
      if (t === '.') continue;
      const cuff = bootH > 2 && y === top && t !== '5';
      c.p.set(LEG_X + i, y, cuff ? r.light : t === '2' ? r.light : t === '3' ? r.base : t === '4' ? r.shadow : r.deep);
    }
  });
}

/* Flowing elements in Q, behind the body, sweeping to the viewer's left like the reference's
   golden wing: 6 highlight edge, 7 light, 8 base, 9 shadow, 0 deep. */
const FLOW: Record<'wing' | 'scarf' | 'cape' | 'sash', { x: number; y: number; rows: string[] }> = {
  wing: {
    x: 0, y: 18,
    rows: [
      '78',
      '8778',
      '87768',
      '8776677',
      '977666677',
      '.9776666677',
      '.977766666677',
      '..97776666666788',
      '..977776666666677',
      '...9977776666666689',
      '.....97766666677669',
      '......99977666666677',
      '.........99966766667',
      '...........97777666',
      '........88877767766',
      '..8888888777777776',
      '..877777777777777',
      '...8777787777999',
      '....8777779999',
      '.....99999',
      '',
      '',
      '',
      '',
      '',
      '',
      '.......8.......8877',
      '.......87....897777',
      '........97778777777',
      '.........9977777799',
      '...........999999',
    ],
  },
  scarf: {
    x: 0, y: 21,
    rows: [
      '78',
      '8778',
      '87768',
      '987766',
      '.98776667',
      '.9987766667',
      '..99887766667',
      '....998877766677',
      '......99988877777',
      '.........9998888777',
      '............999888',
      '...............99',
    ],
  },
  cape: {
    x: 3, y: 29,
    rows: [
      '...........778888999',
      '.........7788888899900',
      '.......7788888888999000',
      '......77888888889990000',
      '.....778888888899900000',
      '....7788888888999000000',
      '...77888888889990000000',
      '...7888888889990000000',
      '..77888888899900000000',
      '..7888888899900000000',
      '.77888888999000000000',
      '.7888888899000000000',
      '7788888899000000000',
      '7888888899000000000',
      '788888889900000000',
      '788888899900000000',
      '78888889990000000',
      '7888888999000000',
      '.888888999000000',
      '.8888.8899..00',
      '..88...889',
    ],
  },
  sash: {
    x: 2, y: 37,
    rows: [
      '..........776',
      '.......7788877',
      '....77888889988',
      '..7788899990',
      '.7889990',
      '7899',
      '79',
      '',
      '......67',
      '....77887',
      '...788899',
      '..78890',
      '.789',
      '.79',
    ],
  },
};

function flow(p: Painter, kind: keyof typeof FLOW, Q: Ramp) {
  const f = FLOW[kind];
  p.stamp(f.x, f.y, f.rows, { 6: Q.hi, 7: Q.light, 8: Q.base, 9: Q.shadow, 0: Q.deep });
}

/** Far forearm cuff next to the raised hand. */
function farSleeve(p: Painter, r: Ramp) {
  p.stamp(31, 32, ['.3', '34', '45', '5.'], { 3: r.base, 4: r.shadow, 5: r.deep });
}

interface Outfit {
  top: string[];
  /** Extra template drawn after the legs (skirts and coat tails), from row `skirtY`. */
  skirt?: string[];
  skirtY?: number;
  pants: (P: Ramp, Q: Ramp) => Ramp;
  boots: (P: Ramp, Q: Ramp) => Ramp;
  bootH: number;
  flow: keyof typeof FLOW;
  sleeve: (P: Ramp, Q: Ramp) => Ramp;
}

const darker = (r: Ramp, k = 0.55) => ramp(mix('#151018', r.base, k));

const OUTFITS: Outfit[] = [
  { // 0 Túnica: belted tunic with a V neck and trimmed hem, trousers and short boots.
    top: [
      '..........2333KKKK334',
      '.........233338KK83344',
      '........23333338KK83344',
      '........233333338833444',
      '........2333333333333445',
      '.......23342333333333445',
      '......233423333333333445',
      '.....2334233333333433445',
      '....23344333333333433445',
      '....789.4333333333433445',
      '.....89..23333333334445',
      '.........abbbbbYMbbbbcc',
      '.........23333333334445',
      '........2333433333433445',
      '........2334333334334445',
      '.......233433333433334455',
      '.......778888888888889990',
    ],
    pants: (_P, Q) => darker(Q, 0.5), boots: () => LEATHER, bootH: 3, flow: 'scarf', sleeve: (P) => P,
  },
  { // 1 Jubón: doublet with puffed, slashed shoulders, gold buttons and a short peplum.
    top: [
      '..........7888KKKK889',
      '.........788888KK88899',
      '.......67888888888889990',
      '......6788878888888899900',
      '......7888788333333888999',
      '.......9884233M333333445',
      '......2334233333333333445',
      '.....233423333M333333445',
      '....2334433333333333445',
      '....789.4333333M33333445',
      '.....89..2333333333334445',
      '.........23333333M333445',
      '.........99999999999900',
      '........7888888888888999',
      '........78898888898889990',
      '.......00000000000000000',
      '',
    ],
    pants: (_P, Q) => darker(Q, 0.7), boots: () => DARK, bootH: 6, flow: 'scarf', sleeve: (P) => P,
  },
  { // 2 Camisa y chaleco: shirt with rolled sleeves, open vest and a neckerchief.
    top: [
      '..........7888KKKK889',
      '.........2338887788344',
      '........233333888833444',
      '........2333337887334445',
      '........2333337887334445',
      '.......7889233788733445',
      '......778923378873334445',
      '.....kkkK2333788733344',
      '....kkkKK3333788733344',
      '....kkK..3333788733344',
      '.....kK..33337887333445',
      '.........bbbbbbbbbbbcc',
      '.........33337887333445',
      '.........3333788733344',
      '.........3333788733344',
      '.........4444900944445',
      '',
    ],
    pants: () => ramp('#5a4636'), boots: () => LEATHER, bootH: 3, flow: 'scarf', sleeve: (_P, Q) => Q,
  },
  { // 3 Abrigo largo: long open coat with lapels, gold buttons and cuffs.
    top: [
      '..........8999KKKK990',
      '.........2799900K09944',
      '........23379990099344',
      '........233379900993444',
      '........2333379009933445',
      '.......2334233M00M334445',
      '......233423333000333445',
      '.....2334233M300M3334445',
      '....23344333330003334445',
      '....GLF.433333M00M334445',
      '.....LF..2333330003334445',
      '.........2333330003334445',
      '........23333333003334445',
      '........23334333003334445',
      '.......233343333003334455',
      '.......233433333003333455',
      '.......233433333..3333455',
    ],
    skirtY: 44,
    skirt: [
      '.......23343333...333455',
      '.......2343333.....33455',
      '......23343333.....33345',
      '......2343333.......3345',
      '......234333.........345',
      '.......4455...........55',
    ],
    pants: () => DARK, boots: () => DARK, bootH: 4, flow: 'cape', sleeve: (P) => P,
  },
  { // 4 Vestido: fitted bodice, sash and a long flared skirt with a trimmed hem.
    top: [
      '..........2333KKKK334',
      '.........23333KKKK3344',
      '........7883333KK33344',
      '.......78893333333334445',
      '.......78993333333334445',
      '........KK33333333334445',
      '......kKK423333333333445',
      '.....kkK42333333333445',
      '....kkK4.3333333333445',
      '....kK..43333333333445',
      '.........2333333333445',
      '.........778887788899',
      '.........97888889999',
      '........23333433333445',
      '........23334333343345',
      '.......2333433333433445',
      '.......2334333334333445',
    ],
    skirtY: 44,
    skirt: [
      '......233343333343333455',
      '......2334333334333334455',
      '.....23343333343333334455',
      '.....233433333433333344555',
      '....2334333334333333344555',
      '....2343333343333333344455',
      '....7788888888888888899990',
      '.....000000000000000000',
    ],
    pants: () => DARK, boots: (_P, Q) => darker(Q, 0.6), bootH: 2, flow: 'sash', sleeve: (_P, Q) => Q,
  },
  { // 5 Corsé y falda: blouse, laced corset and a knee skirt over leggings.
    top: [
      '..........7888KKKK889',
      '.........788888KK88899',
      '........78888888888889',
      '.......678887888888889',
      '.......788878888888899',
      '.......7889233333M33445',
      '......788923333M3M33445',
      '.....78892333333M333445',
      '....788993333M3M33345',
      '....789.4333333M333445',
      '.....89..33333M3M33445',
      '.........3333333M33445',
      '.........34444444444455',
      '........2333433333433445',
      '........2334333334334445',
      '.......233433333433334455',
      '.......233433333433333455',
    ],
    skirtY: 44,
    skirt: [
      '......23343333343333334455',
      '......23433333433333334455',
      '.....5555555555555555555555',
    ],
    pants: () => DARK, boots: () => LEATHER, bootH: 5, flow: 'scarf', sleeve: (_P, Q) => Q,
  },
  { // 6 Blusa y pantalón: loose blouse with a knotted sash, wide trousers.
    top: [
      '..........2333KKKK334',
      '.........23333KKKK3344',
      '........2333334KK433444',
      '........233333344333444',
      '........2333333433333445',
      '.......23342333333333445',
      '......2333423333333333445',
      '.....23334233333333433445',
      '....233344333333333433445',
      '....2334.4333333333433445',
      '.....344..2333333333334445',
      '.........7788888888899',
      '.........99999999998809',
      '........2333433333438890',
      '........23343333343338990',
      '.......233433333433334400',
      '.......2334333334333344',
    ],
    pants: (_P, Q) => Q, boots: () => LEATHER, bootH: 3, flow: 'sash', sleeve: (P) => P,
  },
  { // 7 Capa corta: shirt and belt under a short shoulder cape with a gold clasp.
    top: [
      '..........7888KKKK889',
      '.......77788888YM8888999',
      '.....7788888888ML88889999',
      '....778888888888888889990',
      '....7888888888888888899900',
      '....98888888888888888999000',
      '.....99998888888888899990',
      '.....2334999999999999445',
      '....23344333333333333445',
      '....789.4333333333333445',
      '.....89..23333333333445',
      '.........abbbbbYMbbbbcc',
      '.........23333333334445',
      '.........2333433334445',
      '.........2334333343445',
      '.........2344444444455',
      '',
    ],
    pants: (P) => darker(P, 0.45), boots: (_P, Q) => darker(Q, 0.55), bootH: 5, flow: 'cape', sleeve: (P) => P,
  },
  { // 8 Armadura ligera: breastplate and pauldrons over a padded coat, tabard and greaves.
    top: [
      '..........2333KKKK334',
      '.......ijjmmu333KK33mu',
      '......ijjmmmuuj33jmmuu',
      '.....ijmmmmuuijjmmmmuuv',
      '......jmmuuvijjmmmmmuuv',
      '.......2334ijjjmmmmmuuv',
      '......2334ijjmmmmmmmuuv',
      '.....2334.ijmmmmmmmuuv',
      '....imm44.jmmmmmmmuuv',
      '....jmu..43jmmmmmuu445',
      '.....mu..2333mmmmm3445',
      '.........abbbbbYMbbbbcc',
      '.........2333788883445',
      '........23334788883445',
      '........23343788883445',
      '.......2334437888833455',
      '.......2333449888994455',
    ],
    pants: (P) => darker(P, 0.6), boots: () => METAL, bootH: 5, flow: 'cape', sleeve: (P) => P,
  },
  { // 9 Túnica de mago: the reference robe, open over a lining, gold mantle and trims.
    top: [
      '..........nGFF8KKKK',
      '.........nGG5GF8nLnnn',
      '.........FLK55LL8MnFF',
      '.........LMWMFFLLYLnFn',
      '.........FLLFFnFWWWFnnn',
      '.......n5nnnnn5FMWWF3nF5',
      '......nFWFFn5555FFF53n53F',
      '.....nFFn5nn5335Ln5L3n5FL',
      '....nn5335n88335M35L4nnF',
      '....FLL335n88F88WFLnFn',
      '......LG5n5n8FF8WMWnFn',
      '.......Fnn558888LMWFnnn',
      '.......nn5555335FFFF335n',
      '.......n5553333LnLFnL33n',
      '....nnnn553333LFnLLnFG33n',
      '....nn555333MLn88nnn8FL3n',
      '....FF555FWLFn88nn887n8LLF',
      '....FFFFLFFnn88nnn8778nnLL',
      '.....FFW',
    ],
    pants: () => ramp('#3e2c30'), boots: () => ramp('#2c2228'), bootH: 2, flow: 'wing', sleeve: (P) => P,
  },
];

const outfitOf = (c: DrawCtx) => OUTFITS[Math.max(0, Math.min(OUTFITS.length - 1, c.a.outfit))];

/** Flowing element (behind the body), canonical coordinates. */
export function drawOutfitBack(c: DrawCtx, p: Painter) {
  p.tag = 'flow';
  flow(p, outfitOf(c).flow, c.cloth[1]);
  p.tag = null;
}

/** Legs, far sleeve and upper body, canonical coordinates. */
export function drawOutfitBody(c: DrawCtx, p: Painter) {
  const o = outfitOf(c);
  const [P, Q] = c.cloth;
  p.tag = 'cloth';
  legs({ ...c, p }, o.pants(P, Q), o.boots(P, Q), o.bootH);
  farSleeve(p, o.sleeve(P, Q));
  const map = keyMap(c, P, Q);
  p.stamp(TOP_X, TOP_Y, o.top, map);
  if (o.skirt) p.stamp(TOP_X, o.skirtY ?? 44, o.skirt, map);
  // The scarf wraps the neck in front of the collar.
  if (o.flow === 'scarf') p.stamp(17, 27, ['.7888', '799889', '.9900'], map);
  p.tag = null;
}
