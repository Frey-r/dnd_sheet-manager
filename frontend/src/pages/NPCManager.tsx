import { CampaignResourcePanel } from '../components/content/CampaignResourcePanel';

export function NPCManager() {
  return <CampaignResourcePanel kind="npcs" title="NPCs" linkBase="npcs" fields={[
    { name: 'name', label: 'Nombre' },
    { name: 'role', label: 'Oficio o rol' },
    { name: 'image_url', label: 'Retrato', type: 'image' },
    { name: 'status', label: 'Relación', type: 'select', options: [{ value: 'neutral', label: 'Neutral' }, { value: 'ally', label: 'Aliado' }, { value: 'enemy', label: 'Enemigo' }] },
    { name: 'stats.ac', label: 'Clase de armadura', type: 'number' },
    { name: 'stats.hp', label: 'Puntos de golpe', type: 'number' },
    { name: 'stats.speed', label: 'Velocidad', type: 'number' },
    { name: 'stats.str', label: 'Fuerza', type: 'number' },
    { name: 'stats.dex', label: 'Destreza', type: 'number' },
    { name: 'stats.con', label: 'Constitución', type: 'number' },
    { name: 'stats.int', label: 'Inteligencia', type: 'number' },
    { name: 'stats.wis', label: 'Sabiduría', type: 'number' },
    { name: 'stats.cha', label: 'Carisma', type: 'number' },
    { name: 'description', label: 'Descripción y notas', type: 'textarea' },
  ]} />;
}
