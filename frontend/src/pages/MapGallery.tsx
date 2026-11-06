import { CampaignResourcePanel } from '../components/content/CampaignResourcePanel';

export function MapGallery() {
  return <CampaignResourcePanel kind="maps" title="Mapas" linkBase="maps" fields={[
    { name: 'name', label: 'Nombre' },
    { name: 'location', label: 'Ubicación' },
    { name: 'image_url', label: 'URL de la imagen', type: 'url' },
    { name: 'description', label: 'Descripción', type: 'textarea' },
  ]} />;
}
