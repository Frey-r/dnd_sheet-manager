import { CampaignResourcePanel } from '../components/content/CampaignResourcePanel';

export function MapGallery() {
  return <CampaignResourcePanel kind="maps" title="Mapas" linkBase="maps" addLabel="Nuevo mapa" fields={[
    { name: 'name', label: 'Nombre' },
    { name: 'location', label: 'Ubicación' },
    { name: 'image_url', label: 'Imagen', type: 'image' },
    { name: 'description', label: 'Descripción', type: 'textarea' },
  ]} />;
}
