/* NPC list (frontend-screens.md § 10.1): cards with the NPC pixel head crop (or the uploaded portrait,
   or the initials); "Añadir NPC" and "Editar" open the NPC creator (character-appearance.md § NPC creator). */
import { CampaignResourcePanel, type Resource } from '../components/content/CampaignResourcePanel';
import { NPCPortrait } from '../components/avatar/NPCPortrait';
import type { NPC } from '../types';

const FRAME = 'avatar-stage grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-low-contrast text-xl text-secondary';
const thumbnail = (npc: Resource) => <NPCPortrait npc={npc as unknown as NPC} crop="bust" scale={2} frame={FRAME} />;

export function NPCManager() {
  return <CampaignResourcePanel kind="npcs" title="NPCs" linkBase="npcs" fields={[]} editorPage thumbnail={thumbnail} />;
}
