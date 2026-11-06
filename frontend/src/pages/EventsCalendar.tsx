import { CampaignResourcePanel } from '../components/content/CampaignResourcePanel';

export function EventsCalendar() {
  return <CampaignResourcePanel kind="events" title="Eventos de campaña" fields={[
    { name: 'title', label: 'Título' },
    { name: 'event_date', label: 'Fecha', type: 'date' },
    { name: 'event_time', label: 'Hora', type: 'time' },
    { name: 'description', label: 'Descripción', type: 'textarea' },
  ]} />;
}
