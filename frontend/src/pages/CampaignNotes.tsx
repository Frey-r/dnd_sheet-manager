import { CampaignResourcePanel } from '../components/content/CampaignResourcePanel';

export function CampaignNotes() {
  return <CampaignResourcePanel kind="notes" title="Notas de campaña" fields={[
    { name: 'title', label: 'Título' },
    { name: 'content', label: 'Contenido', type: 'textarea' },
  ]} />;
}
