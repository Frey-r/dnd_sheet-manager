import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { campaignApi, characterApi, loreApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import type { Character, CampaignMember } from '../types';

type Scope = 'character_lore' | 'campaign_plot' | 'gm_hidden_lore';
type Turn =
  | { id: number; role: 'user'; text: string; scope: Scope }
  | { id: number; role: 'oracle'; text: string; sources: string[]; failed?: boolean; retryQuery?: string; scope: Scope };
type LoreResponse = { answer?: string; sources?: string[] };
type LoreFailure = { type?: string; error?: string; message?: string; retryable?: boolean };

const SCOPES: { value: Scope; label: string; gmOnly?: boolean }[] = [
  { value: 'character_lore', label: 'Mi Personaje' },
  { value: 'campaign_plot', label: 'Trama de la Partida' },
  { value: 'gm_hidden_lore', label: 'Lore Oculto', gmOnly: true },
];
const SUGGESTIONS = ['¿Qué sabe mi personaje sobre su origen?', '¿Cuál es el estado actual de la trama?', '¿Quiénes son los aliados conocidos del grupo?', 'Resume lo ocurrido en la última sesión'];

function describeFailure(error: unknown): { text: string; retryable: boolean } {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as LoreFailure | undefined;
    if (data?.type === 'RAG_UNAVAILABLE') return { text: data.error ?? 'El Oráculo no está disponible en este servidor.', retryable: data.retryable ?? true };
    if (data?.type === 'RAG_TIMEOUT') return { text: 'El Oráculo tardó demasiado en responder. Inténtalo de nuevo.', retryable: data.retryable ?? true };
    if (typeof data?.error === 'string') return { text: data.error, retryable: false };
    if (!error.response) return { text: 'No hay conexión con el servidor.', retryable: true };
  }
  return { text: 'No se pudo consultar el Oráculo. Prueba de nuevo.', retryable: true };
}

export function LoreSearch() {
  const { campaignId = '' } = useParams<{ campaignId: string }>();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('character_lore');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [openSources, setOpenSources] = useState<Set<number>>(new Set());
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  const members = useQuery({ queryKey: ['campaign-members', campaignId], queryFn: () => campaignApi.members(campaignId).then((response) => response.data as CampaignMember[]) });
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => characterApi.listByCampaign(campaignId).then((response) => response.data as Character[]) });
  const isGM = members.data?.some((member) => member.user_id === user?.id && member.role === 'gm') ?? false;
  const myCharacter = characters.data?.find((character) => character.user_id === user?.id);
  const scopes = SCOPES.filter((item) => !item.gmOnly || isGM);

  const ask = useMutation({
    mutationFn: ({ text, askScope }: { text: string; askScope: Scope }) => loreApi.search(campaignId, text, askScope, myCharacter?.id).then((response) => response.data as LoreResponse),
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, ask.isPending]);

  const send = (text: string, askScope: Scope = scope) => {
    const trimmed = text.trim();
    if (!trimmed || !campaignId || ask.isPending) return;
    setTurns((previous) => [...previous, { id: nextId.current++, role: 'user', text: trimmed, scope: askScope }]);
    setQuery('');
    ask.mutate({ text: trimmed, askScope }, {
      onSuccess: (data) => setTurns((previous) => [...previous, { id: nextId.current++, role: 'oracle', text: data.answer?.trim() || 'El Oráculo no encontró nada relevante.', sources: data.sources ?? [], scope: askScope }]),
      onError: (reason) => {
        const failure = describeFailure(reason);
        setTurns((previous) => [...previous, { id: nextId.current++, role: 'oracle', text: failure.text, sources: [], failed: true, retryQuery: failure.retryable ? trimmed : undefined, scope: askScope }]);
      },
    });
  };
  const toggleSources = (id: number) => setOpenSources((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center px-4">
        <Link to={`/campaign/${campaignId}`} aria-label="Volver" className="p-2 rounded-full hover:bg-surface-container transition-colors"><span className="material-symbols-outlined">arrow_back</span></Link>
        <h1 className="font-headline-md text-on-surface font-bold ml-2">Oráculo de lore</h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-4">
        <div className="flex gap-2 mb-4 flex-wrap" role="group" aria-label="Ámbito de búsqueda">
          {scopes.map((item) => (
            <button key={item.value} type="button" aria-pressed={scope === item.value} onClick={() => setScope(item.value)}
              className={`font-label-bold px-4 py-2 rounded-full border transition-colors ${scope === item.value ? (item.gmOnly ? 'bg-gm-amber/10 border-gm-amber text-gm-amber' : 'bg-primary/5 border-primary text-primary') : 'border-border-low-contrast text-on-surface-variant hover:bg-surface-subtle'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4" aria-live="polite">
          {turns.length === 0 && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-outline mb-2 block">auto_awesome</span>
              <p className="text-secondary mb-4">Pregunta al Oráculo sobre el lore. Prueba con una de estas:</p>
              <div className="flex flex-wrap gap-2 justify-center">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)} className="px-3 py-2 rounded-full border border-border-low-contrast text-sm hover:border-primary">{suggestion}</button>)}</div>
            </div>
          )}
          {turns.map((turn) => turn.role === 'user' ? (
            <div key={turn.id} className="flex justify-end"><div className="max-w-[85%] rounded-xl px-4 py-2 bg-primary-container text-on-primary-container"><p className="whitespace-pre-wrap">{turn.text}</p></div></div>
          ) : (
            <div key={turn.id} className="flex"><div className={`max-w-[90%] rounded-xl px-4 py-3 border ${turn.failed ? 'bg-error-container text-on-error-container border-transparent' : turn.scope === 'gm_hidden_lore' ? 'bg-surface-container-lowest border-gm-amber' : 'bg-surface-container-lowest border-border-low-contrast'}`}>
              <p className="whitespace-pre-wrap">{turn.text}</p>
              {turn.retryQuery && <button type="button" onClick={() => send(turn.retryQuery ?? '', turn.scope)} className="mt-2 font-label-bold underline">Reintentar</button>}
              {turn.sources.length > 0 && (
                <div className="mt-3">
                  <button type="button" aria-expanded={openSources.has(turn.id)} onClick={() => toggleSources(turn.id)} className="text-sm text-primary font-label-bold">Ver Fuentes ({turn.sources.length})</button>
                  {openSources.has(turn.id) && <ul className="mt-2 list-disc pl-5 text-sm text-on-surface-variant space-y-1">{turn.sources.map((source, index) => <li key={`${index}-${source}`}>{source}</li>)}</ul>}
                </div>
              )}
            </div></div>
          ))}
          {ask.isPending && <div className="flex" role="status" aria-label="El Oráculo está escribiendo"><div className="rounded-xl px-4 py-3 bg-surface-container-lowest border border-border-low-contrast flex gap-1">{[0, 150, 300].map((delay) => <span key={delay} className="w-2 h-2 rounded-full bg-outline animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}</div></div>}
          <div ref={endRef} />
        </div>

        <form onSubmit={(event) => { event.preventDefault(); send(query); }} className="sticky bottom-20 md:bottom-0 bg-background py-4 border-t border-border-low-contrast flex gap-3">
          <input type="text" aria-label="Pregunta" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pregunta sobre el lore…" className="flex-1 bg-surface-subtle border border-border-low-contrast rounded-lg px-4 py-3 font-body-md outline-none focus:border-primary" />
          <button type="submit" aria-label="Enviar" disabled={!query.trim() || ask.isPending} className="bg-primary-container text-on-primary-container px-4 rounded-lg font-label-bold hover:bg-surface-tint transition-colors disabled:opacity-50"><span className="material-symbols-outlined">send</span></button>
        </form>
      </main>
    </div>
  );
}
