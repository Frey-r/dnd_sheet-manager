/* T-22 · contratos/T-22-ruta-pluma.md — P6: configuring a route when the pen finishes. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RouteFinishDialog } from '../NpcRoutinePanel';

const pts = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 250 }];

describe('RouteFinishDialog (P6)', () => {
  it('an open path offers Ida and Ida y vuelta, not Ciclo', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<RouteFinishDialog tokenName="Guardia" points={pts} closed={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Ruta de Guardia/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ciclo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ida y vuelta' }));
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'pingpong', points: pts });
  });

  it('Ida is a one-way route', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<RouteFinishDialog tokenName="Guardia" points={pts} closed={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Ida' }));
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'once', points: pts });
  });

  it('a closed path is a cycle and carries the wait per point', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<RouteFinishDialog tokenName="Guardia" points={pts} closed onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ida' })).not.toBeInTheDocument();
    const wait = screen.getByLabelText('Espera en cada punto (s)');
    await user.clear(wait);
    await user.type(wait, '3');
    await user.click(screen.getByRole('button', { name: 'Ciclo' }));
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'loop', points: pts.map((p) => ({ ...p, wait_s: 3 })) });
  });

  it('Cancelar discards the path', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<RouteFinishDialog tokenName="Guardia" points={pts} closed={false} onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
