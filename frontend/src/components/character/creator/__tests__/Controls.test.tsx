/* Colour row of the customization panel (T-6, complement to the locked page tests): ◀ ▶ through the
   palette and from a custom colour, outside click and the grid keys the page tests do not press. */
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColorRow } from '../Controls';

const PALETTE = ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007', '#000008', '#000009', '#00000a'];

function Harness({ initial, onToggleSpy }: { initial: string; onToggleSpy?: (open: boolean) => void }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button">fuera</button>
      <ColorRow
        label="Piel"
        colors={PALETTE}
        value={value}
        open={open}
        onToggle={(next) => { onToggleSpy?.(next); setOpen(next); }}
        onChange={setValue}
      />
      <output aria-label="valor">{value}</output>
    </div>
  );
}

const shown = () => screen.getByLabelText('valor').textContent;

describe('ColorRow', () => {
  it('◀ ▶ recorren la paleta y dan la vuelta en los extremos', async () => {
    const user = userEvent.setup();
    render(<Harness initial={PALETTE[0]} />);
    await user.click(screen.getByRole('button', { name: 'Piel: siguiente' }));
    expect(shown()).toBe(PALETTE[1]);
    await user.click(screen.getByRole('button', { name: 'Piel: anterior' }));
    await user.click(screen.getByRole('button', { name: 'Piel: anterior' }));
    expect(shown(), 'de la primera a la última').toBe(PALETTE[PALETTE.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Piel: siguiente' }));
    expect(shown(), 'de la última a la primera').toBe(PALETTE[0]);
  });

  it('con un color personalizado, ▶ va a la primera muestra y ◀ a la última', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness initial="#123456" />);
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Piel: siguiente' }));
    expect(shown()).toBe(PALETTE[0]);
    unmount();
    render(<Harness initial="#123456" />);
    await user.click(screen.getByRole('button', { name: 'Piel: anterior' }));
    expect(shown()).toBe(PALETTE[PALETTE.length - 1]);
  });

  it('un clic fuera de la fila cierra la grilla; dentro no', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Harness initial={PALETTE[2]} onToggleSpy={onToggle} />);
    await user.click(screen.getByRole('button', { name: 'Piel: elegir color' }));
    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getAllByRole('option')[4]);
    expect(screen.getByRole('listbox'), 'elegir una muestra no la cierra').toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'fuera' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it('teclas de la grilla: ↓ baja una fila, End va a la última y Home a la primera', async () => {
    const user = userEvent.setup();
    render(<Harness initial={PALETTE[1]} />);
    await user.click(screen.getByRole('button', { name: 'Piel: elegir color' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(options[9], '8 columnas: de la 2.ª a la 10.ª').toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(options[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(options[9]).toHaveFocus();
    expect(options[9]).toHaveAttribute('tabindex', '0');
    await user.keyboard('{Home}');
    expect(options[0]).toHaveFocus();
    expect(options.filter((o) => o.tabIndex === 0)).toEqual([options[0]]);
  });
});
