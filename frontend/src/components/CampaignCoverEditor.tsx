import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignApi } from '../services/api';
import { vttApi } from '../services/vttApi';
import { getApiError } from '../services/errors';
import { ErrorState } from './ui/Feedback';

/** GM editor for the campaign cover: upload an image, paste a URL or remove it. */
export function CampaignCoverEditor({ campaignId, coverUrl }: { campaignId: string; coverUrl: string }) {
  const client = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: string) => campaignApi.update(campaignId, { cover_url: value }),
    onSuccess: () => { setUrl(null); void client.invalidateQueries({ queryKey: ['campaign', campaignId] }); void client.invalidateQueries({ queryKey: ['campaigns'] }); },
  });
  const upload = useMutation({ mutationFn: (file: File) => vttApi.upload(campaignId, file), onSuccess: (uploaded) => save.mutate(uploaded) });
  const value = url ?? coverUrl;
  const busy = save.isPending || upload.isPending;

  return <section aria-labelledby="cover-title" className="p-4 bg-surface-container-lowest border border-border-low-contrast rounded-lg space-y-3">
    <h2 id="cover-title" className="font-label-bold">Portada de la campaña</h2>
    {coverUrl ? <img src={coverUrl} alt="Portada actual" className="h-28 w-full max-w-md rounded-lg object-cover border border-border-low-contrast" /> : <p className="text-sm text-secondary">Sin portada: la lista de campañas muestra un fondo liso.</p>}
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-label-bold">Subir imagen<input type="file" accept="image/*" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} className="block mt-1 text-sm" /></label>
      <label className="text-sm font-label-bold grow min-w-48">o pegar una URL<input value={value} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className="block mt-1 w-full h-10 rounded bg-surface-subtle border border-border-low-contrast px-3" /></label>
      <button type="button" disabled={busy || url === null || url === coverUrl} onClick={() => save.mutate(value.trim())} className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">Guardar</button>
      {coverUrl && <button type="button" disabled={busy} onClick={() => save.mutate('')} className="h-10 px-4 rounded-lg border font-label-bold">Quitar</button>}
    </div>
    {(save.error || upload.error) && <ErrorState message={getApiError(save.error ?? upload.error, 'No se pudo guardar la portada')} />}
  </section>;
}
