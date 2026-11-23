/* Small colour helpers for the pixel-art avatar (openspec/specs/character-appearance.md). */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** k < 1 darkens, k > 1 lightens (towards white). */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (k <= 1) return rgbToHex(r * k, g * k, b * k);
  const t = Math.min(1, k - 1);
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Stable 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Moves hue h towards target by at most `by` degrees (shortest way round). */
function hueToward(h: number, target: number, by: number): number {
  const diff = ((target - h + 540) % 360) - 180;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), by);
  return (h + step + 360) % 360;
}

/**
 * Cel-shading ramp (openspec/specs/character-appearance.md, "Shading"): highlight → deep shadow, plus
 * `cool`, a dark accent pushed towards teal-blue, and `ink`, the darkest tone (outlines, hair roots).
 */
export interface Ramp { hi: string; light: string; base: string; shadow: string; deep: string; cool: string; ink: string }

const rampCache = new Map<string, Ramp>();

/**
 * Builds highlight → ink tones from one base colour, tuned on the reference sprite: warm colours
 * (skin, gold, browns) shift their shadows towards red and their highlights towards yellow; cool
 * colours shift shadows towards blue and highlights towards cyan-white. Pale colours lose saturation
 * in the shadows (pink-beige skin shadow, slate hair shadow), dark ones gain it. `cool` is a teal
 * accent and `ink` a near-black of the same family.
 */
export function ramp(base: string): Ramp {
  const hit = rampCache.get(base);
  if (hit) return hit;
  const [h0, s0, l] = hexToHsl(base);
  // Neutral greys are treated as a faintly cool slate.
  const grey = s0 < 0.08;
  const h = grey ? 210 : h0;
  const s = grey ? Math.max(s0, 0.1) : s0;
  const warm = h < 75 || h > 300;
  const hsl = (hh: number, ss: number, ll: number) => hslToHex(hh, Math.max(0, Math.min(1, ss)), Math.max(0, Math.min(1, ll)));
  const shadeSat = (k: number) => s * (l > 0.75 ? 0.5 * k : l > 0.5 ? 0.78 * k : 1.12);
  const r: Ramp = {
    hi: hsl(hueToward(h, warm ? 55 : 180, warm ? 12 : 10), s * 0.85, l + (1 - l) * 0.68),
    light: hsl(hueToward(h, warm ? 55 : 180, warm ? 6 : 4), s * 0.95, l + (1 - l) * 0.3),
    base,
    shadow: hsl(hueToward(h, warm ? 0 : 220, warm ? 10 : 6), shadeSat(1), l * 0.76),
    deep: hsl(hueToward(h, warm ? 0 : 225, warm ? 8 : 12), shadeSat(1.05) + 0.04, l * 0.5),
    cool: hsl(hueToward(h, 192, 40), Math.max(s * 1.3, 0.3), l * 0.44),
    ink: hsl(hueToward(h, warm ? 5 : 188, warm ? 12 : 35), Math.max(s * 1.3, 0.45), Math.min(0.19, l * 0.26)),
  };
  if (rampCache.size > 500) rampCache.clear();
  rampCache.set(base, r);
  return r;
}
