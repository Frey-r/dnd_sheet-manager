/* Twelve hair styles (0 bald … 11 wavy) for the three-quarter head. Any body may wear any of them.
   Each style is a hand-drawn template of clustered, spiky locks (character-appearance.md, "Hair"):
   h rim highlight, l light, b base, s shadow, d deep, x cool dark, X ink, q/Q tie (outfit colour 2).
   The front layer is drawn over the face (bangs and side locks frame it); the back layer goes
   behind the body. Templates start 7 columns left of the head box and 5 rows above it (`up` more
   rows for styles that rise higher). */
import { mix } from '../color';
import { keys, type DrawCtx } from './context';

const OX = -7;
const OY = -5;

interface Style { up?: number; back?: string[]; front: string[] }

/** Crown and bangs shared by the short styles (rows 0–17). */
const SHORT = [
  '..............xx..xxx',
  '...........xssbbssbbbsx',
  '.........xsbbbbbbbbbbbbsx',
  '........sbbhhbbbbdbbbbbbbs',
  '.......sbbhhbbbbbbdbbbbhbbs',
  '......dbbhbbbbbsbbbbdbbbhhbs',
  '......dbbbbbbbhbbbbbbdbbbbhbd',
  '.....dbbhbbbbhhbbbsbbbddbbbhbd',
  '.....dbbbbdbhhbshhdssbsbdbbhhbd',
  '.....sbbbdbhbbbhds.b..sd...dbhbd',
  '.....sbbbdbbbbbhd..s.......dbbd',
  '.....xbbsdbbbbdbd...........dbd',
  '......sbsdbbbsdsd...........dsd',
  '......dbsdbbsd.s.............sd',
  '......dbdXbsd.................d',
  '......XdsXdsd',
  '.......XdsXd',
  '........X.X',
];

const STYLES: Record<number, Style> = {
  // 1 Corto: tousled short hair, spiky crown, short bangs, the ear free.
  1: { front: SHORT },

  // 2 Puntas: wild spikes in every direction.
  2: {
    up: 3,
    front: [
      '.........x.......x.....x',
      '.........sx.....xs....xs',
      '...x.....sbs...xbs...sbs.....',
      '...sx...sbhbs.sbbs..sbbs...x',
      '....sbs.sbhbbsbbbbssbbbbs.xs',
      '.....sbbsbhbbbbbbbbbbbbbbsbs',
      '......dbbhhbbbbdbbbbbbbbhbbs',
      '.......dbhhbbbbbbdbbbbbbhhbs.x',
      '...xsddbbhbbbbbsbbbbdbbbbhbsxs',
      '....sbbbbbbbbbhbbbbbbdbbbbhbbbs',
      '.....dbbhbbbbhhbbbsbbbddbbbhbd',
      '..xsdbbbbdbhhbshhdssbsbdbbhhbds',
      '...ssbbbdbhbbbhds.b..sd...dbhbbsx',
      '.....sbbbdbbbbbhd..s......sdbbdbs',
      '....xsbbsdbbbbdbd...........dbd',
      '......sbsdbbbsdsd...........dsd',
      '......dbsdbbsd.s.............sd',
      '.....sdbdXbsd.................d',
      '......XdsXdsd',
      '.......XdsXd',
      '........X.X',
    ],
  },

  // 3 Coleta: short front, high ponytail tied at the back and swinging down to the left.
  3: {
    back: [
      '',
      '',
      '',
      '.......qQ',
      '.....sbqQs',
      '....sbbhbbs',
      '...sbbhhbbbs',
      '..sbbhbbbbbds',
      '..sbhbbbbdbbd',
      '.sbbbbbsbbbd',
      '.sbhbbsbbbd',
      'sbbbbdbbbd',
      'sbhbsbbbd',
      'sbbbdbbsd',
      'sbbdbbbd',
      'dbbsbbd',
      'dbsbbsd',
      '.dsbbd',
      '.dbsbd',
      '..dbsd',
      '..dsd',
      '...d',
    ],
    front: SHORT,
  },

  // 4 Cresta: shaved sides (stubble is painted on the skull) and a tall crest swept back.
  4: {
    up: 2,
    front: [
      '.................x',
      '..............x.sx',
      '...........x.xs.sbs',
      '........x.xs.sbssbbs',
      '.......xs.sbsbbhbbbs',
      '......sbssbbhbbhhbbbs',
      '......sbbbbhhbbhbbbbs',
      '.....sbbbbhbbbbbbbbs',
      '.....dbbbbbbbbbbbbs',
      '......dbbbbbbbbdbs',
      '.......dddbbbbbds',
      '..........dbbbbs.b',
      '...........sbbs.s',
      '............sd',
    ],
  },

  // 5 Largo: long straight hair, curtain bangs, a long back mass ending in points.
  5: {
    back: [
      '',
      '',
      '',
      '',
      '',
      '',
      '........sbbbb',
      '......sbbbbbbbs',
      '.....sbbhbbbbbbs',
      '....sbbhbbbbbbbbs',
      '....sbhbbbbbbbbbbs',
      '...sbbhbbbsbbbbbbd',
      '...sbhbbbsbbbbbbbd',
      '..sbbhbbsbbbbbbbbd',
      '..sbhbbbsbbbbbsbbd',
      '..sbhbbsbbbbbbsbbd',
      '..sbbbbsbbbbbsbbbd',
      '..sbhbbsbbbbbsbbbd',
      '..sbbbbsbbbbbsbbd',
      '..sbbbsbbbbbsbbbd',
      '..sbhbsbbbbbsbbbd',
      '..sbbbsbbbbsbbbd',
      '..sbbbsbbbbsbbbd',
      '..sbbsbbbbbsbbd',
      '..sbbsbbbbsbbbd',
      '..dbbsbbbbsbbd',
      '..dbsbbbbbsbbd',
      '..dbsbbbbsbbd',
      '...dsbbsbbsbd',
      '...dbsbdsbsd',
      '....dsd.dsd',
      '.....d...d',
    ],
    front: [
      '..............xxxx..xxx',
      '...........sssbbbbssbbbss',
      '..........ssbbssssbddbbbbss',
      '.........sbbbbbbbbdbdsbbsbbb',
      '........dbbbsbbbbbbbbxxbbbhhb',
      '........dhbbbbbbbbbbbbsbsbbbb',
      '.......dbhhbhbbbbbbsbbddbbbbbb',
      '.......dbbbbhhbbbbdddbbbddbbhb',
      '......ssbbdhhhshhdbsssbddsshhhb',
      '......sbbbdhbhbbhds...sd..dhbhbs',
      '......sbbbdbbbbbhd.........dbbbs',
      '.....sbbbsdbbbbdbd.........dbbbd',
      '.....sbbsddbbbsdbd.........dbbbd',
      '.....sbbsdbbbsds...........dbsbd',
      '.....sbbsdbbsd.............dbsbd',
      '.....sbsdbbbsd.............dbsbd',
      '.....sbsdbbbd..............dbsd',
      '.....sbsdbbsd..............dbsd',
      '.....sbsdbbsd..............dbsd',
      '.....sbsdbbsd..............dbsd',
      '.....sbsdbbsd...............dsd',
      '.....dbsdbsd................dsd',
      '.....dbsdbsd................dd',
      '.....dbsdbd.................d',
      '......dsdsd',
      '......dd.d',
      '.......d',
    ],
  },

  // 6 Trenza: short front and a thick braid over the near shoulder.
  6: {
    front: [
      ...SHORT.slice(0, 13),
      '......dbsdbbsd.s.............sd',
      '......dbbsdbsd................d',
      '......sbhbsdbd',
      '......sbbhsbbd',
      '......dsbbdsbd',
      '.......sbhbsd',
      '.......sbbhsd',
      '.......dsbbsd',
      '.......sbhbsd',
      '.......sbbhsd',
      '.......dsbbsd',
      '.......sbhbsd',
      '.......sbbhsd',
      '.......dsbbsd',
      '........qQQ',
      '.......sbsbs',
      '.......sd.ds',
      '........d..d',
    ],
  },

  // 7 Moño: hair gathered in a bun at the back, two strands framing the face.
  7: {
    front: [
      '...sbbbs',
      '..sbhhbbs',
      '.sbhhbbbbs.......xxx',
      '.sbhbbbbbsd...xssbbbsx',
      '.dbbbbbbsd..xsbbbbbbbbsx',
      '..dsbbbsdqsbbbhhbbbbbbbbs',
      '...ddddsqQbbhhbbbbbbbbbbbs',
      '.......dbbhbbbbbbbbbdbbbbbs',
      '......dbbbbbbbbbbbbbbdbbbbbd',
      '......sbbbbbbbbsbbbbbbddbbbbd',
      '......sbbbbdbbbbsdbbssbbddbbd',
      '......sbbbdbbbbd...........dbd',
      '......sbbsdbbbs............dbd',
      '......dbbsdbbs.............dsd',
      '......dbsdXbd..............dsd',
      '......dbsd.................dsd',
      '.......dsd.................dd',
      '.......Xd..................d',
    ],
  },

  // 8 Melena: the reference mane, a huge mass of spiky locks framing the face on both sides.
  8: {
    front: [
      '..............xxxx..xxx',
      '...........sssbbbbssbbbss',
      '..........ssbbssssbddbbbbss',
      '.........sbbbbbbbbdbdsbbsbbb',
      '........dbbbsbbbbbbbbxxbbbhhb',
      '........dhbbbbbbbbbbbbsbsbbbb',
      '.......dbhhbhbbbbbbsbbddbbbbbb',
      '.......dbbbbhhbbbbdddbbbddbbhb',
      '......ssbbdhhhshhddsssbddsshhhb',
      '......ssbbdhbhbbhd....X...Xhbhb',
      '......xbbbdbbbbbhd.........bbhd',
      '.....sbbbsdbbbbdbd........bdbbd',
      '....sbbbsddbbbsdbdssb....bbdbbd',
      '..sbbbssXXdbsbs.ss......b..dbsss',
      '...ddddXX.dbsbs............dbdXsd',
      '......ddd.xbsbd.............sd.d',
      '......dsd.xbsbd.............xd',
      '......dsd..bdbd............dxd',
      '......dsdx.bxbs............sxd',
      '.....ssXXxdxxbs............sd',
      '.....XX..XdXxbd............sd',
      '..........XXXbs...........ssd',
      '............dss.d........ssd',
      '...........X..s..........xX',
      '...............X.........x',
    ],
  },

  // 9 Media melena: rounded bob to the chin, blunt bangs cut in points.
  9: {
    front: [
      '..............xxx..xx',
      '...........xssbbbssbbsx',
      '.........xsbbbbbbbbbbbbsx',
      '........sbbhhbbbbbbbbbbbbs',
      '.......sbbhhbbbbbbbbbbbhbbs',
      '......sbbhbbbbbbbbbbbbbbhhbs',
      '......dbbbbbbbbbbbbbbbbbbbhbs',
      '.....dbbhbbbbhhbbbbbbbbbbbbhbd',
      '.....dbbbbbbhhbbbbbbbbbbbbbhhbd',
      '.....sbbbbbhbbbbsbbsbbsbbsbbhbd',
      '.....sbbbbbbbbbsd.sd.sd.sdbbbbd',
      '.....sbbbbdbbbsd...........dbbbd',
      '.....sbbbdbbbbd............dbbbd',
      '.....sbbbdbbbs.............dbbsd',
      '.....sbbbdbbbs.............dbbsd',
      '.....sbbbdbbsd.............dbbsd',
      '.....dbbbdbbsd.............dbsd',
      '.....dbbdbbbsd.............dbsd',
      '......dbdbbbd..............dsd',
      '......dddsbsd..............dd',
      '.........ddd',
    ],
  },

  // 10 Dos coletas: twin tails tied at both sides of the head.
  10: {
    back: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '...sbbs......................sbbs',
      '..sbhbbs....................sbbbbs',
      '.sbhbbbbs..................sbbbbbd',
      '.sbhbbbsd..................sbbbsbd',
      'sbhbbbsbd..................dbbbsbd',
      'sbhbbsbbd...................dbbsbd',
      'sbbbsbbd....................dbbsbd',
      'sbhbsbbd....................dbsbd',
      'sbbsbbd.....................dbsbd',
      'dbbsbbd.....................dbsbd',
      'dbsbbd.......................dsbd',
      '.dsbbd.......................dsd',
      '.dbsd........................dsd',
      '..dsd.........................d',
      '..dd',
      '...d',
    ],
    front: [
      ...SHORT.slice(0, 7),
      '.....dbbhbbbbhhbbbsbbbddbbbhbd',
      '...qQdbbbbdbhhbshhdssbsbdbbhhbdqQ',
      '...qQsbbbdbhbbbhds.b..sd...dbhbdqQ',
      ...SHORT.slice(10),
    ],
  },

  // 11 Ondas: long wavy hair with a side parting, bangs swept to the right.
  11: {
    back: [
      '',
      '',
      '',
      '',
      '',
      '',
      '........sbbbb',
      '......sbbbbbbbs',
      '.....sbbhbbbbbbs',
      '....sbbhbbbbbbbbs',
      '...sbbhbbbbbbbbbbs',
      '...sbhbbbsbbbbbbbd',
      '..sbhbbbsbbbbbbbbd',
      '.sbbhbbsbbbbbbbbd',
      '.sbhbbbsbbbbbsbbd',
      '..sbhbbsbbbbbbsbbd',
      '...sbbbbsbbbbbsbbbd',
      '...sbhbbbsbbbbbsbbd',
      '..sbbbbsbbbbbsbbd',
      '.sbbbsbbbbbsbbbd',
      '.sbhbsbbbbbsbbbd',
      '..sbbbsbbbbsbbbd',
      '...sbbbsbbbbsbbbd',
      '...sbbsbbbbbsbbd',
      '..sbbsbbbbsbbbd',
      '.dbbsbbbbsbbd',
      '.dbsbbbbbsbbd',
      '..dbsbbbbsbbd',
      '...dsbbsbbsbd',
      '...dbsbdsbsd',
      '..dsd..dsd',
      '..d.....d',
    ],
    front: [
      '...............xxxxx',
      '............xssbbbbbssx',
      '..........xsbbbbhhhbbbbbsx',
      '.........sbbbbhhbbbbbbbbbbs',
      '........sbbbhhbbbbbbbbbbbbbs',
      '.......sbbbhbbbbbbbbbbbbbbbbs',
      '.......dbbhbbbbbbbbbbbbbbbbbbs',
      '......dbbbbbbbbsbbbbbbbbbbbbhbs',
      '......dbbbbbsdbbbbbbbbbbbbbbhbbd',
      '......sbbbsd.sbbbbbsbbbbbbsbbbbd',
      '......sbbsd....ssbbbssbbbbdsbbbd',
      '.....sbbbsd.........ssdsbbd.dbbd',
      '.....sbbsdd.............sd..dbbd',
      '....sbbbsd..................dbsd',
      '....sbbsd...................dbbsd',
      '.....sbbsd...................dbsd',
      '.....sbbbsd..................dbsd',
      '......sbbsd.................dbsd',
      '.....sbbsd..................dbsd',
      '....sbbsd....................dbsd',
      '....sbbsd....................dsd',
      '.....dbbsd...................dd',
      '......dbsd...................d',
      '.......dd',
    ],
  },
};

const styleOf = (c: DrawCtx) => (c.a.hair > 0 ? STYLES[c.a.hair] ?? null : null);

/** Template of a style (race parts reuse the silhouettes for elemental hair). */
export function hairTemplate(id: number): { x: number; y: number; front: string[]; back?: string[] } {
  const s = STYLES[id] ?? STYLES[1];
  return { x: OX, y: OY - (s.up ?? 0), front: s.front, back: s.back };
}

function hairKeys(c: DrawCtx) {
  const q = c.cloth[1];
  return keys(c.hair, { q: q.light, Q: q.shadow });
}

/** Layer behind the body (long hair, tails). */
export function drawHairBack(c: DrawCtx) {
  const s = styleOf(c);
  if (!s?.back) return;
  c.p.tag = 'hair-back';
  c.p.stamp(c.f.hx + OX, c.f.hy + OY - (s.up ?? 0), s.back, hairKeys(c));
  c.p.tag = null;
}

/** Crown, bangs and side locks, over the face. */
export function drawHairFront(c: DrawCtx) {
  const { p, f, a, v, skin, hair } = c;
  const s = styleOf(c);
  if (!s) {
    // Bald: a little shine on the scalp.
    if (a.hair === 0 && v.head === 'human') p.dots([[f.hx + 5, f.hy + 2], [f.hx + 6, f.hy + 1], [f.hx + 7, f.hy + 1]], skin.hi);
    return;
  }
  if (a.hair === 4) {
    // Mohawk: stubble on the shaved sides of the skull.
    const stubble = mix(skin.base, hair.base, 0.28);
    p.tag = 'skin';
    for (let y = f.hy; y <= f.hy + 7; y++) {
      for (let x = f.hx; x <= f.hx + 19; x++) if (p.tagAt(x, y) === 'skin') p.set(x, y, (x * 7 + y * 3) % 11 ? stubble : mix(stubble, hair.deep, 0.3));
    }
  }
  p.tag = 'hair';
  p.stamp(f.hx + OX, f.hy + OY - (s.up ?? 0), s.front, hairKeys(c));
  p.tag = null;
}
