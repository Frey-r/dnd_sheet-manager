import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { eventApi, mapApi, noteApi, npcApi } from '../../services/api';
import { vttApi } from '../../services/vttApi';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState, EmptyState } from '../ui/Feedback';
import { Markdown } from '../ui/Markdown';

export type Resource = { id: number; [key: string]: unknown };
export type FieldOption = { value: string; label: string };
type Field = { name: string; label: string; type?: 'text' | 'textarea' | 'date' | 'time' | 'url' | 'number' | 'select' | 'image'; options?: FieldOption[] };
type Props = { kind: 'npcs' | 'maps' | 'events' | 'notes'; title: string; fields: Field[]; linkBase?: string; addLabel?: string };

const NPC_STATUS: Record<string, { label: string; className: string }> = {
  ally: { label: 'Aliado', className: 'bg-ok-soft text-ok' },
  enemy: { label: 'Enemigo', className: 'bg-bad-soft text-bad' },
  neutral: { label: 'Neutral', className: 'bg-card-3 text-muted' },
};
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DEFAULT_ADD_LABEL: Record<Props['kind'], string> = { npcs: 'Añadir NPC', maps: 'Nuevo mapa', events: 'Añadir Evento', notes: 'Nueva nota' };

function valueAt(resource: Resource | null, path: string) {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, resource);
}
const text = (value: unknown) => typeof value === 'string' ? value : value == null ? '' : String(value);

function dayKey(value: unknown) {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es', { dateStyle: 'long' });
}

export function CampaignResourcePanel({ kind, title, fields, linkBase, addLabel }: Props) {
  const { campaignId = '' } = useParams();
  const [editing, setEditing] = useState<Resource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const api = { npcs: npcApi, maps: mapApi, events: eventApi, notes: noteApi }[kind];
  const titleField = kind === 'npcs' || kind === 'maps' ? 'name' : 'title';
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
  const uploadImage = async (fieldName: string, file: File) => {
    if (!IMAGE_TYPES.includes(file.type)) { setError('Formato no admitido: sube una imagen PNG, JPG o WebP.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError('La imagen supera los 15 MB.'); return; }
    setUploading(fieldName);
    setError('');
    try {
      const url = await vttApi.upload(campaignId, file);
      setForm((current) => ({ ...current, [fieldName]: url }));
    } catch (reason) {
      setError(getApiError(reason, 'No se pudo subir la imagen'));
    } finally {
      setUploading(null);
    }
  };
  const imageInput = (field: Field) => <div className="mt-1 space-y-2">
    <div className="flex gap-2">
      <input type="text" inputMode="url" aria-label={`URL de ${field.label.toLowerCase()}`} placeholder="https://… o sube un archivo" value={form[field.name] || ''} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="min-w-0 flex-1 rounded bg-surface-subtle border-border-low-contrast" />
      <label className={`mc-btn shrink-0 cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>{uploading === field.name ? 'Subiendo…' : 'Subir'}
        <input type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" disabled={uploading !== null} aria-label={`Subir archivo para ${field.label}`}
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadImage(field.name, file); }} />
      </label>
    </div>
    {form[field.name] && <img src={form[field.name]} alt="Vista previa" className="h-24 w-24 rounded-lg object-cover bg-card-3 border border-line" />}
  </div>;
  const remove = useMutation({ mutationFn: (id: number) => api.delete(campaignId, id), onSuccess: () => void list.refetch(), onError: (reason) => setError(getApiError(reason)) });

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (list.data ?? []).filter((resource) => (!query || text(resource[titleField]).toLowerCase().includes(query)) && (kind !== 'npcs' || statusFilter === 'all' || text(resource.status || 'neutral') === statusFilter));
  }, [list.data, search, statusFilter, kind, titleField]);

  const card = (resource: Resource) => {
    const image = text(resource.image_url || resource.avatar_url);
    const status = kind === 'npcs' ? NPC_STATUS[text(resource.status || 'neutral')] : undefined;
    const body = text(resource.description || resource.content);
    return <article key={resource.id} className="border border-border-low-contrast rounded-lg bg-surface-container-lowest p-4">
      <div className="flex gap-3">
        {image && <img src={image} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover bg-card-3" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {linkBase ? <Link to={`/campaign/${campaignId}/gm/${linkBase}/${resource.id}`} className="font-label-bold text-lg text-primary truncate">{text(resource[titleField])}</Link> : <h2 className="font-label-bold text-lg truncate">{text(resource[titleField])}</h2>}
            {status && <span className={`mc-badge shrink-0 ${status.className}`}>{status.label}</span>}
          </div>
          <p className="text-sm text-secondary mt-1">{text(resource.role || resource.location || resource.event_date)}{resource.event_time ? ` ${text(resource.event_time)}` : ''}</p>
        </div>
      </div>
      {kind === 'notes' ? <Markdown source={body} className="mt-2 text-sm" /> : <p className="text-sm text-on-surface-variant mt-2 line-clamp-4 whitespace-pre-wrap">{body}</p>}
      <div className="flex gap-2 mt-3"><button type="button" onClick={() => open(resource)} className="text-sm text-primary">Editar</button><button type="button" disabled={remove.isPending} onClick={() => remove.mutate(resource.id)} className="text-sm text-hp-danger">Eliminar</button></div>
    </article>;
  };

  const grouped = useMemo(() => {
    if (kind !== 'notes') return [];
    const sorted = [...shown].sort((a, b) => new Date(text(b.created_at)).getTime() - new Date(text(a.created_at)).getTime());
    const groups = new Map<string, Resource[]>();
    sorted.forEach((note) => { const key = dayKey(note.created_at); groups.set(key, [...(groups.get(key) ?? []), note]); });
    return [...groups.entries()];
  }, [shown, kind]);

  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast min-h-16 flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2"><Link to={`/campaign/${campaignId}/gm`} aria-label="Volver"><span className="material-symbols-outlined text-primary">arrow_back</span></Link><h1 className="font-headline-md font-bold">{title}</h1></div>
      <button type="button" onClick={() => open()} className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-bold">{addLabel ?? DEFAULT_ADD_LABEL[kind]}</button>
    </header>
    <main className="p-4 md:p-10 max-w-6xl mx-auto space-y-4">
      {error && !formOpen && <ErrorState message={error} />}
      <div className="flex flex-wrap gap-2">
        <input aria-label="Buscar por nombre" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre…" className="flex-1 min-w-[180px] rounded bg-surface-subtle border-border-low-contrast" />
        {kind === 'npcs' && <div className="mc-seg" role="group" aria-label="Filtrar por relación">
          {[['all', 'Todos'], ...Object.entries(NPC_STATUS).map(([value, info]) => [value, info.label])].map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</button>)}
        </div>}
      </div>
      {list.isLoading ? <LoadingState /> : list.error ? <ErrorState message="No se pudo cargar el contenido" onRetry={() => void list.refetch()} /> : list.data?.length === 0 ? <EmptyState title="Todavía no hay contenido en esta sección" action={<button type="button" className="text-primary" onClick={() => open()}>Crear el primero</button>} /> : shown.length === 0 ? <EmptyState title="Ningún resultado coincide con la búsqueda" /> : kind === 'notes' ? <div className="space-y-6">
        {grouped.map(([day, notes]) => <section key={day}><h2 className="mc-eyebrow mb-2">{day}</h2><div className="grid md:grid-cols-2 gap-4">{notes.map(card)}</div></section>)}
      </div> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{shown.map(card)}</div>}
    </main>
    {formOpen && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="bg-surface w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-5 space-y-4">
        <h2 className="font-headline-md">{editing ? 'Editar' : 'Crear'} · {title}</h2>
        {error && <ErrorState message={error} />}
        {fields.map((field) => field.type === 'image' ? <div key={field.name} role="group" aria-label={field.label} className="block font-label-bold text-sm">{field.label}{imageInput(field)}</div> : <label key={field.name} className="block font-label-bold text-sm">{field.label}
          {field.type === 'textarea' ? <textarea value={form[field.name] || ''} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} rows={5} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /> : field.type === 'select' ? <select value={form[field.name]} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast">{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input required={field.name === titleField || field.name === 'event_date'} min={field.type === 'number' ? 0 : undefined} type={field.type || 'text'} value={form[field.name] || ''} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" />}
        </label>)}
        {kind === 'notes' && <p className="text-xs text-secondary">Admite Markdown básico: # títulos, **negrita**, *cursiva*, - listas y [enlaces](https://…).</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={mutation.isPending || uploading !== null} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold">Guardar</button></div>
      </form>
    </div>}
  </div>;
}
