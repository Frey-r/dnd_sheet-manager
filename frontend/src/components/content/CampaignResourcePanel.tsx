import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { eventApi, mapApi, noteApi, npcApi } from '../../services/api';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState, EmptyState } from '../ui/Feedback';

export type Resource = { id: number; [key: string]: unknown };
type Field = { name: string; label: string; type?: 'text' | 'textarea' | 'date' | 'time' | 'url' | 'number' | 'select'; options?: string[] };
type Props = { kind: 'npcs' | 'maps' | 'events' | 'notes'; title: string; fields: Field[]; linkBase?: string };

function valueAt(resource: Resource | null, path: string) {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, resource);
}

export function CampaignResourcePanel({ kind, title, fields, linkBase }: Props) {
  const { campaignId = '' } = useParams();
  const [editing, setEditing] = useState<Resource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const api = { npcs: npcApi, maps: mapApi, events: eventApi, notes: noteApi }[kind];
  const list = useQuery({ queryKey: [kind, campaignId], queryFn: () => api.list(campaignId).then((response) => response.data as Resource[]) });
  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      fields.forEach((field) => {
        const value: unknown = field.type === 'number' && form[field.name] !== '' ? Number(form[field.name]) : form[field.name];
        if (field.name.startsWith('stats.')) {
          const stats = (payload.stats || {}) as Record<string, unknown>;
          stats[field.name.slice(6)] = value;
          payload.stats = stats;
        } else {
          payload[field.name] = value;
        }
      });
      return editing ? api.update(campaignId, editing.id, payload) : api.create(campaignId, payload);
    },
    onSuccess: () => { setFormOpen(false); setEditing(null); setError(''); void list.refetch(); },
    onError: (reason) => setError(getApiError(reason)),
  });
  const open = (resource?: Resource) => {
    setEditing(resource || null);
    const next: Record<string, string> = {};
    fields.forEach((field) => { next[field.name] = String(valueAt(resource || null, field.name) ?? (field.name === 'status' ? 'neutral' : '')); });
    setForm(next);
    setFormOpen(true);
    setError('');
  };
  const remove = useMutation({ mutationFn: (id: number) => api.delete(campaignId, id), onSuccess: () => void list.refetch(), onError: (reason) => setError(getApiError(reason)) });
  const titleField = kind === 'npcs' || kind === 'maps' ? 'name' : 'title';

  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast min-h-16 flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2"><Link to={`/campaign/${campaignId}/gm`} aria-label="Volver"><span className="material-symbols-outlined text-primary">arrow_back</span></Link><h1 className="font-headline-md font-bold">{title}</h1></div>
      <button type="button" onClick={() => open()} className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-bold">Añadir</button>
    </header>
    <main className="p-4 md:p-10 max-w-6xl mx-auto space-y-4">
      {error && <ErrorState message={error} />}
      {list.isLoading ? <LoadingState /> : list.error ? <ErrorState message="No se pudo cargar el contenido" onRetry={() => void list.refetch()} /> : list.data?.length === 0 ? <EmptyState title="Todavía no hay contenido en esta sección" action={<button type="button" className="text-primary" onClick={() => open()}>Crear el primero</button>} /> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.data?.map((resource) => <article key={resource.id} className="border border-border-low-contrast rounded-lg bg-surface-container-lowest p-4">
          {linkBase ? <Link to={`/campaign/${campaignId}/gm/${linkBase}/${resource.id}`} className="font-label-bold text-lg text-primary">{String(resource[titleField])}</Link> : <h2 className="font-label-bold text-lg">{String(resource[titleField])}</h2>}
          <p className="text-sm text-secondary mt-1">{String(resource.role || resource.location || resource.event_date || '')}{resource.event_time ? ` ${String(resource.event_time)}` : ''}</p>
          <p className="text-sm text-on-surface-variant mt-2 line-clamp-4 whitespace-pre-wrap">{String(resource.description || resource.content || '')}</p>
          <div className="flex gap-2 mt-3"><button type="button" onClick={() => open(resource)} className="text-sm text-primary">Editar</button><button type="button" disabled={remove.isPending} onClick={() => remove.mutate(resource.id)} className="text-sm text-hp-danger">Eliminar</button></div>
        </article>)}
      </div>}
    </main>
    {formOpen && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="bg-surface w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-5 space-y-4">
        <h2 className="font-headline-md">{editing ? 'Editar' : 'Crear'} · {title}</h2>
        {fields.map((field) => <label key={field.name} className="block font-label-bold text-sm">{field.label}
          {field.type === 'textarea' ? <textarea value={form[field.name] || ''} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} rows={5} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /> : field.type === 'select' ? <select value={form[field.name]} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast">{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input required={field.name === titleField || field.name === 'event_date'} min={field.type === 'number' ? 0 : undefined} type={field.type || 'text'} value={form[field.name] || ''} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" />}
        </label>)}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold">Guardar</button></div>
      </form>
    </div>}
  </div>;
}
