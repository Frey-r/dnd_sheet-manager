/* Right side of Personalización: the head crop as the VTT token draws it (a disc tinted and
   ringed with the class colour) and as the character lists show it. */
import type { CSSProperties } from 'react';
import { auraForClass } from '../../../lib/avatar';
import { PixelAvatar } from '../../avatar/PixelAvatar';

export function TokenPreview({ appearance, race, raceSize, klass, name, meta }: {
  appearance: unknown;
  race: string;
  raceSize?: string | null;
  klass?: string | null;
  name: string;
  /** Second line of the list card ("Elf · Wizard · Nivel 1"). */
  meta: string;
}) {
  const style = { '--aura': auraForClass(klass) ?? 'var(--line-strong)' } as CSSProperties;
  return (
    <div className="cc-panel cc-token" style={style}>
      <header className="cc-panel__head">
        <h2 className="cc-panel__title">Ficha</h2>
      </header>
      <div className="cc-token__disc">
        <PixelAvatar appearance={appearance} race={race} raceSize={raceSize} klass={klass} aura={false} crop="bust" scale={5} label="Vista previa de la ficha" />
      </div>
      <p className="cc-token__hint">Así se verá tu ficha en la mesa.</p>
      <div className="cc-token__card">
        <span className="cc-token__portrait">
          <PixelAvatar appearance={appearance} race={race} raceSize={raceSize} klass={klass} crop="bust" scale={2} decorative />
        </span>
        <span className="min-w-0">
          <span className="cc-token__name">{name}</span>
          <span className="cc-token__meta">{meta}</span>
        </span>
      </div>
      <p className="cc-token__hint">Y así en la lista de personajes.</p>
    </div>
  );
}
