/* Skeleton shared by the player and NPC creators (World of Warcraft layout, character-appearance.md):
   the stage in the centre, a panel column on each side and the bottom action bar (back, the step
   indicator and the primary action). A step opens only when every previous step is valid. */
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ActionBar, StepIndicator } from './ActionBar';

/** Layout of each of the four steps (index.css lays the columns out per `data-step`). */
const STEP_KEYS = ['origin', 'custom', 'abilities', 'details'] as const;

export function CreatorFrame({ title, steps, step, onStep, problems, primaryLabels, busy, busyLabel, onSubmit, stage, start, end, children }: {
  /** Hidden page heading. */
  title: string;
  steps: readonly string[];
  step: number;
  onStep: (i: number) => void;
  /** What blocks each step ('' when it is valid): the hint of the bar and the gate of the next steps. */
  problems: readonly string[];
  /** Primary button of each step; the last one submits. */
  primaryLabels: readonly string[];
  busy: boolean;
  /** Primary label of the last step while submitting. */
  busyLabel: string;
  onSubmit: () => void;
  stage: ReactNode;
  start: ReactNode;
  end: ReactNode;
  /** Notices above the layout (errors, warnings). */
  children?: ReactNode;
}) {
  const firstBlocked = problems.findIndex(Boolean);
  const last = step === steps.length - 1;
  const ready = firstBlocked === -1;

  return (
    <div className="cc" data-step={STEP_KEYS[step]}>
      <h1 className="sr-only">{title}</h1>
      {children}
      <div className="cc-layout">
        {stage}
        <div className="cc-side cc-side--start">{start}</div>
        <div className="cc-side cc-side--end">{end}</div>
      </div>

      <ActionBar
        label="Acciones del creador"
        start={(
          <button type="button" onClick={() => onStep(step - 1)} disabled={step === 0} className="mc-btn cc-back">
            <ChevronLeft size={16} aria-hidden /><span className="cc-back__text">Atrás</span>
          </button>
        )}
        center={(
          <StepIndicator
            steps={steps}
            current={step}
            done={(i) => i < step && !problems[i]}
            reachable={(i) => ready || i <= firstBlocked}
            hint={problems[step] || `Paso ${step + 1} de ${steps.length}`}
            onStep={onStep}
          />
        )}
        end={(
          <button type="button" onClick={last ? onSubmit : () => onStep(step + 1)} disabled={busy || (last ? !ready : Boolean(problems[step]))} className="mc-btn mc-btn-primary cc-primary">
            {last && busy ? busyLabel : primaryLabels[step]}{!last && <ChevronRight size={17} aria-hidden />}
          </button>
        )}
      />
    </div>
  );
}
