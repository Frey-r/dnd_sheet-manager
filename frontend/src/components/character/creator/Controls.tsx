/* Small controls for the appearance editor: ◀ value ▶ steppers and colour swatches. */
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function OptionStepper({ label, value, count, display, onChange }: {
  label: string;
  value: number;
  count: number;
  display: string;
  onChange: (next: number) => void;
}) {
  const step = (d: number) => onChange((value + d + count) % count);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => step(-1)} aria-label={`${label}: anterior`} className="mc-btn mc-btn-sm mc-btn-icon"><ChevronLeft size={16} /></button>
        <span className="min-w-[8.5rem] text-center text-[13px] font-semibold" aria-live="polite">{display}</span>
        <button type="button" onClick={() => step(1)} aria-label={`${label}: siguiente`} className="mc-btn mc-btn-sm mc-btn-icon"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function ColorSwatches({ label, colors, value, onChange }: {
  label: string;
  colors: readonly string[];
  value: string;
  onChange: (hex: string) => void;
}) {
  const custom = !colors.includes(value);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-[12.5px] font-medium text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`${label} ${c}`}
            aria-pressed={value === c}
            className={`h-7 w-7 rounded-md border transition-transform ${value === c ? 'scale-110 border-ink ring-2 ring-accent' : 'border-line-strong hover:scale-105'}`}
            style={{ background: c }}
          />
        ))}
        <label className={`relative h-7 w-7 cursor-pointer overflow-hidden rounded-md border ${custom ? 'border-ink ring-2 ring-accent' : 'border-dashed border-line-strong'}`} title="Otro color">
          <span className="sr-only">{label}: otro color</span>
          <span className="absolute inset-0" style={{ background: custom ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </fieldset>
  );
}
