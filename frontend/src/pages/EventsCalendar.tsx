import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { eventApi, mapApi, npcApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';

type CampaignEvent = { id: number; title: string; description: string; event_date: string; event_time: string; related_npcs?: string[]; related_locations?: string[] };
type Named = { id: number; name: string };
type Draft = { id?: number; title: string; event_date: string; event_time: string; description: string; npcs: string[]; locations: string };

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const pad = (value: number) => String(value).padStart(2, '0');
const toKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
const dateOnly = (value: string) => value.slice(0, 10);
const emptyDraft = (date: string): Draft => ({ title: '', event_date: date, event_time: '', description: '', npcs: [], locations: '' });

export function EventsCalendar() {
  const { campaignId = '' } = useParams();
  const today = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(todayKey);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const events = useQuery({ queryKey: ['events', campaignId], queryFn: () => eventApi.list(campaignId).then((response) => response.data as CampaignEvent[]) });
  const npcs = useQuery({ queryKey: ['npcs', campaignId], queryFn: () => npcApi.list(campaignId).then((response) => response.data as Named[]) });
  const maps = useQuery({ queryKey: ['maps', campaignId], queryFn: () => mapApi.list(campaignId).then((response) => response.data as Named[]) });

  const sorted = useMemo(() => [...(events.data ?? [])].sort((a, b) => dateOnly(a.event_date).localeCompare(dateOnly(b.event_date)) || a.event_time.localeCompare(b.event_time)), [events.data]);
  const byDay = useMemo(() => {
    const map = new Map<string, CampaignEvent[]>();
    sorted.forEach((event) => { const key = dateOnly(event.event_date); map.set(key, [...(map.get(key) ?? []), event]); });
    return map;
  }, [sorted]);

  const save = useMutation({
    mutationFn: (value: Draft) => {
      const payload = { title: value.title.trim(), event_date: value.event_date, event_time: value.event_time, description: value.description, related_npcs: value.npcs, related_locations: value.locations.split(',').map((item) => item.trim()).filter(Boolean) };
      return value.id ? eventApi.update(campaignId, value.id, payload) : eventApi.create(campaignId, payload);
    },
    onSuccess: (_, value) => { setDraft(null); setError(''); setSelected(value.event_date); void events.refetch(); },
    onError: (reason) => setError(getApiError(reason)),
  });
  const remove = useMutation({ mutationFn: (id: number) => eventApi.delete(campaignId, id), onSuccess: () => { setError(''); void events.refetch(); }, onError: (reason) => setError(getApiError(reason)) });

  const firstWeekday = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const rawMonthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const shift = (delta: number) => { const next = new Date(cursor.year, cursor.month + delta, 1); setCursor({ year: next.getFullYear(), month: next.getMonth() }); };
  const dayEvents = byDay.get(selected) ?? [];
  const edit = (event: CampaignEvent) => {
    setError('');
    setDraft({ id: event.id, title: event.title, event_date: dateOnly(event.event_date), event_time: event.event_time, description: event.description, npcs: event.related_npcs ?? [], locations: (event.related_locations ?? []).join(', ') });
  };
  const toggleNpc = (name: string) => draft && setDraft({ ...draft, npcs: draft.npcs.includes(name) ? draft.npcs.filter((item) => item !== name) : [...draft.npcs, name] });

  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast min-h-16 flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2"><Link to={`/campaign/${campaignId}/gm`} aria-label="Volver"><span className="material-symbols-outlined text-primary">arrow_back</span></Link><h1 className="font-headline-md font-bold">Eventos de campaña</h1></div>
      <button type="button" onClick={() => { setError(''); setDraft(emptyDraft(selected)); }} className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-bold">Añadir Evento</button>
    </header>
    <main className="p-4 md:p-8 max-w-6xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {error && !draft && <div className="lg:col-span-2"><ErrorState message={error} /></div>}
      {events.isLoading ? <div className="lg:col-span-2"><LoadingState /></div> : events.error ? <div className="lg:col-span-2"><ErrorState message="No se pudieron cargar los eventos" onRetry={() => void events.refetch()} /></div> : <>
        <section className="mc-card p-4" aria-label="Calendario">
          <div className="flex items-center justify-between mb-3">
            <button type="button" aria-label="Mes anterior" onClick={() => shift(-1)} className="mc-btn mc-btn-icon"><span className="material-symbols-outlined">chevron_left</span></button>
            <h2 className="font-headline-md">{monthLabel}</h2>
            <button type="button" aria-label="Mes siguiente" onClick={() => shift(1)} className="mc-btn mc-btn-icon"><span className="material-symbols-outlined">chevron_right</span></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-1">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />;
              const key = toKey(cursor.year, cursor.month, day);
              const count = byDay.get(key)?.length ?? 0;
              return <button key={key} type="button" aria-pressed={selected === key} aria-label={`${day}${count ? `, ${count} evento${count > 1 ? 's' : ''}` : ''}`} onClick={() => setSelected(key)}
                className={`aspect-square rounded-lg border text-sm flex flex-col items-center justify-center gap-1 transition-colors ${selected === key ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'} ${key === todayKey ? 'font-bold text-accent' : ''}`}>
                {day}
                {count > 0 && <span className="flex gap-0.5">{Array.from({ length: Math.min(count, 3) }, (_, dot) => <span key={dot} className="h-1.5 w-1.5 rounded-full bg-gold" />)}</span>}
              </button>;
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="mc-card p-4 space-y-3">
            <h2 className="font-headline-md">{new Date(`${selected}T12:00:00`).toLocaleDateString('es', { dateStyle: 'full' })}</h2>
            {dayEvents.length === 0 ? <p className="text-sm text-muted">No hay eventos este día.</p> : dayEvents.map((event) => {
              const npcNames = event.related_npcs ?? [];
              const places = event.related_locations ?? [];
              return <article key={event.id} className="rounded-lg border border-line p-3 space-y-1">
                <h3 className="font-label-bold">{event.event_time && <span className="text-gold mr-2">{event.event_time}</span>}{event.title}</h3>
                {event.description && <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{event.description}</p>}
                {npcNames.length > 0 && <p className="text-xs text-muted">NPCs: {npcNames.join(', ')}</p>}
                {places.length > 0 && <p className="text-xs text-muted">Lugares: {places.join(', ')}</p>}
                <div className="flex gap-3 pt-1"><button type="button" onClick={() => edit(event)} className="text-sm text-primary">Editar</button><button type="button" disabled={remove.isPending} onClick={() => remove.mutate(event.id)} className="text-sm text-hp-danger">Eliminar</button></div>
              </article>;
            })}
          </div>
          <div className="mc-card p-4">
            <h2 className="mc-eyebrow mb-2">Próximos eventos</h2>
            {sorted.filter((event) => dateOnly(event.event_date) >= todayKey).slice(0, 6).map((event) => <button type="button" key={event.id} onClick={() => { const [year, month] = dateOnly(event.event_date).split('-').map(Number); setCursor({ year, month: month - 1 }); setSelected(dateOnly(event.event_date)); }} className="w-full text-left py-2 border-b border-line last:border-b-0 text-sm"><span className="font-mono text-muted mr-2">{dateOnly(event.event_date)}</span>{event.title}</button>)}
            {!sorted.some((event) => dateOnly(event.event_date) >= todayKey) && <p className="text-sm text-muted">Nada programado.</p>}
          </div>
        </section>
      </>}
    </main>
    {draft && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <form onSubmit={(event) => { event.preventDefault(); save.mutate(draft); }} className="bg-surface w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-5 space-y-4">
        <h2 className="font-headline-md">{draft.id ? 'Editar evento' : 'Añadir Evento'}</h2>
        {error && <ErrorState message={error} />}
        <label className="block font-label-bold text-sm">Título<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-label-bold text-sm">Fecha<input required type="date" value={draft.event_date} onChange={(event) => setDraft({ ...draft, event_date: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
          <label className="block font-label-bold text-sm">Hora<input type="time" value={draft.event_time} onChange={(event) => setDraft({ ...draft, event_time: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
        </div>
        <label className="block font-label-bold text-sm">Descripción<textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
        <fieldset className="text-sm"><legend className="font-label-bold mb-1">NPCs relacionados</legend>
          {npcs.isLoading ? <p className="text-muted">Cargando NPCs…</p> : npcs.error ? <p className="text-bad">No se pudieron cargar los NPCs.</p> : (npcs.data ?? []).length === 0 ? <p className="text-muted">Aún no hay NPCs en la campaña.</p> : <div className="flex flex-wrap gap-2">{npcs.data?.map((npc) => <label key={npc.id} className="flex items-center gap-1.5"><input type="checkbox" checked={draft.npcs.includes(npc.name)} onChange={() => toggleNpc(npc.name)} />{npc.name}</label>)}</div>}
        </fieldset>
        <label className="block font-label-bold text-sm">Lugares relacionados (separados por comas)<input list="event-locations" value={draft.locations} onChange={(event) => setDraft({ ...draft, locations: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" />
          <datalist id="event-locations">{maps.data?.map((map) => <option key={map.id} value={map.name} />)}</datalist></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={save.isPending} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold">Guardar</button></div>
      </form>
    </div>}
  </div>;
}
