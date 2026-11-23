import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { mapApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';

type Pin = { id: number; name: string; description: string; x: number; y: number };
type MapEntry = { id: number; name: string; location: string; image_url: string; description: string; pins: Pin[] | null };
type View = { x: number; y: number; zoom: number };

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export function MapDetail() {
  const { campaignId = '', mapId = '' } = useParams();
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [layers, setLayers] = useState({ grid: false, fog: false, pins: true });
  const [layersOpen, setLayersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pinName, setPinName] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheet, setSheet] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [details, setDetails] = useState<{ name: string; location: string; image_url: string; description: string } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  const map = useQuery({ queryKey: ['maps', campaignId, mapId], queryFn: () => mapApi.get(campaignId, mapId).then((response) => response.data as MapEntry) });
  const mutation = useMutation({
    mutationFn: (pins: Pin[]) => mapApi.update(campaignId, mapId, { pins }),
    onSuccess: () => { void map.refetch(); setError(''); },
    onError: (reason) => setError(getApiError(reason)),
  });
  // Map details (name, location, image, description) are edited in place from this page.
  const saveDetails = useMutation({
    mutationFn: (value: NonNullable<typeof details>) => mapApi.update(campaignId, mapId, { name: value.name.trim(), location: value.location.trim(), image_url: value.image_url.trim(), description: value.description }),
    onSuccess: () => { setDetails(null); void map.refetch(); setError(''); },
    onError: (reason) => setError(getApiError(reason)),
  });
  const pins = map.data?.pins ?? [];
  const selected = pins.find((pin) => pin.id === selectedId) ?? null;

  // La rueda del ratón hace zoom; debe registrarse como no pasiva para poder frenar el scroll de la página.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((current) => ({ ...current, zoom: clampZoom(current.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)) }));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [map.data]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) current.moved = true;
    if (current.moved) setView((value) => ({ ...value, x: current.originX + dx, y: current.originY + dy }));
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current || current.moved || !adding || !pinName.trim() || !map.data || !stage.current) return;
    const rect = stage.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 100;
    const y = (event.clientY - rect.top) / rect.height * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const pin: Pin = { id: Date.now(), name: pinName.trim(), description: '', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    mutation.mutate([...pins, pin]);
    setPinName('');
  };

  const select = (pin: Pin) => { setSelectedId(pin.id); setSheet({ name: pin.name, description: pin.description || '' }); };
  const removePin = (id: number) => {
    mutation.mutate(pins.filter((pin) => pin.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const saveSheet = () => {
    if (!selected || !sheet.name.trim()) return;
    mutation.mutate(pins.map((pin) => pin.id === selected.id ? { ...pin, name: sheet.name.trim(), description: sheet.description } : pin));
  };
  const zoomBy = (factor: number) => setView((current) => ({ ...current, zoom: clampZoom(current.zoom * factor) }));

  if (map.isLoading) return <LoadingState />;
  if (map.error || !map.data) return <ErrorState message="Mapa no encontrado" />;
  const data = map.data;
  const layerRows: [keyof typeof layers, string][] = [['grid', 'Cuadrícula'], ['fog', 'Niebla'], ['pins', 'Marcadores']];

  return <div className="min-h-screen flex flex-col">
    <header className="h-16 border-b border-border-low-contrast px-4 flex items-center justify-between gap-3 relative">
      <Link to={`/campaign/${campaignId}/gm/maps`} aria-label="Volver"><span className="material-symbols-outlined">arrow_back</span></Link>
      <h1 className="font-headline-md font-bold flex-1 truncate">{data.name}</h1>
      {!details && <button type="button" onClick={() => setDetails({ name: data.name, location: data.location ?? '', image_url: data.image_url ?? '', description: data.description ?? '' })} className="mc-btn"><span className="material-symbols-outlined text-[18px]">edit</span>Editar</button>}
      <button type="button" aria-expanded={layersOpen} onClick={() => setLayersOpen(!layersOpen)} className="mc-btn"><span className="material-symbols-outlined text-[18px]">layers</span>Capas</button>
      {layersOpen && <div role="menu" className="absolute right-4 top-14 z-30 w-48 rounded-lg border border-line bg-card p-2 shadow-lg">
        {layerRows.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-card-2"><input type="checkbox" checked={layers[key]} onChange={() => setLayers({ ...layers, [key]: !layers[key] })} />{label}</label>)}
      </div>}
    </header>
    <main className="relative min-h-[70vh] flex-1 overflow-hidden bg-surface-subtle">
      <div ref={viewport} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className={`absolute inset-0 touch-none select-none ${adding ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}>
        {data.image_url ? <div ref={stage} className="absolute left-0 top-0 w-full origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          <img src={data.image_url} alt={data.name} draggable={false} className="block w-full h-auto" />
          {layers.fog && <div className="absolute inset-0 pointer-events-none bg-black/50" />}
          {layers.grid && <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }} />}
          {layers.pins && pins.map((pin) => <button type="button" key={pin.id} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); select(pin); }} title={pin.name} aria-label={`Marcador ${pin.name}`} className={`absolute -translate-x-1/2 -translate-y-full rounded-full px-2 py-1 text-xs shadow-md ${pin.id === selectedId ? 'bg-gold text-gold-ink' : 'bg-primary text-on-primary'}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>◆ {pin.name}</button>)}
        </div> : <div className="h-full flex items-center justify-center text-secondary">Este mapa no tiene imagen.</div>}
      </div>
      <div className="absolute top-4 right-4 flex flex-col bg-surface border rounded-lg">
        <button type="button" aria-label="Acercar" onClick={() => zoomBy(1.2)} className="px-3 py-2 text-xl">+</button>
        <button type="button" aria-label="Alejar" onClick={() => zoomBy(1 / 1.2)} className="px-3 py-2 text-xl">−</button>
        <button type="button" aria-label="Restablecer vista" onClick={() => setView({ x: 0, y: 0, zoom: 1 })} className="px-3 py-2 text-sm border-t">{Math.round(view.zoom * 100)}%</button>
      </div>
      {error && <div className="absolute top-4 left-4 z-20"><ErrorState message={error} /></div>}
      {selected && <section aria-label="Editar marcador" className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-line bg-card p-4 shadow-2xl md:left-auto md:right-4 md:bottom-4 md:w-96 md:rounded-2xl md:border">
        <div className="flex items-center justify-between mb-3"><h2 className="font-label-bold">Editar marcador</h2><button type="button" aria-label="Cerrar" onClick={() => setSelectedId(null)}>×</button></div>
        <label className="block text-sm font-label-bold">Nombre<input value={sheet.name} onChange={(event) => setSheet({ ...sheet, name: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
        <label className="block text-sm font-label-bold mt-3">Descripción<textarea rows={3} value={sheet.description} onChange={(event) => setSheet({ ...sheet, description: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
        <div className="flex justify-between mt-3"><button type="button" disabled={mutation.isPending} onClick={() => removePin(selected.id)} className="px-3 py-2 rounded-lg text-hp-danger">Eliminar marcador</button><button type="button" disabled={mutation.isPending || !sheet.name.trim()} onClick={saveSheet} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold">Guardar</button></div>
      </section>}
    </main>
    <section className="p-4 md:p-6 border-t border-border-low-contrast grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        {details ? <form aria-label="Editar mapa" className="space-y-3 rounded-lg border border-line p-4" onSubmit={(event) => { event.preventDefault(); if (details.name.trim()) saveDetails.mutate(details); }}>
          <label className="block text-sm font-label-bold">Nombre<input required value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
          <label className="block text-sm font-label-bold">Ubicación<input value={details.location} onChange={(event) => setDetails({ ...details, location: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
          <label className="block text-sm font-label-bold">URL de la imagen<input value={details.image_url} onChange={(event) => setDetails({ ...details, image_url: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
          <label className="block text-sm font-label-bold">Descripción<textarea rows={4} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>
          <div className="flex gap-2"><button type="submit" disabled={saveDetails.isPending || !details.name.trim()} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold disabled:opacity-50">{saveDetails.isPending ? 'Guardando…' : 'Guardar'}</button><button type="button" onClick={() => setDetails(null)} className="px-4 py-2 rounded-lg border">Cancelar</button></div>
        </form> : <>
        <p className="text-secondary">{data.location}</p>
        <p className="whitespace-pre-wrap">{data.description}</p></>}
        <div className="flex gap-2 items-end flex-wrap"><label className="text-sm font-label-bold">Nombre del marcador<input value={pinName} onChange={(event) => setPinName(event.target.value)} placeholder="Nombre del lugar" className="block mt-1 rounded bg-surface-subtle border-border-low-contrast" /></label><button type="button" onClick={() => setAdding(!adding)} disabled={!pinName.trim() && !adding} className="px-4 py-2 bg-primary-container rounded-lg">{adding ? 'Terminar marcadores' : 'Añadir marcadores'}</button></div>
        {adding && <p className="text-sm text-secondary">Haz clic en el mapa para colocar «{pinName || '…'}». Arrastra para mover la vista; rueda o +/− para el zoom.</p>}
      </div>
      <div><h2 className="font-label-bold mb-2">Marcadores ({pins.length})</h2>
        {pins.length === 0 ? <p className="text-sm text-secondary">Aún no hay marcadores.</p> : <ul className="divide-y divide-line rounded-lg border border-line">{pins.map((pin) => <li key={pin.id} className="flex items-center gap-2 px-3 py-2"><button type="button" onClick={() => select(pin)} className={`grow text-left text-sm ${pin.id === selectedId ? 'text-gold font-semibold' : ''}`}>◆ {pin.name}</button><button type="button" aria-label={`Eliminar ${pin.name}`} disabled={mutation.isPending} onClick={() => removePin(pin.id)} className="text-hp-danger">×</button></li>)}</ul>}
      </div>
    </section>
  </div>;
}
