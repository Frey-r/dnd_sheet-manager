/* NPCPortrait (T-14 C6, complement to the locked NPCCreator tests): the pixel avatar is drawn when the NPC has a
   race OR a stored appearance; NPCs created before T-13 fall back to the uploaded portrait or their initials.
   The bust crop never shows the aura; the full sprite does. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NPCPortrait } from '../NPCPortrait';
import { AVATAR_H } from '../../../lib/avatar';
import { NPC_PIP, NPC_PLAIN, NPC_PORTRAIT } from '../../../test/catalog-npc';

const portrait = () => screen.getByRole('img', { name: /^Retrato de / });

describe('NPCPortrait · avatar pixel, retrato subido o iniciales (T-14 C6)', () => {
  it('con apariencia pero sin raza: dibuja el avatar pixel, no el retrato subido', () => {
    const { container } = render(
      <NPCPortrait npc={{ ...NPC_PORTRAIT, appearance: NPC_PIP.appearance }} crop="bust" scale={2} frame="marco-pixel" fallbackFrame="marco-foto" />,
    );
    expect(portrait().tagName).toBe('CANVAS');
    expect(portrait()).toHaveAccessibleName(`Retrato de ${NPC_PORTRAIT.name}`);
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toHaveClass('marco-pixel');
  });

  it('con raza pero sin apariencia: dibuja el avatar pixel de esa raza', () => {
    const { container } = render(
      <NPCPortrait npc={{ ...NPC_PLAIN, race: NPC_PIP.race }} crop="bust" scale={2} frame="marco-pixel" fallbackFrame="marco-foto" />,
    );
    expect(portrait().tagName).toBe('CANVAS');
    expect(screen.queryByText('VM')).toBeNull();
    expect(container.firstElementChild).toHaveClass('marco-pixel');
  });

  it('busto sin aura y sprite completo con el aura de la clase', () => {
    const { unmount } = render(<NPCPortrait npc={NPC_PIP} crop="bust" scale={2} frame="f" />);
    expect(Number(portrait().getAttribute('height'))).toBeLessThan(AVATAR_H);
    expect(portrait().style.getPropertyValue('--aura')).toBe('transparent');
    unmount();
    render(<NPCPortrait npc={NPC_PIP} crop="full" scale={2} frame="f" />);
    expect(Number(portrait().getAttribute('height'))).toBe(AVATAR_H);
    expect(portrait().style.getPropertyValue('--aura')).not.toMatch(/^(transparent)?$/);
  });

  it('sin raza ni apariencia: el retrato subido con el marco de respaldo', () => {
    const { container } = render(<NPCPortrait npc={NPC_PORTRAIT} crop="bust" scale={2} frame="marco-pixel" fallbackFrame="marco-foto" />);
    expect(portrait().tagName).toBe('IMG');
    expect(portrait()).toHaveAttribute('src', NPC_PORTRAIT.image_url);
    expect(container.firstElementChild).toHaveClass('marco-foto');
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('sin nada: las iniciales de las dos primeras palabras, con el marco por defecto', () => {
    const { container } = render(<NPCPortrait npc={{ ...NPC_PLAIN, name: '  viejo   marlo el barquero ' }} crop="bust" scale={2} frame="marco-pixel" />);
    expect(screen.getByText('VM')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('marco-pixel');
    expect(container.querySelector('canvas, img')).toBeNull();
  });
});
