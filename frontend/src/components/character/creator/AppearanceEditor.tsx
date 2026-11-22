/* Appearance controls (character-appearance.md): body, skin, eyes, hair, outfit, race option. */
import { Shuffle } from 'lucide-react';
import {
  BODIES, CLOTH, EYES, HAIR, HAIR_STYLES, OUTFITS, randomAppearance, skinsFor,
  type Appearance, type RaceVisual,
} from '../../../lib/avatar';
import { ColorSwatches, OptionStepper } from './Controls';

export function AppearanceEditor({ value, visual, onChange }: {
  value: Appearance;
  visual: RaceVisual;
  onChange: (next: Appearance) => void;
}) {
  const set = <K extends keyof Appearance>(key: K, v: Appearance[K]) => onChange({ ...value, [key]: v });
  const outfitLabel = (i: number) => OUTFITS[i] ?? '—';
  const hairLabel = (i: number) => HAIR_STYLES[i] ?? '—';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="mc-eyebrow">Apariencia · {visual.label}</h2>
        <button type="button" onClick={() => onChange(randomAppearance(visual))} className="mc-btn h-8 gap-1.5 px-3 text-[12.5px]"><Shuffle size={14} /> Aleatorio</button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <OptionStepper label="Cuerpo" value={value.body} count={2} display={BODIES[value.body]} onChange={(i) => set('body', i === 1 ? 1 : 0)} />
        {visual.options.length > 1 && (
          <OptionStepper label="Rasgo racial" value={value.feature} count={visual.options.length} display={visual.options[value.feature]?.label ?? '—'} onChange={(i) => set('feature', i)} />
        )}
        {visual.hair && (
          <OptionStepper label="Peinado" value={value.hair} count={HAIR_STYLES.length} display={hairLabel(value.hair)} onChange={(i) => set('hair', i)} />
        )}
        <OptionStepper label="Atuendo" value={value.outfit} count={OUTFITS.length} display={outfitLabel(value.outfit)} onChange={(i) => set('outfit', i)} />
      </div>

      <ColorSwatches label="Piel" colors={skinsFor(visual)} value={value.skin} onChange={(c) => set('skin', c)} />
      <ColorSwatches label="Ojos" colors={EYES} value={value.eyes} onChange={(c) => set('eyes', c)} />
      <ColorSwatches label={visual.hair ? 'Pelo' : (visual.accentLabel ?? 'Color de acento')} colors={HAIR} value={value.hairColor} onChange={(c) => set('hairColor', c)} />
      <ColorSwatches label="Atuendo · color principal" colors={CLOTH} value={value.outfitColors[0]} onChange={(c) => set('outfitColors', [c, value.outfitColors[1]])} />
      <ColorSwatches label="Atuendo · color secundario" colors={CLOTH} value={value.outfitColors[1]} onChange={(c) => set('outfitColors', [value.outfitColors[0], c])} />
    </div>
  );
}
