/* The creator's stage (character-appearance.md, "Creation wizard"): the full avatar at the
   largest integer scale that fits, standing on a lit pedestal, with race and class above it. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { AVATAR_H, AVATAR_W, auraForClass } from '../../../lib/avatar';
import { PixelAvatar } from '../../avatar/PixelAvatar';

/** Space under the pedestal and pedestal rows the figure stands on (in sprite pixels). */
const FLOOR_PX = 16;
const PEDESTAL_ROWS = 3;
const MIN_SCALE = 3;
const MAX_SCALE = 8;
/** Used before the first measure and where ResizeObserver is missing (tests). */
const DEFAULT_SCALE = 6;

/** Largest integer scale whose sprite + pedestal fits the element; updates only when it changes. */
function useIntegerScale(ref: RefObject<HTMLElement | null>) {
  const [scale, setScale] = useState(DEFAULT_SCALE);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // The observer reports the initial size too, so no synchronous measure is needed.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const fit = Math.floor(Math.min(width / AVATAR_W, (height - FLOOR_PX) / (AVATAR_H + PEDESTAL_ROWS)));
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

export function CreatorStage({ eyebrow, caption, appearance, race, raceSize, klass, placeholder = false, children }: {
  eyebrow: string;
  /** "<Raza> · <Clase>" */
  caption: string;
  appearance: unknown;
  race: string;
  raceSize?: string | null;
  klass?: string | null;
  /** Nothing chosen yet: the figure is shown as a silhouette. */
  placeholder?: boolean;
  /** Under the pedestal (the name input in Detalles). */
  children?: ReactNode;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const scale = useIntegerScale(slot);
  const style = { '--aura': auraForClass(klass) ?? 'transparent', '--cc-scale': scale } as CSSProperties;

  return (
    <section aria-label="Escenario" className="cc-stage" style={style}>
      <header className="cc-stage__caption">
        <p className="cc-stage__eyebrow">{eyebrow}</p>
        <p className="cc-stage__title">{caption}</p>
      </header>
      <div ref={slot} className="cc-stage__slot">
        <div className="cc-stage__pedestal" aria-hidden />
        <div className={`cc-stage__figure${placeholder ? ' is-placeholder' : ''}`}>
          <PixelAvatar appearance={appearance} race={race} raceSize={raceSize} klass={klass} pulse scale={scale} />
        </div>
      </div>
      {children}
    </section>
  );
}
