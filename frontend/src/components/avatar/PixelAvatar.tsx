/* Pixel-art character avatar (openspec/specs/character-appearance.md).
   The race decides the body family, the class decides the aura colour. */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  auraForClass, avatarCanvas, cropRect, normalizeAppearance, parseStoredAppearance, resolveRaceVisual,
} from '../../lib/avatar';

interface Props {
  /** Stored appearance (object, JSON string or null → race default). */
  appearance?: unknown;
  race?: string | null;
  raceSize?: string | null;
  /** Class name, for the aura colour. */
  klass?: string | null;
  aura?: boolean;
  pulse?: boolean;
  crop?: 'full' | 'bust';
  /** CSS pixels per sprite pixel (the full sprite is 48×56, the bust crop 24×24). */
  scale?: number;
  className?: string;
  label?: string;
  /** Hide from assistive tech when the surrounding control already names it. */
  decorative?: boolean;
}

export function PixelAvatar({ appearance, race, raceSize, klass, aura = true, pulse = false, crop = 'full', scale = 4, className = '', label, decorative = false }: Props) {
  const visual = useMemo(() => resolveRaceVisual(race, raceSize), [race, raceSize]);
  const app = useMemo(() => normalizeAppearance(parseStoredAppearance(appearance), visual, true), [appearance, visual]);
  const auraColor = aura ? auraForClass(klass) : null;
  const r = cropRect(visual, app, crop);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, r.w, r.h);
    ctx.drawImage(avatarCanvas(app, visual, auraColor), r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  }, [app, visual, auraColor, r.x, r.y, r.w, r.h]);

  // Width + aspect ratio (not a fixed height) so a max-width never stretches the sprite.
  const style = { width: r.w * scale, height: 'auto', aspectRatio: `${r.w} / ${r.h}`, '--aura': auraColor ?? 'transparent' } as CSSProperties;
  return (
    <canvas
      ref={ref}
      width={r.w}
      height={r.h}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (label ?? `Retrato de ${race ? visual.label.toLowerCase() : 'personaje'}`)}
      className={`avatar-pixel ${pulse && auraColor ? 'avatar-pulse' : ''} ${className}`}
      style={style}
    />
  );
}
