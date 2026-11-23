/* Personalización (WoW customization panel): every appearance option as a ◀ value ▶ row,
   colour rows with a swatch grid, and a random look. Shared by the creator and the editor. */
import { useId, useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import {
  BODIES, CLOTH, EYES, HAIR, HAIR_STYLES, OUTFITS, randomAppearance, skinsFor,
  type Appearance, type RaceVisual,
} from '../../../lib/avatar';
import { ColorRow, OptionRow } from './Controls';

type ColorKey = 'skin' | 'eyes' | 'hairColor' | 'outfit0' | 'outfit1';

export function CustomizePanel({ value, visual, onChange }: {
  value: Appearance;
  visual: RaceVisual;
  onChange: (next: Appearance) => void;
}) {
  const headingId = useId();
  const [open, setOpen] = useState<ColorKey | null>(null);
  const set = <K extends keyof Appearance>(key: K, v: Appearance[K]) => onChange({ ...value, [key]: v });
  // One swatch grid open at a time; stable callbacks keep the rows' outside-click listeners put.
  const toggles = useMemo(() => {
    const make = (key: ColorKey) => (next: boolean) => setOpen((cur) => (next ? key : cur === key ? null : cur));
    return { skin: make('skin'), eyes: make('eyes'), hairColor: make('hairColor'), outfit0: make('outfit0'), outfit1: make('outfit1') };
  }, []);
  const color = (key: ColorKey, label: string, colors: readonly string[], current: string, apply: (hex: string) => void) => (
    <ColorRow label={label} colors={colors} value={current} open={open === key} onToggle={toggles[key]} onChange={apply} />
  );

  return (
    <section aria-labelledby={headingId} className="cc-panel cc-custom">
      <header className="cc-panel__head">
        <h2 id={headingId} className="cc-panel__title">Personalización</h2>
        <button type="button" onClick={() => { setOpen(null); onChange(randomAppearance(visual)); }} className="mc-btn mc-btn-sm cc-random">
          <Dices size={15} aria-hidden /> Aleatorio
        </button>
      </header>
      <div className="cc-scroll cc-rows">
        <OptionRow label="Tipo de cuerpo" options={BODIES} index={value.body} onChange={(i) => set('body', i === 1 ? 1 : 0)} />
        {color('skin', 'Piel', skinsFor(visual), value.skin, (c) => set('skin', c))}
        {color('eyes', 'Ojos', EYES, value.eyes, (c) => set('eyes', c))}
        {visual.hair && <OptionRow label="Peinado" options={HAIR_STYLES} index={value.hair} onChange={(i) => set('hair', i)} />}
        {color('hairColor', visual.hair ? 'Color de pelo' : (visual.accentLabel ?? 'Color de acento'), HAIR, value.hairColor, (c) => set('hairColor', c))}
        {visual.options.length > 1 && (
          <OptionRow label="Rasgo racial" options={visual.options.map((o) => o.label)} index={value.feature} onChange={(i) => set('feature', i)} />
        )}
        <OptionRow label="Atuendo" options={OUTFITS} index={value.outfit} onChange={(i) => set('outfit', i)} />
        {color('outfit0', 'Color principal', CLOTH, value.outfitColors[0], (c) => set('outfitColors', [c, value.outfitColors[1]]))}
        {color('outfit1', 'Color secundario', CLOTH, value.outfitColors[1], (c) => set('outfitColors', [value.outfitColors[0], c]))}
      </div>
    </section>
  );
}
