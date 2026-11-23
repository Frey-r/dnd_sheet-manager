/* PixelAvatar (T-11 P6, complement to the locked CustomSkin tests): the class aura is on by default, the pulse only
   when asked for, the accessible name and the decorative mode, and the crop and scale of the canvas.
   Sensor: `avatarCanvas` returns what it was asked to paint and each canvas gets a 2D context that records drawImage. */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PixelAvatar } from '../PixelAvatar';
import { auraForClass, cropRect, defaultAppearance, resolveRaceVisual } from '../../../lib/avatar';
import { avatarCanvas } from '../../../lib/avatar/render';

vi.mock(import('../../../lib/avatar/render'), async (importOriginal) => ({
  ...(await importOriginal()),
  avatarCanvas: vi.fn(),
}));

interface Painted { aura: string | null | undefined; klass: string | null | undefined }
const drawImage = vi.fn();
const clearRect = vi.fn();

const HUMAN = resolveRaceVisual('Human');
const WIZARD_AURA = auraForClass('Wizard');

const canvasOf = (container: HTMLElement) => container.querySelector('canvas')!;
const auraOf = (canvas: HTMLCanvasElement) => canvas.style.getPropertyValue('--aura');
/** What the last drawImage painted: the avatarCanvas source and the crop rectangle it was cut from. */
const lastPaint = () => {
  const [src, x, y, w, h, dx, dy, dw, dh] = drawImage.mock.calls.at(-1)!;
  return { src: src as Painted, from: { x, y, w, h }, to: { dx, dy, dw, dh } };
};

beforeEach(() => {
  vi.mocked(avatarCanvas).mockImplementation((_a, _v, aura, klass) => ({ aura, klass }) as unknown as HTMLCanvasElement);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ({ drawImage, clearRect })) as unknown as HTMLCanvasElement['getContext'],
  );
  drawImage.mockClear();
  clearRect.mockClear();
});

describe('PixelAvatar · aura, pulso, accesibilidad y recorte (T-11 P6)', () => {
  it('fixture: la clase tiene un color de aura', () => {
    expect(WIZARD_AURA).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('el aura de la clase está encendida por defecto: el canvas la expone en --aura y el sprite se pinta con ella', () => {
    const { container } = render(<PixelAvatar race="Human" klass="Wizard" />);
    expect(auraOf(canvasOf(container))).toBe(WIZARD_AURA);
    expect(lastPaint().src.aura, 'aura con la que se pinta el sprite').toBe(WIZARD_AURA);
  });

  it('aura={false} apaga el aura: --aura transparente y el sprite sin aura', () => {
    const { container } = render(<PixelAvatar race="Human" klass="Wizard" aura={false} />);
    expect(auraOf(canvasOf(container))).toBe('transparent');
    expect(lastPaint().src.aura).toBeNull();
  });

  it('sin clase no hay aura aunque esté encendida', () => {
    const { container } = render(<PixelAvatar race="Human" />);
    expect(auraOf(canvasOf(container))).toBe('transparent');
    expect(lastPaint().src.aura).toBeNull();
  });

  it('el pulso solo se activa cuando se pide y hay aura', () => {
    const quiet = render(<PixelAvatar race="Human" klass="Wizard" />);
    expect(canvasOf(quiet.container), 'por defecto no pulsa').not.toHaveClass('avatar-pulse');
    quiet.unmount();

    const pulsing = render(<PixelAvatar race="Human" klass="Wizard" pulse className="extra" />);
    expect(canvasOf(pulsing.container)).toHaveClass('avatar-pixel', 'avatar-pulse', 'extra');
    pulsing.unmount();

    const noAura = render(<PixelAvatar race="Human" klass="Wizard" pulse aura={false} />);
    expect(canvasOf(noAura.container), 'sin aura no hay pulso').not.toHaveClass('avatar-pulse');
  });

  it('nombre accesible: la raza en minúsculas, "personaje" sin raza, o la etiqueta dada; nunca oculto', () => {
    const human = render(<PixelAvatar race="Human" klass="Wizard" />);
    const img = screen.getByRole('img', { name: `Retrato de ${HUMAN.label.toLowerCase()}` });
    expect(img).not.toHaveAttribute('aria-hidden');
    human.unmount();

    const anonymous = render(<PixelAvatar />);
    expect(screen.getByRole('img', { name: 'Retrato de personaje' })).not.toHaveAttribute('aria-hidden');
    anonymous.unmount();

    render(<PixelAvatar race="Human" label="Lyra" />);
    expect(screen.getByRole('img', { name: 'Lyra' })).toBeInTheDocument();
  });

  it('decorative oculta el retrato a la tecnología de asistencia: sin rol img ni nombre, con aria-hidden', () => {
    const { container } = render(<PixelAvatar race="Human" klass="Wizard" decorative label="Lyra" />);
    const canvas = canvasOf(container);
    expect(screen.queryByRole('img')).toBeNull();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas).not.toHaveAttribute('aria-label');
    expect(canvas).not.toHaveAttribute('role');
  });

  it('sprite completo: canvas del tamaño del sprite, ancho escalado y el objeto de la clase en la mano', () => {
    const full = cropRect(HUMAN, defaultAppearance(HUMAN), 'full');
    const { container } = render(<PixelAvatar race="Human" klass="Wizard" scale={3} />);
    const canvas = canvasOf(container);
    expect([canvas.width, canvas.height]).toEqual([full.w, full.h]);
    expect(canvas.style.width).toBe(`${full.w * 3}px`);
    expect(canvas.style.aspectRatio).toBe(`${full.w} / ${full.h}`);
    expect(clearRect).toHaveBeenCalledWith(0, 0, full.w, full.h);
    const paint = lastPaint();
    expect(paint.src.klass, 'el sprite completo lleva el objeto de la clase').toBe('Wizard');
    expect(paint.from).toEqual({ x: full.x, y: full.y, w: full.w, h: full.h });
    expect(paint.to).toEqual({ dx: 0, dy: 0, dw: full.w, dh: full.h });
  });

  it('busto: recorta la cabeza del sprite, sin el objeto de la clase, con la escala por defecto (4)', () => {
    const bust = cropRect(HUMAN, defaultAppearance(HUMAN), 'bust');
    expect(bust.w, 'fixture: el busto es más pequeño que el sprite').toBeLessThan(cropRect(HUMAN, defaultAppearance(HUMAN), 'full').w);
    const { container } = render(<PixelAvatar race="Human" klass="Wizard" crop="bust" />);
    const canvas = canvasOf(container);
    expect([canvas.width, canvas.height]).toEqual([bust.w, bust.h]);
    expect(canvas.style.width).toBe(`${bust.w * 4}px`);
    const paint = lastPaint();
    expect(paint.src.klass, 'los recortes de cabeza no llevan objeto').toBeNull();
    expect(paint.from).toEqual({ x: bust.x, y: bust.y, w: bust.w, h: bust.h });
  });
});
