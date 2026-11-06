import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { mapApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';

type Pin = { id: number; name: string; description: string; x: number; y: number };
type MapEntry = { id: number; name: string; location: string; image_url: string; description: string; pins: Pin[] };

export function MapDetail() {
  const { campaignId = '', mapId = '' } = useParams();
  const [zoom, setZoom] = useState(1);
  const [showPins, setShowPins] = useState(true);
  const [grid, setGrid] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pinName, setPinName] = useState('');
  const [error, setError] = useState('');
  const map = useQuery({ queryKey: ['maps', campaignId, mapId], queryFn: () => mapApi.get(campaignId, mapId).then((response) => response.data as MapEntry) });
  const mutation = useMutation({ mutationFn: (pins: Pin[]) => mapApi.update(campaignId, mapId, { pins }), onSuccess: () => { void map.refetch(); setAdding(false); setPinName(''); setError(''); }, onError: (reason) => setError(getApiError(reason)) });
  const addPin = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!adding || !map.data || !pinName.trim()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pin: Pin = { id: Date.now(), name: pinName.trim(), description: '', x: Math.round((event.clientX - rect.left) / rect.width * 1000) / 10, y: Math.round((event.clientY - rect.top) / rect.height * 1000) / 10 };
    mutation.mutate([...(map.data.pins || []), pin]);
  };
  if (map.isLoading) return <LoadingState />;
  if (map.error || !map.data) return <ErrorState message="Mapa no encontrado" />;
  const data = map.data;
  return <div className="min-h-screen flex flex-col"><header className="h-16 border-b border-border-low-contrast px-4 flex items-center justify-between gap-3"><Link to={`/campaign/${campaignId}/gm/maps`} aria-label="Volver"><span className="material-symbols-outlined">arrow_back</span></Link><h1 className="font-headline-md font-bold flex-1">{data.name}</h1><button type="button" onClick={() => setGrid(!grid)} className="px-3 py-2 border rounded">{grid ? 'Ocultar' : 'Mostrar'} cuadrícula</button><button type="button" onClick={() => setShowPins(!showPins)} className="px-3 py-2 border rounded">Marcadores</button></header><main className="flex-1 relative overflow-hidden min-h-[70vh] bg-surface-subtle"><div onClick={addPin} className={`absolute inset-0 ${adding ? 'cursor-crosshair' : ''}`}>{data.image_url ? <img src={data.image_url} alt={data.name} className="w-full h-full object-contain transition-transform" style={{ transform: `scale(${zoom})` }} /> : <div className="h-full flex items-center justify-center text-secondary">Este mapa no tiene imagen.</div>}{grid && <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }} />}{showPins && (data.pins || []).map((pin) => <button type="button" key={pin.id} onClick={(event) => { event.stopPropagation(); if (adding) mutation.mutate(data.pins.filter((item) => item.id !== pin.id)); }} title={adding ? 'Eliminar marcador' : pin.name} className="absolute -translate-x-1/2 -translate-y-full bg-primary text-on-primary rounded-full px-2 py-1 text-xs shadow-md" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>◆ {pin.name}</button>)}</div><div className="absolute top-4 right-4 flex flex-col bg-surface border rounded-lg"><button type="button" aria-label="Acercar" onClick={() => setZoom(Math.min(3, zoom + 0.2))} className="px-3 py-2 text-xl">+</button><button type="button" aria-label="Alejar" onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} className="px-3 py-2 text-xl">−</button></div>{error && <div className="absolute top-4 left-4"><ErrorState message={error} /></div>}</main><section className="p-4 md:p-6 border-t border-border-low-contrast space-y-3"><p className="text-secondary">{data.location}</p><p className="whitespace-pre-wrap">{data.description}</p><div className="flex gap-2 items-end"><input aria-label="Nombre del marcador" value={pinName} onChange={(event) => setPinName(event.target.value)} placeholder="Nombre del lugar" className="rounded bg-surface-subtle border-border-low-contrast" /><button type="button" onClick={() => setAdding(!adding)} disabled={!pinName.trim() && !adding} className="px-4 py-2 bg-primary-container rounded-lg">{adding ? 'Terminar marcadores' : 'Añadir marcadores'}</button></div>{adding && <p className="text-sm text-secondary">Haz clic en el mapa para añadir; haz clic en un marcador para eliminarlo.</p>}</section></div>;
}
