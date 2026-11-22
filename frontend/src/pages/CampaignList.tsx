import { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignApi } from '../services/api';
import { getApiError } from '../services/errors';
import { useAuth } from '../lib/hooks';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import type { Campaign, CampaignMember } from '../types';

export function CampaignListPage() {
  const { isDM } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: () => campaignApi.list().then((response) => (response.data ?? []) as Campaign[]) });
  const memberQueries = useQueries({
    queries: (campaigns.data ?? []).map((campaign) => ({
      queryKey: ['campaign-members', String(campaign.id)],
      queryFn: () => campaignApi.members(campaign.id).then((response) => response.data as CampaignMember[]),
    })),
  });
  const join = useMutation({
    // El backend resuelve la campaña por el código; el id de la ruta se ignora.
    mutationFn: (joinCode: string) => campaignApi.join(0, joinCode).then((response) => response.data as Campaign),
    onSuccess: (campaign) => { setCode(''); void client.invalidateQueries({ queryKey: ['campaigns'] }); navigate(`/campaign/${campaign.id}`); },
  });

  const list = campaigns.data ?? [];
  const term = search.trim().toLowerCase();
  const visible = list
    .map((campaign, index) => ({ campaign, members: memberQueries[index]?.data }))
    .filter(({ campaign }) => !term || campaign.name.toLowerCase().includes(term) || campaign.description.toLowerCase().includes(term));

  return (
    <div className="p-4 md:p-10">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background mb-2">Mis Campañas</h1>
          <p className="font-body-lg text-secondary hidden md:block">Elige una campaña para gestionar sesiones, combate y lore.</p>
        </div>
        {isDM && (
          <Link to="/campaigns/new" className="bg-primary-container text-on-primary-container px-6 py-3 rounded-lg font-label-bold flex items-center gap-2 hover:bg-surface-tint transition-colors shadow-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            Crear Campaña
          </Link>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-8">
        <label className="flex items-center gap-2 bg-surface-subtle border border-border-low-contrast rounded-lg px-3">
          <span className="material-symbols-outlined text-outline">search</span>
          <input type="search" aria-label="Buscar campañas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar campañas…" className="flex-1 bg-transparent border-none outline-none py-3" />
        </label>
        <form onSubmit={(event) => { event.preventDefault(); if (code.trim()) join.mutate(code.trim().toUpperCase()); }} className="flex gap-2">
          <input aria-label="Código de invitación" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código de invitación" maxLength={16} className="flex-1 bg-surface-subtle border border-border-low-contrast rounded-lg px-3 py-3 font-mono uppercase" />
          <button type="submit" disabled={!code.trim() || join.isPending} className="px-4 rounded-lg bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">{join.isPending ? 'Uniéndose…' : 'Unirse'}</button>
        </form>
      </div>
      {join.error && <div className="mb-6"><ErrorState message={axios.isAxiosError(join.error) && join.error.response?.status === 404 ? 'No existe ninguna campaña con ese código.' : getApiError(join.error)} /></div>}

      {campaigns.isLoading ? (
        <LoadingState />
      ) : campaigns.error ? (
        <ErrorState message={getApiError(campaigns.error, 'No se pudieron cargar las campañas')} onRetry={() => void campaigns.refetch()} />
      ) : list.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-6xl text-outline mb-4 block">map</span>
          <p className="font-body-lg text-secondary">No tienes campañas aún.</p>
          {isDM ? <Link to="/campaigns/new" className="text-primary font-label-bold">Crea tu primera</Link> : <p className="text-secondary mt-1">Pide un código de invitación a tu DM y úsalo arriba.</p>}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center py-20 text-secondary">Ninguna campaña coincide con «{search}».</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map(({ campaign, members }) => {
            const gm = members?.find((member) => member.role === 'gm');
            return (
              <Link key={campaign.id} to={`/campaign/${campaign.id}`} className="bg-surface rounded-xl border border-border-low-contrast overflow-hidden flex flex-col group cursor-pointer hover:border-primary transition-colors hover:shadow-md">
                <div className="h-32 bg-surface-container relative overflow-hidden">
                  {campaign.status === 'active' && (
                    <div className="absolute top-3 left-3 bg-success-active text-on-primary px-3 py-1 rounded-full font-label-bold text-label-bold flex items-center gap-1 shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-on-primary animate-pulse" />
                      Activa
                    </div>
                  )}
                  {campaign.status === 'paused' && (
                    <div className="absolute top-3 left-3 bg-surface-variant text-on-surface px-3 py-1 rounded-full font-label-bold border border-border-low-contrast">En Pausa</div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h2 className="font-headline-md text-on-background group-hover:text-primary transition-colors mb-2">{campaign.name}</h2>
                  <p className="font-body-md text-secondary mb-4 line-clamp-2 flex-1">{campaign.description}</p>
                  <div className="flex justify-between items-center pt-4 border-t border-surface-container">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline text-sm">person</span>
                      <span className="font-label-sm text-on-surface-variant">{gm?.username ?? (members ? 'Sin DM' : '…')}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded" title="Miembros">
                      <span className="material-symbols-outlined text-outline text-sm">groups</span>
                      <span className="font-label-bold text-on-background">{members ? members.length : '…'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {isDM && (
        <Link to="/campaigns/new" aria-label="Crear campaña" className="md:hidden fixed bottom-24 right-4 w-14 h-14 bg-primary-container text-on-primary-container rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.15)] flex items-center justify-center z-50 hover:bg-surface-tint">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
        </Link>
      )}
    </div>
  );
}
