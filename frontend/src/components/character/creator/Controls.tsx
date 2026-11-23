/* Customization rows in the style of the WoW panel: a label and a wide ◀ value ▶ control.
   Colour rows show the current swatch; "elegir color" opens a swatch grid (listbox) with the
   custom colour picker under it. ◀ ▶ cycle through the options or the swatches. */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const ARROWS = { [-1]: ['anterior', ChevronLeft], [1]: ['siguiente', ChevronRight] } as const;

function Arrow({ label, dir, onClick }: { label: string; dir: -1 | 1; onClick: () => void }) {
  const [word, Icon] = ARROWS[dir];
  return (
    <button type="button" onClick={onClick} aria-label={`${label}: ${word}`} className="cc-stepper__arrow">
      <Icon size={18} aria-hidden />
    </button>
  );
}

/**
 * Index after stepping `d` through `n` options, wrapping around. From -1 (a custom colour, not in
 * the palette) ▶ lands on the first option and ◀ on the last.
 */
function cycle(index: number, d: -1 | 1, n: number) {
  if (index < 0) return d > 0 ? 0 : n - 1;
  return (index + d + n) % n;
}

export function OptionRow({ label, options, index, onChange }: {
  label: string;
  options: readonly string[];
  index: number;
  onChange: (next: number) => void;
}) {
  const id = useId();
  const count = options.length;
  const step = (d: -1 | 1) => onChange(cycle(index, d, count));
  return (
    <div role="group" aria-labelledby={id} className="cc-row">
      <span id={id} className="cc-row__label">{label}</span>
      <div className="cc-stepper">
        <Arrow label={label} dir={-1} onClick={() => step(-1)} />
        <div className="cc-stepper__value">
          <span className="cc-stepper__text" aria-live="polite">{options[index] ?? '—'}</span>
          <span className="cc-stepper__count" aria-hidden>{index + 1} / {count}</span>
        </div>
        <Arrow label={label} dir={1} onClick={() => step(1)} />
      </div>
    </div>
  );
}

export function ColorRow({ label, colors, value, open, onToggle, onChange }: {
  label: string;
  colors: readonly string[];
  value: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  const listboxId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const index = colors.indexOf(value);
  const step = (d: -1 | 1) => onChange(colors[cycle(index, d, colors.length)]);

  // Close when the pointer goes down anywhere outside this row (the focus stays where it went).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) onToggle(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, onToggle]);

  // Escape: close and give the focus back to the button.
  const close = () => { onToggle(false); trigger.current?.focus(); };

  return (
    <div ref={root} role="group" aria-labelledby={id} className="cc-row">
      <span id={id} className="cc-row__label">{label}</span>
      <div className="cc-stepper">
        <Arrow label={label} dir={-1} onClick={() => step(-1)} />
        <button
          ref={trigger}
          type="button"
          onClick={() => onToggle(!open)}
          aria-label={`${label}: elegir color`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          className="cc-stepper__value cc-stepper__value--color"
        >
          <span className="cc-swatch" style={{ background: value }} aria-hidden />
          <span className="cc-stepper__text" aria-live="polite">{index === -1 ? 'Personalizado' : `Tono ${index + 1}`}</span>
          <ChevronDown size={14} aria-hidden className={`cc-stepper__caret${open ? ' is-open' : ''}`} />
        </button>
        <Arrow label={label} dir={1} onClick={() => step(1)} />
      </div>
      {open && <SwatchPopover id={listboxId} label={label} colors={colors} value={value} onChange={onChange} onClose={close} />}
    </div>
  );
}

const GRID_COLUMNS = 8;

function SwatchPopover({ id, label, colors, value, onChange, onClose }: {
  id: string;
  label: string;
  colors: readonly string[];
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const index = colors.indexOf(value);
  const custom = index === -1;
  // Roving tabindex: the active swatch is the only tabbable one and holds the focus.
  const [active, setActive] = useState(custom ? 0 : index);
  // ◀ ▶ can change the colour while the grid is open: the active swatch follows the selection.
  const [selected, setSelected] = useState(index);
  if (index !== selected) {
    setSelected(index);
    if (index !== -1) setActive(index);
  }

  // Focus the active swatch when the grid opens.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if ((e.target as HTMLElement).getAttribute('role') !== 'option') return;
    const last = colors.length - 1;
    const move: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: GRID_COLUMNS, ArrowUp: -GRID_COLUMNS };
    let next = -1;
    if (e.key in move) next = Math.max(0, Math.min(last, active + move[e.key]));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === -1) return;
    e.preventDefault();
    setActive(next);
    list.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus();
  };

  return (
    <div className="cc-popover" onKeyDown={onKeyDown}>
      <div ref={list} id={id} role="listbox" aria-label={`${label}: muestras`} className="cc-swatch-grid" style={{ '--cols': GRID_COLUMNS } as CSSProperties}>
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            role="option"
            aria-selected={c === value}
            aria-label={`Tono ${i + 1}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => { setActive(i); onChange(c); }}
            className="cc-swatch-option"
            style={{ background: c }}
          />
        ))}
      </div>
      <label className={`cc-custom-color${custom ? ' is-active' : ''}`}>
        <span className="cc-custom-color__chip" style={custom ? { background: value } : undefined} aria-hidden />
        <span>Color personalizado</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: color personalizado`} />
      </label>
    </div>
  );
}
