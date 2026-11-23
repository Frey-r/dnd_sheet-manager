/* CreatorFrame (T-14, complement to the locked creator tests): the step layout (`data-step`), the back and primary
   buttons, the steps marked done, the steps that stay locked behind the first invalid one, the hint of the bar and
   "Guardando…" on the last step while it submits. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreatorFrame } from '../CreatorFrame';

const STEPS = ['Origen', 'Personalización', 'Estadísticas', 'Detalles'] as const;
const LABELS = ['Personalizar', 'Siguiente', 'Revisar', 'Crear PNJ'] as const;

function renderFrame({ step = 0, problems = ['', '', '', ''], busy = false }: { step?: number; problems?: string[]; busy?: boolean } = {}) {
  const onStep = vi.fn();
  const onSubmit = vi.fn();
  const view = render(
    <CreatorFrame
      title="Crear PNJ"
      steps={STEPS}
      step={step}
      onStep={onStep}
      problems={problems}
      primaryLabels={LABELS}
      busy={busy}
      busyLabel="Guardando…"
      onSubmit={onSubmit}
      stage={<section aria-label="Escenario" />}
      start={<p>Columna izquierda</p>}
      end={<p>Columna derecha</p>}
    >
      <p role="alert">Aviso</p>
    </CreatorFrame>,
  );
  return { ...view, onStep, onSubmit, user: userEvent.setup() };
}

const bar = () => screen.getByRole('navigation', { name: 'Acciones del creador' });
const steps = () => within(within(bar()).getByRole('list', { name: 'Pasos' })).getAllByRole('button');
const back = () => within(bar()).getByRole('button', { name: 'Atrás' });
const hint = (container: HTMLElement) => container.querySelector('.cc-bar__hint')?.textContent;

describe('CreatorFrame · pasos, barra y bloqueo (T-14)', () => {
  it('título oculto, avisos antes del escenario y columnas en su sitio', () => {
    const { container } = renderFrame();
    expect(screen.getByRole('heading', { level: 1, name: 'Crear PNJ' })).toHaveClass('sr-only');
    const alert = screen.getByRole('alert');
    expect(alert.compareDocumentPosition(screen.getByRole('region', { name: 'Escenario' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.cc-side--start')).toHaveTextContent('Columna izquierda');
    expect(container.querySelector('.cc-side--end')).toHaveTextContent('Columna derecha');
  });

  it.each([[0, 'origin'], [1, 'custom'], [2, 'abilities'], [3, 'details']])('paso %i → data-step="%s"', (step, key) => {
    const { container } = renderFrame({ step });
    expect(container.firstElementChild).toHaveAttribute('data-step', key);
  });

  it('en el primer paso "Atrás" está deshabilitado; en los demás vuelve al anterior', async () => {
    renderFrame();
    expect(back()).toBeDisabled();
    const { user, onStep } = renderFrame({ step: 2 });
    const backs = screen.getAllByRole('button', { name: 'Atrás' });
    expect(backs[1]).toBeEnabled();
    await user.click(backs[1]);
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('el botón principal avanza al paso siguiente y no envía', async () => {
    const { user, onStep, onSubmit } = renderFrame({ step: 1 });
    const primary = within(bar()).getByRole('button', { name: 'Siguiente' });
    expect(primary.querySelector('svg'), 'flecha de avanzar').not.toBeNull();
    await user.click(primary);
    expect(onStep).toHaveBeenCalledWith(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('un problema del paso actual deshabilita el principal y se muestra como pista', () => {
    const { container } = renderFrame({ problems: ['Elige una raza.', '', '', ''] });
    expect(within(bar()).getByRole('button', { name: 'Personalizar' })).toBeDisabled();
    expect(hint(container)).toBe('Elige una raza.');
  });

  it('sin problema en el paso, la pista dice el número de paso aunque un paso posterior falle', () => {
    const { container } = renderFrame({ step: 1, problems: ['', '', '', 'Ponle nombre al PNJ.'] });
    expect(within(bar()).getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    expect(hint(container)).toBe('Paso 2 de 4');
  });

  it('pasos hechos: los anteriores válidos llevan check; el actual, los siguientes y los anteriores con problema no', () => {
    renderFrame({ step: 2, problems: ['', 'Falta algo', '', ''] });
    const [origin, custom, abilities, details] = steps();
    expect(origin).toHaveClass('is-done');
    expect(origin).toHaveTextContent(/^Origen$/);
    expect(custom).not.toHaveClass('is-done');
    expect(custom).toHaveTextContent(/^2Personalización$/);
    expect(abilities).not.toHaveClass('is-done');
    expect(abilities).toHaveTextContent(/^3Estadísticas$/);
    expect(abilities).toHaveAttribute('aria-current', 'step');
    expect(details).not.toHaveClass('is-done');
  });

  it('los pasos tras el primero inválido quedan bloqueados; ese y los anteriores se pueden abrir', async () => {
    const { user, onStep } = renderFrame({ step: 0, problems: ['', 'Falta algo', '', ''] });
    const [origin, custom, abilities, details] = steps();
    expect(origin).toBeEnabled();
    expect(custom).toBeEnabled();
    expect(abilities).toBeDisabled();
    expect(details).toBeDisabled();
    await user.click(custom);
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('sin problemas todos los pasos se pueden abrir', () => {
    renderFrame({ step: 0 });
    for (const button of steps()) expect(button).toBeEnabled();
  });

  it('último paso: el principal envía, sin flecha', async () => {
    const { user, onStep, onSubmit } = renderFrame({ step: 3 });
    const primary = within(bar()).getByRole('button', { name: 'Crear PNJ' });
    expect(primary.querySelector('svg')).toBeNull();
    await user.click(primary);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('último paso: un problema en un paso anterior también impide enviar', () => {
    renderFrame({ step: 3, problems: ['Elige una clase.', '', '', ''] });
    expect(within(bar()).getByRole('button', { name: 'Crear PNJ' })).toBeDisabled();
  });

  it('último paso enviando: "Guardando…" y deshabilitado', () => {
    renderFrame({ step: 3, busy: true });
    const primary = within(bar()).getByRole('button', { name: 'Guardando…' });
    expect(primary).toBeDisabled();
    expect(within(bar()).queryByRole('button', { name: 'Crear PNJ' })).toBeNull();
  });

  it('un paso intermedio ocupado conserva su etiqueta y queda deshabilitado', () => {
    renderFrame({ step: 0, busy: true });
    expect(within(bar()).getByRole('button', { name: 'Personalizar' })).toBeDisabled();
    expect(within(bar()).queryByRole('button', { name: 'Guardando…' })).toBeNull();
  });
});
