/* Bottom action bar of the creator (WoW layout): back on the left, the step indicator in the
   middle and the primary action on the right. Shared by the appearance editor. */
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export function ActionBar({ label, start, center, end }: { label: string; start: ReactNode; center: ReactNode; end: ReactNode }) {
  return (
    <nav aria-label={label} className="cc-bar">
      <div className="cc-bar__start">{start}</div>
      <div className="cc-bar__center">{center}</div>
      <div className="cc-bar__end">{end}</div>
    </nav>
  );
}

/** Numbered steps; a step is reachable only when the previous ones are valid. */
export function StepIndicator({ steps, current, done, reachable, hint, onStep }: {
  steps: readonly string[];
  current: number;
  done: (i: number) => boolean;
  reachable: (i: number) => boolean;
  hint: string;
  onStep: (i: number) => void;
}) {
  return (
    <div className="cc-steps-wrap">
      <ol className="cc-steps" aria-label="Pasos">
        {steps.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={!reachable(i)}
              onClick={() => onStep(i)}
              aria-current={i === current ? 'step' : undefined}
              className={`cc-step${done(i) ? ' is-done' : ''}`}
            >
              <span className="cc-step__dot">{done(i) ? <Check size={11} strokeWidth={3} aria-hidden /> : i + 1}</span>
              <span className="cc-step__label">{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="cc-bar__hint" aria-live="polite">{hint}</p>
    </div>
  );
}
