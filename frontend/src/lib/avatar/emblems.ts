/* Class emblems for the character creator (character-appearance.md, "Creation wizard"):
   a 16 × 16 pixel icon of the class prop, tinted with the class colour ramp and outlined
   automatically. Templates use tone letters (h highlight, l light, b base, s shadow, d deep);
   '.' is transparent and becomes the outline when it touches a filled pixel. */
import { ramp } from './color';
import { propForClass, type Prop } from './sprites/props';

/** The class prop, plus a fist for monks and a gem for homebrew classes or no class. */
export type Emblem = Prop | 'fist' | 'gem';

export const EMBLEM_SIZE = 16;

/** Colour of the emblem when there is no class (the design system's muted grey). */
export const NEUTRAL_EMBLEM_COLOR = '#8d919a';

const TEMPLATES: Record<Emblem, readonly string[]> = {
  staff: [
    '................',
    '..........hlb...',
    '.........hllbs..',
    '.........llbbs..',
    '.........bbbsd..',
    '..........ssd...',
    '........bs......',
    '.......bs.......',
    '......bs........',
    '.....bs.........',
    '....bs..........',
    '...bs...........',
    '..bs............',
    '.bs.............',
    '.s..............',
    '................',
  ],
  sword: [
    '................',
    '.............h..',
    '............hl..',
    '...........hls..',
    '..........hls...',
    '.........hls....',
    '........hls.....',
    '.......hls......',
    '...l..hls.......',
    '....l.ls........',
    '.....b..........',
    '....b.s.........',
    '...bd..s........',
    '.lb.............',
    '.bs.............',
    '................',
  ],
  axe: [
    '................',
    '......bs..h.....',
    '......bs.blh....',
    '......bssbblh...',
    '.....sbssbbblh..',
    '.....sbssbbblh..',
    '.....sbssbbblh..',
    '......bssbblh...',
    '......bs.blh....',
    '......bs..h.....',
    '......bs........',
    '......bs........',
    '......bs........',
    '......bs........',
    '......sd........',
    '................',
  ],
  bow: [
    '................',
    '................',
    '...........lllh.',
    '........lllssh..',
    '......llsss.h...',
    '.....bss...h....',
    '....ls....h.....',
    '....ls...h......',
    '...ls...h.......',
    '...ls..h........',
    '...ls.h.........',
    '..ls.h..........',
    '..lsh...........',
    '..lh............',
    '..h.............',
    '................',
  ],
  dagger: [
    '................',
    '................',
    '................',
    '...........h....',
    '..........hl....',
    '.........hls....',
    '........hls.....',
    '....l..hls......',
    '.....l.ls.......',
    '......b.........',
    '.....b.s........',
    '....bd..s.......',
    '...lb...........',
    '...bs...........',
    '................',
    '................',
  ],
  mace: [
    '................',
    '..........l.....',
    '.......l.hlb....',
    '........hllbb...',
    '.......hllbbbs..',
    '........lbbbs...',
    '........sbss.l..',
    '......bs........',
    '.....bs.........',
    '....bs..........',
    '...bs...........',
    '..bs............',
    '.bs.............',
    '.s..............',
    '................',
    '................',
  ],
  lute: [
    '................',
    '.............ld.',
    '............ls..',
    '...........ls...',
    '..........ls....',
    '.........ls.....',
    '....hll.ls......',
    '...hllllb.......',
    '..hllbllbs......',
    '..llldllbs......',
    '..llddlbbs......',
    '..lblllbbs......',
    '...bbbbss.......',
    '....sss.........',
    '................',
    '................',
  ],
  hammer: [
    '................',
    '................',
    '...hllllllllb...',
    '...lbbbbbbbbs...',
    '...lbbbbbbbbs...',
    '...bsssssssss...',
    '.......ls.......',
    '.......bs.......',
    '.......bs.......',
    '.......bs.......',
    '.......bs.......',
    '.......bs.......',
    '.......bs.......',
    '.......ss.......',
    '.......dd.......',
    '................',
  ],
  fist: [
    '................',
    '................',
    '................',
    '.....hlhlhll....',
    '....hlbsbsbbs...',
    '....lbbsbsbbs...',
    '...hlbbsbsbbs...',
    '...lllllllbbs...',
    '...sbbbbblbbs...',
    '....sbbbbbbs....',
    '.....sbbbbs.....',
    '.....lbbbbs.....',
    '.....lbbbbs.....',
    '.....ssssss.....',
    '................',
    '................',
  ],
  gem: [
    '................',
    '................',
    '................',
    '.....hhhhhh.....',
    '....hlhlllbs....',
    '...hllhlllbbs...',
    '..hhhhhhhhhsss..',
    '...llllbbbbss...',
    '....lllbbbss....',
    '.....llbbss.....',
    '......lbbs......',
    '.......bs.......',
    '................',
    '................',
    '................',
    '................',
  ],
};

const MONK = /monk|monje/;

/** Emblem for a class name (EN/ES), following the held prop of the avatar. */
export function emblemForClass(className: string | null | undefined): Emblem {
  const prop = propForClass(className);
  if (prop) return prop;
  return MONK.test((className ?? '').trim().toLowerCase()) ? 'fist' : 'gem';
}

const hexBytes = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** RGBA pixels (16 × 16 × 4) of an emblem in the ramp of `color` ("#rrggbb"). */
function emblemPixels(emblem: Emblem, color: string): Uint8ClampedArray<ArrayBuffer> {
  const r = ramp(color);
  const tones: Record<string, string> = { h: r.hi, l: r.light, b: r.base, s: r.shadow, d: r.deep };
  const rows = TEMPLATES[emblem];
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < EMBLEM_SIZE && y < EMBLEM_SIZE && rows[y][x] !== '.';
  const out = new Uint8ClampedArray(EMBLEM_SIZE * EMBLEM_SIZE * 4);
  for (let y = 0; y < EMBLEM_SIZE; y++) {
    for (let x = 0; x < EMBLEM_SIZE; x++) {
      const ch = rows[y][x];
      let hex = tones[ch];
      if (!hex) {
        // Outline: a transparent pixel next to the shape (8 neighbours) takes the darkest tone.
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1 && !edge; dx++) edge = filled(x + dx, y + dy);
        if (!edge) continue;
        hex = r.ink;
      }
      const [red, green, blue] = hexBytes(hex);
      const i = (y * EMBLEM_SIZE + x) * 4;
      out[i] = red;
      out[i + 1] = green;
      out[i + 2] = blue;
      out[i + 3] = 255;
    }
  }
  return out;
}

const cache = new Map<string, HTMLCanvasElement | null>();

/** Cached 16 × 16 canvas of an emblem (one per emblem + colour); null without a 2D context. */
export function emblemCanvas(emblem: Emblem, color: string): HTMLCanvasElement | null {
  const key = `${emblem}|${color}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const canvas = document.createElement('canvas');
  canvas.width = EMBLEM_SIZE;
  canvas.height = EMBLEM_SIZE;
  const ctx = canvas.getContext('2d');
  const result = ctx ? canvas : null;
  if (ctx) ctx.putImageData(new ImageData(emblemPixels(emblem, color), EMBLEM_SIZE, EMBLEM_SIZE), 0, 0);
  if (cache.size > 200) cache.clear();
  cache.set(key, result);
  return result;
}
