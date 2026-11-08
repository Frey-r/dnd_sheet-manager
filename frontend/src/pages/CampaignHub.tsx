import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { campaignApi, characterApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import { useRealtime } from '../lib/RealtimeContext';
import type { Campaign, Character, CampaignMember } from '../types';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { PixelAvatar } from '../components/avatar/PixelAvatar';
import { splitSource } from '../lib/avatar';

export function CampaignHub() {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const connection = useRealtime();
  const campaign = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => campaignApi.get(campaignId).then((response) => response.data as Campaign) });
  const members = useQuery({ queryKey: ['campaign-members', campaignId], queryFn: () => campaignApi.members(campaignId).then((response) => response.data as CampaignMember[]) });
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => characterApi.listByCampaign(campaignId).then((response) => response.data as Character[]) });
  const isGM = members.data?.some((member) => member.user_id === user?.id && member.role === 'gm');
  if (campaign.isLoading) return <LoadingState label="Cargando campaña…" />;
  if (campaign.error || !campaign.data) return <div className="p-8"><ErrorState message="Campaña no encontrada" /><Link to="/campaigns" className="text-primary font-label-bold">Volver a campañas</Link></div>;
  return <div className="min-h-screen flex flex-col">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast min-h-16 flex items-center justify-between px-4 py-2 gap-2"><div className="flex items-center gap-2"><Link to="/campaigns" aria-label="Volver" className="p-2"><span className="material-symbols-outlined">arrow_back</span></Link><h1 className="font-headline-md font-bold">{campaign.data.name}</h1></div><div className="flex gap-2 items-center"><Link to={`/campaign/${campaignId}/reference`} className="text-primary font-label-bold px-2">Biblioteca 5e</Link>{isGM && <Link to={`/campaign/${campaignId}/gm`} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold">Consola GM</Link>}<span className={`w-2 h-2 rounded-full ${connection === 'connected' ? 'bg-success-active' : 'bg-gm-amber'}`} title={`Conexión: ${connection}`} /></div></header>
    <main className="flex-1 p-4 md:p-10"><div className="max-w-5xl mx-auto space-y-6">
      {campaign.data.description && <p className="p-4 border border-border-low-contrast rounded-lg text-on-surface-variant">{campaign.data.description}</p>}
      {isGM && <div className="p-4 bg-surface-container-lowest border border-border-low-contrast rounded-lg"><span className="font-label-bold">Código de invitación</span><button type="button" onClick={() => void navigator.clipboard?.writeText(campaign.data.join_code)} className="ml-3 font-mono text-primary" title="Copiar código">{campaign.data.join_code}</button><p className="text-sm text-secondary mt-1">Comparte este código solo con las personas que participarán en esta campaña.</p></div>}
      <section><div className="flex items-center justify-between mb-3"><h2 className="font-headline-md">Personajes</h2><Link to={`/campaign/${campaignId}/character/new`} className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-bold">Crear personaje</Link></div>
      {characters.isLoading ? <LoadingState /> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{characters.data?.map((character) => <Link key={character.id} to={`/campaign/${campaignId}/character/${character.id}`} className="border border-border-low-contrast bg-surface-container-lowest rounded-lg p-4 hover:border-primary"><div className="flex items-center gap-3"><div className="avatar-stage h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border-low-contrast"><PixelAvatar appearance={character.appearance} race={character.race} klass={character.class} crop="bust" scale={2.34} /></div><div className="min-w-0"><h3 className="font-label-bold text-lg truncate">{character.name}</h3><p className="text-sm text-secondary truncate">{splitSource(character.race).base} · {splitSource(character.class).base} · Nivel {character.level}</p></div></div><div className="flex gap-2 items-center mt-3"><div className="flex-1 bg-surface-container h-2 rounded-full"><div className="h-full bg-success-active rounded-full" style={{ width: `${Math.max(0, Math.min(100, character.current_hp / character.max_hp * 100))}%` }} /></div><span className="text-sm">{character.current_hp}/{character.max_hp}</span></div></Link>)}</div>}
      {characters.data?.length === 0 && <p className="text-secondary text-center py-10">Todavía no hay personajes. Crea el tuyo con cualquier raza o clase importada.</p>}</section>
      <nav className="grid grid-cols-2 md:grid-cols-4 gap-3"><Link className="p-4 border border-border-low-contrast rounded-lg font-label-bold" to={`/campaign/${campaignId}/lore`}>Trama y lore</Link><Link className="p-4 border border-border-low-contrast rounded-lg font-label-bold" to={`/campaign/${campaignId}/chat`}>Mensajes</Link><Link className="p-4 border border-border-low-contrast rounded-lg font-label-bold" to={`/campaign/${campaignId}/market`}>Mercado</Link><Link className="p-4 border border-border-low-contrast rounded-lg font-label-bold" to={`/campaign/${campaignId}/trade`}>Intercambios</Link><Link className="p-4 border border-border-low-contrast rounded-lg font-label-bold" to={`/campaign/${campaignId}/encounter`}>Encuentro</Link></nav>
    </div></main>
  </div>;
}
