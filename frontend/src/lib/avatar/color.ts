/* Small colour helpers for the pixel-art avatar (openspec/specs/character-appearance.md). */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
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

export function hexToHsl(hex: string): [number, number, number] {
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

/** Five-tone cel-shading ramp (openspec/specs/character-appearance.md, "Shading"). */
export interface Ramp { hi: string; light: string; base: string; shadow: string; deep: string }

const rampCache = new Map<string, Ramp>();

/**
 * Builds highlight → deep shadow tones from one base colour. Shadows drift towards a cool
 * purple-blue and highlights towards a warm yellow, which reads better than plain darkening.
 */
export function ramp(base: string): Ramp {
  const hit = rampCache.get(base);
  if (hit) return hit;
  const [h, s, l] = hexToHsl(base);
  const grey = s < 0.08;
  const tone = (dl: number, hueBy: number, target: number, ds: number) => {
    const nh = grey ? h : hueToward(h, target, hueBy);
    const ns = Math.max(0, Math.min(1, grey ? s : s * ds));
    const nl = Math.max(0, Math.min(1, dl));
    return hslToHex(nh, ns, nl);
  };
  const r: Ramp = {
    hi: tone(l + (1 - l) * 0.55, 14, 55, 0.85),
    light: tone(l + (1 - l) * 0.24, 7, 55, 0.95),
    base,
    shadow: tone(l * 0.7, 10, 250, 1.05),
    deep: tone(l * 0.45, 18, 250, 1.1),
  };
  if (rampCache.size > 500) rampCache.clear();
  rampCache.set(base, r);
  return r;
}

/** Alpha of a "#rrggbb" or "#rrggbbaa" colour, 0–255. */
export function alphaOf(hex: string): number {
  const h = hex.replace('#', '');
  return h.length === 8 ? parseInt(h.slice(6), 16) : 255;
}
