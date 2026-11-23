/* Portrait of a campaign NPC (character-appearance.md § NPC creator): the pixel avatar when it has a
   race or an appearance, else the uploaded portrait, else its initials (NPCs created before T-13). */
import type { NPC } from '../../types';
import { PixelAvatar } from './PixelAvatar';

/** "Viejo Marlo" → "VM". */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function NPCPortrait({ npc, crop, scale, frame, fallbackFrame = frame }: {
  npc: Pick<NPC, 'name' | 'race' | 'class' | 'appearance' | 'image_url'>;
  /** Head crop on list cards, full sprite (with aura and class prop) on the detail. */
  crop: 'bust' | 'full';
  scale: number;
  /** Classes of the frame around the pixel avatar, and around the portrait or initials. */
  frame: string;
  fallbackFrame?: string;
}) {
  const label = `Retrato de ${npc.name}`;
  if (npc.race || npc.appearance) {
    return (
      <span className={frame}>
        <PixelAvatar appearance={npc.appearance} race={npc.race} klass={npc.class} crop={crop} aura={crop === 'full'} scale={scale} label={label} />
      </span>
    );
  }
  return (
    <span className={fallbackFrame}>
      {npc.image_url ? <img src={npc.image_url} alt={label} loading="lazy" className="h-full w-full object-cover" /> : <span aria-hidden className="font-bold">{initials(npc.name)}</span>}
    </span>
  );
}
