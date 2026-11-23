/* Pixel emblem of a class (lib/avatar/emblems): drawn from the cached 16 × 16 canvas. */
import { useEffect, useRef } from 'react';
import { auraForClass } from '../../../lib/avatar';
import { EMBLEM_SIZE, NEUTRAL_EMBLEM_COLOR, emblemCanvas, emblemForClass } from '../../../lib/avatar/emblems';

export function ClassEmblem({ klass, scale = 3 }: { klass?: string | null; scale?: number }) {
  const emblem = emblemForClass(klass);
  const color = auraForClass(klass) ?? NEUTRAL_EMBLEM_COLOR;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    const src = emblemCanvas(emblem, color);
    if (!ctx || !src) return;
    ctx.clearRect(0, 0, EMBLEM_SIZE, EMBLEM_SIZE);
    ctx.drawImage(src, 0, 0);
  }, [emblem, color]);

  return (
    <canvas
      ref={ref}
      width={EMBLEM_SIZE}
      height={EMBLEM_SIZE}
      aria-hidden
      className="avatar-pixel"
      style={{ width: EMBLEM_SIZE * scale, height: EMBLEM_SIZE * scale }}
    />
  );
}
