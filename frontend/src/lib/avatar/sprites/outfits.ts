/* Ten outfits on the idle pose, each with a primary (P) and a secondary (Q) colour, layered as in the
   references (character-appearance.md § Art direction → Shading, Capes and robes):
   0 túnica bajo tabardo · 1 jubón de cuello alto · 2 camisa y chaleco con cordones · 3 abrigo largo
   con solapas y faldones · 4 vestido con corpiño y falda · 5 corsé con lazos y falda · 6 blusa con
   fajín y pantalón · 7 capa corta sobre túnica · 8 armadura ligera con hombreras y faldar · 9 túnica de
   mago con capucha y manto.
   Drawn in canonical body coordinates (painter.ts, CANON): cape, far sleeve, legs and boots, torso,
   skirt, (held prop), near sleeve and overlays. Any body and size can wear any outfit.

   Template keys (one character per pixel, '.' = nothing):
   P 1 2 light 3 base 4 shadow 5 deep o contour · Q 6 7 light 8 base 9 shadow 0 deep
   gold G Y light M L base F shadow · leather a light b base c e shadow · metal i n m u v (hi → deep) ·
   skin J k K D (light → shadow) · X ink. */
import { ramp, type Ramp } from '../color';
import type { Painter } from '../painter';
import { INK, type DrawCtx } from './context';

/** Leather of belts and boots, metal of armour, gold of buckles and trims (shared with the props). */
const LEATHER = ramp('#5a3a2a');
const METAL = ramp('#a3adba');
const GOLD = ramp('#e0a83a');

/** Template origins: torso and overlays from x 15 / y 27, sleeves from x 10 and x 31 / y 29, skirts from y 41. */
const TORSO_X = 15;
const TORSO_Y = 27;
const ARM_Y = 29;
const SKIRT_Y = 41;

/** Keys that belong to trims (belts, buckles, metal): tagged 'trim'; skin keys: 'skin'. */
const TRIM_TAGS: Record<string, string> = Object.fromEntries([...'YGMLFabceinmuv'].map((k) => [k, 'trim']));
const TAGS: Record<string, string> = { ...TRIM_TAGS, J: 'skin', k: 'skin', K: 'skin', D: 'skin' };

function keyMap(c: DrawCtx, P: Ramp, Q: Ramp): Record<string, string> {
  const s = c.skin;
  return {
    1: P.light, 2: P.light, 3: P.base, 4: P.shadow, 5: P.deep, o: P.deep,
    6: Q.light, 7: Q.light, 8: Q.base, 9: Q.shadow, 0: Q.deep,
    Y: GOLD.light, G: GOLD.light, M: GOLD.base, L: GOLD.base, F: GOLD.shadow,
    a: LEATHER.light, b: LEATHER.base, c: LEATHER.shadow, e: LEATHER.shadow,
    i: METAL.hi, n: METAL.light, m: METAL.base, u: METAL.shadow, v: METAL.deep,
    J: s.light, k: s.base, K: s.shadow, D: s.shadow, X: INK,
  };
}

/* Hips, legs and boots from row 41 (x 15–30): p q r s light → deep. Short sturdy legs in the front
   three-quarter view to the left: the near leg (viewer's right) has a 6 px thigh and is lit on its left,
   the far leg 5 → 4 px and darker; each leg's right column is in shadow, the knee light sits left of
   centre. Boots 5–6 px wide with a lit shaft and a toe cap pointing left; the feet stand 2 px apart. */
const LEG_Y = 41;
const LEGS = [
  '.pqqqqqqqqqqqrrs',
  '.qqqqqrrrpqqqqrs',
  '.qqqqr...ppqqqr.',
  '.qqqqr...ppqqqr.',
  '..qqqr...ppqqr..',
  '..pqqr...pppqr..',
  '..qqqr...ppqqr..',
  '..qqqr...ppqqr..',
  '.pqqqr...pqqqr..',
  '.pqqqr...pqqqr..',
  '.pqqqr...pqqqr..',
  'ppqqqr..ppqqqr..',
  'ssssss..ssssss..',
];

/* Layer templates (torsos from x 15 / y 25; skirts, tails and overlays at their own origin; sleeves
   from x 11 and x 31, y 27). */
const TUNIC = [
  '.................',
  '...23335553444...',
  '..2235KK5334444..',
  '.22G78889F334455.',
  '.22G78889F334455.',
  '.22G78889F334455.',
  '.22G78889F334455.',
  '.23G78889F344455.',
  '.23G78889F344455.',
  '.23G78899F344455.',
  '.33G78899F344555.',
  '.33G78899F344555.',
  '.abbbMMbbbbbccce.',
  '.ccccLFccccccccc.',
  '.23G78889F3ab455.',
  '.23G78889F3bc455.',
  '223G78899F3444555',
  '778GMMMMMF8899900',
];
const DOUBLET = [
  '..77.............',
  '..789............',
  '.2789KK78899445..',
  '.22333M333334455.',
  '.22334o433344455.',
  '.22333M333334455.',
  '.22334o433344455.',
  '.22333M333344455.',
  '.22334o433344455.',
  '.23333M333344455.',
  '.33344o443444555.',
  '.33344o443444555.',
  '.7888MM888899990.',
  '.9999FF999900000.',
];
const DOUBLET_COLLAR = [
  '..788.',
  '.78899',
  '788999',
];
const PEPLUM = [
  '..233334533334445..',
  '..2333345333334445.',
  '.77888888888888999.',
];
const VEST = [
  '.................',
  '...23788887344...',
  '..2377KK8833444..',
  '.2235GF853344555.',
  '.22357G853344455.',
  '.2235GF853344555.',
  '.22357G853344455.',
  '.2235F7G53344455.',
  '.23357G853444455.',
  '.2335F7G53444555.',
  '.333578953444555.',
  '.333578953444555.',
  '.abbbMMbbbbbccce.',
  '.ccccLFccccccccc.',
  '.233578853344455.',
  '.335.....5344455.',
];
const COAT = [
  '.................',
  '...23335553444...',
  '..2278KK8734444..',
  '.2227877893M4455.',
  '.222787789334455.',
  '.2227877893M4455.',
  '.222787789334455.',
  '.223787789M34455.',
  '.223577785344455.',
  '.23357778M534455.',
  '.233577785344555.',
  '.233577785344555.',
  '.333577785344555.',
  '.33357778M534555.',
];
const COAT_TAILS = [
  '..2333577785334445.',
  '..2333570075334445.',
  '.22333507053344455.',
  '.22333500053344455.',
  '2233350.....5334455',
  '2233350.....5334455',
  'GMMMMF.......GMMMF.',
];
const BODICE = [
  '.................',
  '...2kkkkkkkk34...',
  '..22kJkkkkkK344..',
  '.222GMMMMMMF3445.',
  '.223333433334455.',
  '.222GMMMMMMF3445.',
  '.223333433334455.',
  '.223333433344455.',
  '.223334533344455.',
  '.233334533344455.',
  '.333345534445555.',
  '.333345534445555.',
  '.788888888899990.',
  '.999999999900000.',
];
const LONG_SKIRT = [
  '...233334533334445...',
  '...2333345333334445..',
  '..22333345333334445..',
  '..22333345333334445..',
  '..223333453333344455.',
  '.2233333453333344455.',
  '.22333334533333444555',
  '223333345333333444555',
  '223333345333333444555',
  'GMMMMMMMMMMMMMMMMMMMF',
  '778888888888888899990',
];
const CORSET = [
  '.................',
  '...77888888899...',
  '..778KJkkK88999..',
  '.778888888899990.',
  '.5aGbbGbbbbbbcc5.',
  '.778888888899990.',
  '.5aGbbGbbbbbbcc5.',
  '.5abGbGbbbbbbcc5.',
  '.5abbGbbbbbbbcc5.',
  '.5abGbGbbbbbbcc5.',
  '.5aGbbbGbbbbbcc5.',
  '.5aGbbbGbbbbbcc5.',
  '.5abbbbbbbbbbcc5.',
  '.ccccLFccccccccc.',
];
const KNEE_SKIRT = [
  '..233334533334445..',
  '..2333345333334445.',
  '.223333453333344455',
  '2233333453333344455',
  'GMMMMMMMMMMMMMMMMMF',
  '7788888888888889990',
];
const BLOUSE = [
  '.................',
  '...22335K53344...',
  '..2223K5KK34444..',
  '.2223335K3334455.',
  '.222343353334455.',
  '.2223335K3334455.',
  '.222343353334455.',
  '.223334333434455.',
  '.223343334334455.',
  '.223433343344455.',
  '.333345334445555.',
  '.333345334445555.',
  '.7888GM888899990.',
  '.9999FL999990000.',
  '.223378903344455.',
  '.223389033444555.',
  '.....89..........',
  '.....9...........',
];
const CAPELET = [
  '.......77888GM88999.......',
  '....77788888FL888999900...',
  '..6677888888888888999900..',
  '.667788888888888888999900.',
  '6677888888888888888999900.',
  '7788888888888888888899900.',
  '.99988888888888888899900..',
  '...0099999999999999900....',
];
const ARMOUR = [
  '.................',
  '...nmmmmmmmuuv...',
  '..innmmmmmmuuuv..',
  '.2inmmimmmmuuv45.',
  '.2nnmmimmmmuuv45.',
  '.2inmmimmmmuuv45.',
  '.2nnmmimmmmuuv45.',
  '.2nmmmimmmuuuv45.',
  '.2nmmmimmmuuvv45.',
  '.3mmmmimmmuuvv55.',
  '.3umuuuuuuuvvv55.',
  '.3umuuuuuuuvvv55.',
  '.abbbMMbbbbbccce.',
  '.ccccLFccccccccc.',
  '.nm7888889mu5455.',
  '.mu7888889uv4455.',
  '.mu78888899uv455.',
];
const ROBE = [
  '.................',
  '...23335553444...',
  '..223G5KK5F4444..',
  '.2223G535F334455.',
  '.2233G535F334455.',
  '.2223G535F334455.',
  '.2233G535F334455.',
  '.2233G535F344455.',
  '.2333G535F344455.',
  '.2333G535F344455.',
  '.3333G535F344555.',
  '.3333G535F344555.',
  '.788888MM8899990.',
  '.99999FF99900000.',
];
const ROBE_SKIRT = [
  '...2333G535F334445...',
  '...2333G535F3334445..',
  '..22333G535F3334445..',
  '..22333G535F3334445..',
  '..223333G535F334445..',
  '.2233333G535F3344455.',
  '.22333333G535F3444555',
  '223333333G535F3444555',
  '223333333G535F3444555',
  'GMMMMMMMMMMMMMMMMMMMF',
  '778888888888888899990',
];
const HOOD = [
  '....008999...............',
  '..7788900................',
  '.7788890......788899900..',
  '66788890.....78888999900.',
  '77888890....788888999900.',
  '.999999990.9999999999900.',
];
const CAPE = [
  '...7888888888888888889.....',
  '..788888888888888888899....',
  '.78888888888888888888999...',
  '7888888888888888888889990..',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '78888888888888888888899900.',
  '789....................8890',
  '789....................8890',
  '789....................8890',
  '789....................8890',
  '78......................890',
  '.0.....................000.',
];
const FAR_PLAIN = [
  '......',
  '...222',
  '..2222',
  '.22233',
  '.2235.',
  '.2335.',
  '.2335.',
  '.2235.',
  '.2335.',
  '.2335.',
  '.2345.',
  '.3445.',
  '.7890.',
];
const NEAR_PLAIN = [
  '......',
  '333...',
  '33344.',
  '334445',
  '.4445.',
  '.4445.',
  '.4445.',
  '.4445.',
  '.4445.',
  '..4455',
  '..4455',
  '..4455',
  '..8990',
];
const FAR_PUFF = [
  '..2222',
  '.22722',
  '227833',
  '.2385.',
  '..235.',
  '..235.',
  '..235.',
  '..235.',
  '..235.',
  '..345.',
  '..345.',
  '..345.',
  '.7890.',
];
const NEAR_PUFF = [
  '333...',
  '33394.',
  '338945',
  '.34945',
  '.445..',
  '..445.',
  '..445.',
  '.445..',
  '..445.',
  '..445.',
  '..445.',
  '..455.',
  '..8990',
];
const FAR_ROLLED = [
  '......',
  '...777',
  '..7777',
  '.77788',
  '.7789.',
  '.0000.',
  '.0000.',
  '.JkkK.',
  '.JkkK.',
  '.JkkK.',
  '.JkkK.',
  '.kkKK.',
  '.kKK..',
];
const NEAR_ROLLED = [
  '......',
  '777...',
  '77788.',
  '778899',
  '.8899.',
  '.0000.',
  '.0000.',
  '..kkK.',
  '..kkK.',
  '..kkK.',
  '..kkK.',
  '..kKK.',
  '..kKK.',
];
const FAR_BELL = [
  '.......',
  '...22..',
  '..222..',
  '.2223..',
  '.2235..',
  '.2223..',
  '.2223..',
  '.2235..',
  '22335..',
  '23345..',
  '23445..',
  '34455..',
  'GMMMF..',
];
const NEAR_BELL = [
  '.......',
  '333....',
  '33344..',
  '334445.',
  '.44455.',
  '.34445.',
  '.34445.',
  '.44455.',
  '.444555',
  '.344555',
  '.444555',
  '.445555',
  '.GMMMMF',
];
const FAR_PAULDRON = [
  '..nn..',
  '.inmuu',
  'innmuu',
  'nmmuv.',
  '.uvv5.',
  '.2335.',
  '.2335.',
  '.2345.',
  '.2335.',
  '.2345.',
  '.nmuv.',
  '.nmuv.',
  '.muvv.',
];
const NEAR_PAULDRON = [
  'nnm...',
  'nnmmu.',
  'mmmuuv',
  '.muuvv',
  '.uvv5.',
  '.4445.',
  '.4445.',
  '..4455',
  '.4445.',
  '..4455',
  '..muvv',
  '..muvv',
  '..uvv.',
];
const FAR_DRESS = [
  '..7777',
  '.77877',
  '778899',
  '.7890.',
  '..JkK.',
  '..JkK.',
  '..JkK.',
  '..JkK.',
  '..JkK.',
  '..kkK.',
  '..kkK.',
  '..kKK.',
  '..kKK.',
];
const NEAR_DRESS = [
  '888...',
  '88890.',
  '888990',
  '.8990.',
  '.kKK..',
  '..kKK.',
  '..kKK.',
  '.kKK..',
  '..kKK.',
  '..kKK.',
  '..kKK.',
  '..kKK.',
  '..KKK.',
];
const FAR_BLOUSE = [
  '..7777',
  '.77677',
  '776788',
  '.7870.',
  '..780.',
  '..780.',
  '..780.',
  '..780.',
  '..780.',
  '..890.',
  '..890.',
  '..890.',
  '.6790.',
];
const NEAR_BLOUSE = [
  '888...',
  '88899.',
  '887990',
  '.89990',
  '.990..',
  '..990.',
  '..990.',
  '.990..',
  '..990.',
  '..990.',
  '..990.',
  '..900.',
  '..7990',
];
const FAR_GILT = [
  '......',
  '...222',
  '..2222',
  '.22233',
  '.2235.',
  '.2335.',
  '.2335.',
  '.2235.',
  '.2335.',
  '.2335.',
  '.2345.',
  '.3445.',
  '.GMMF.',
];
const NEAR_GILT = [
  '......',
  '333...',
  '33344.',
  '334445',
  '.4445.',
  '.4445.',
  '.4445.',
  '.4445.',
  '.4445.',
  '..4455',
  '..4455',
  '..4455',
  '..GMMF',
];

interface Layer { rows: readonly string[]; x: number; y: number; tag?: string }
/** Four tones of legs and boots: lit edge, base, shade and the darkest (seam, sole). */
interface Tones { light: string; base: string; shadow: string; deep: string }

interface Outfit {
  torso: readonly string[];
  /** Far and near sleeves (from x 10 and x 31). */
  arms: readonly [readonly string[], readonly string[]];
  /** Skirts and coat tails, under the belt. */
  skirt?: Layer;
  /** Collars, capelets and hoods, over the near sleeve. */
  over?: Layer;
  /** Cape hanging behind the body. */
  cape?: boolean;
  legs: (P: Ramp, Q: Ramp) => Tones;
  boots: (P: Ramp, Q: Ramp) => Tones;
  bootH: number;
}

/** Trousers in the dark end of a cloth ramp: no new colours in the palette. */
const dark = (r: Ramp): Tones => ({ light: r.shadow, base: r.deep, shadow: r.deep, deep: INK });
const tones = (r: Ramp): Tones => ({ light: r.light, base: r.base, shadow: r.shadow, deep: INK });
const LEATHER_T = tones(LEATHER);
const METAL_T = tones(METAL);
const layer = (rows: readonly string[], x: number, y = SKIRT_Y, tag?: string): Layer => ({ rows, x, y, tag });
const PLAIN = [FAR_PLAIN, NEAR_PLAIN] as const;

const OUTFITS: Outfit[] = [
  { torso: TUNIC, arms: PLAIN, legs: dark, boots: () => LEATHER_T, bootH: 5 }, // 0 túnica
  { torso: DOUBLET, arms: [FAR_PUFF, NEAR_PUFF], skirt: layer(PEPLUM, 14), over: layer(DOUBLET_COLLAR, 24, 26, 'cloth'), legs: (_P, Q) => dark(Q), boots: () => LEATHER_T, bootH: 5 }, // 1 jubón
  { torso: VEST, arms: [FAR_ROLLED, NEAR_ROLLED], legs: (_P, Q) => dark(Q), boots: () => LEATHER_T, bootH: 5 }, // 2 camisa y chaleco
  { torso: COAT, arms: PLAIN, skirt: layer(COAT_TAILS, 14), legs: dark, boots: () => LEATHER_T, bootH: 5 }, // 3 abrigo largo
  { torso: BODICE, arms: [FAR_DRESS, NEAR_DRESS], skirt: layer(LONG_SKIRT, 13), legs: dark, boots: (_P, Q) => dark(Q), bootH: 2 }, // 4 vestido
  { torso: CORSET, arms: [FAR_BLOUSE, NEAR_BLOUSE], skirt: layer(KNEE_SKIRT, 14), legs: dark, boots: () => LEATHER_T, bootH: 5 }, // 5 corsé y falda
  { torso: BLOUSE, arms: [FAR_GILT, NEAR_GILT], legs: (_P, Q) => tones(Q), boots: () => LEATHER_T, bootH: 5 }, // 6 blusa y pantalón
  { torso: TUNIC, arms: PLAIN, over: layer(CAPELET, 11, 28), cape: true, legs: dark, boots: (_P, Q) => dark(Q), bootH: 5 }, // 7 capa corta
  { torso: ARMOUR, arms: [FAR_PAULDRON, NEAR_PAULDRON], cape: true, legs: dark, boots: () => METAL_T, bootH: 5 }, // 8 armadura ligera
  { torso: ROBE, arms: [FAR_BELL, NEAR_BELL], skirt: layer(ROBE_SKIRT, 13), over: layer(HOOD, 11, 28), legs: dark, boots: dark, bootH: 2 }, // 9 túnica de mago
];

const outfitOf = (c: DrawCtx) => OUTFITS[Math.max(0, Math.min(OUTFITS.length - 1, c.a.outfit))];

const LEG_TONE: Record<string, keyof Tones> = { p: 'light', q: 'base', r: 'shadow', s: 'deep' };

function legs(p: Painter, pants: Tones, boots: Tones, bootH: number) {
  const top = 53 - bootH + 1;
  const prev = p.tag;
  LEGS.forEach((row, j) => {
    const y = LEG_Y + j;
    const boot = y >= top;
    const r = boot ? boots : pants;
    p.tag = boot ? 'boot' : prev;
    for (let i = 0; i < row.length; i++) {
      const t = row[i];
      if (t === '.') continue;
      // Boot cuff: one lit row where the boot starts.
      p.set(TORSO_X + i, y, boot && y === top && bootH > 2 && t !== 's' ? r.light : r[LEG_TONE[t]]);
    }
  });
  p.tag = prev;
}

/** Cape behind the body, canonical coordinates. */
export function drawOutfitBack(c: DrawCtx, p: Painter) {
  if (!outfitOf(c).cape) return;
  const map = keyMap(c, c.cloth[0], c.cloth[1]);
  p.tag = 'flow';
  p.stamp(11, 30, CAPE, map);
  p.tag = null;
}

/** Far sleeve, legs, torso and skirt, canonical coordinates (the held prop goes on top). */
export function drawOutfitBody(c: DrawCtx, p: Painter) {
  const o = outfitOf(c);
  const map = keyMap(c, c.cloth[0], c.cloth[1]);
  p.tag = 'cloth';
  p.stamp(10, ARM_Y, o.arms[0], map, false, TAGS);
  legs(p, o.legs(c.cloth[0], c.cloth[1]), o.boots(c.cloth[0], c.cloth[1]), o.bootH);
  p.stamp(TORSO_X, TORSO_Y, o.torso, map, false, TAGS);
  if (o.skirt) p.stamp(o.skirt.x, o.skirt.y, o.skirt.rows, map, false, TAGS);
  p.tag = null;
}

/** Near sleeve and overlays (collar, capelet, hood), over the prop's grip, canonical coordinates. */
export function drawOutfitFront(c: DrawCtx, p: Painter) {
  const o = outfitOf(c);
  const map = keyMap(c, c.cloth[0], c.cloth[1]);
  p.tag = 'cloth';
  p.stamp(31, ARM_Y, o.arms[1], map, false, TAGS);
  if (o.over) {
    p.tag = o.over.tag ?? 'flow';
    p.stamp(o.over.x, o.over.y, o.over.rows, map, false, TAGS);
  }
  p.tag = null;
}
