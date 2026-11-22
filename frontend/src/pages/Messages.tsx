import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignApi, messageApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import type { CampaignMember, Conversation, Message } from '../types';

const BROADCAST = -1;
const stamp = (iso: string) => new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function Messages() {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [selectedUserID, setSelectedUserID] = useState(0);
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const conversations = useQuery({ queryKey: ['conversations', campaignId], queryFn: () => messageApi.list(campaignId).then((response) => (response.data ?? []) as Conversation[]) });
  const members = useQuery({ queryKey: ['campaign-members', campaignId], queryFn: () => campaignApi.members(campaignId).then((response) => response.data as CampaignMember[]) });
  const isBroadcast = selectedUserID === BROADCAST;
  const messages = useQuery({ queryKey: ['messages', campaignId, selectedUserID], enabled: selectedUserID > 0, queryFn: () => messageApi.conversation(campaignId, selectedUserID).then((response) => (response.data ?? []) as Message[]) });
  const isGM = members.data?.some((member) => member.user_id === user?.id && member.role === 'gm') || false;
  const gmIds = new Set((members.data ?? []).filter((member) => member.role === 'gm').map((member) => member.user_id));
  const recipients = members.data?.filter((member) => member.user_id !== user?.id) || [];
  const nameOf = (id: number) => members.data?.find((member) => member.user_id === id)?.username ?? `Usuario ${id}`;

  const markRead = useMutation({
    mutationFn: (otherId: number) => messageApi.markRead({ campaignId, userId: otherId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['conversations', campaignId] }),
  });
  const send = useMutation({
    mutationFn: () => messageApi.send(campaignId, isBroadcast
      ? { message_type: 'gm_broadcast', body: body.trim() }
      : { message_type: isGM ? 'gm_direct' : 'player_direct', body: body.trim(), recipient_user_id: selectedUserID }),
    onSuccess: () => {
      setBody('');
      setNotice(isBroadcast ? 'Anuncio enviado a toda la mesa.' : '');
      void client.invalidateQueries({ queryKey: ['messages', campaignId, selectedUserID] });
      void client.invalidateQueries({ queryKey: ['conversations', campaignId] });
    },
  });
  const select = (id: number) => {
    setSelectedUserID(id); setNotice(''); send.reset(); markRead.reset();
    if (id > 0) markRead.mutate(id);
  };
  const submit = () => { if (selectedUserID && body.trim() && !send.isPending) send.mutate(); };
  const ordered = messages.data?.slice().reverse() ?? [];
  const errors = [conversations.error && getApiError(conversations.error, 'No se pudieron cargar las conversaciones'), members.error && getApiError(members.error, 'No se pudieron cargar los miembros'), messages.error && getApiError(messages.error, 'No se pudo cargar la conversación'), send.error && getApiError(send.error, 'No se pudo enviar el mensaje'), markRead.error && getApiError(markRead.error, 'No se pudo marcar como leído')].filter((value): value is string => Boolean(value));

  return <div className="min-h-screen flex flex-col"><header className="h-16 border-b border-border-low-contrast px-4 flex items-center gap-3"><Link to={`/campaign/${campaignId}`} aria-label="Volver"><span className="material-symbols-outlined">arrow_back</span></Link><h1 className="font-headline-md font-bold">Mensajes</h1></header>
    <div className="flex-1 grid md:grid-cols-[18rem_1fr] min-h-0">
      <aside className="border-r border-border-low-contrast p-3">
        <label className="font-label-bold text-sm">Nueva conversación
          <select aria-label="Destinatario" value={selectedUserID} onChange={(event) => select(Number(event.target.value))} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast">
            <option value={0}>Selecciona un miembro</option>
            {isGM && <option value={BROADCAST}>Todos (anuncio del DM)</option>}
            {recipients.map((member) => <option key={member.user_id} value={member.user_id}>{member.username} ({member.role === 'gm' ? 'DM' : 'jugador'})</option>)}
          </select>
        </label>
        <div className="mt-4 space-y-1">
          {conversations.isLoading ? <LoadingState /> : conversations.data?.length === 0 ? <p className="text-sm text-secondary">Aún no tienes conversaciones.</p> : conversations.data?.map((conversation) => {
            const fromGM = gmIds.has(conversation.other_user_id);
            return <button type="button" key={conversation.other_user_id} onClick={() => select(conversation.other_user_id)} className={`w-full text-left p-3 rounded border-l-4 ${fromGM ? 'border-gm-amber' : 'border-transparent'} ${selectedUserID === conversation.other_user_id ? 'bg-primary-container' : 'hover:bg-surface-container'}`}>
              <div className="flex items-center justify-between gap-2"><p className="font-label-bold truncate">{conversation.other_username}{fromGM && <span className="ml-2 text-xs text-gm-amber">DM</span>}</p>{conversation.unread_count > 0 && <span aria-label={`${conversation.unread_count} sin leer`} className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center">{conversation.unread_count}</span>}</div>
              <p className="text-sm text-secondary truncate">{conversation.last_message}</p>
              <p className="text-xs text-secondary">{stamp(conversation.last_message_at)}</p>
            </button>;
          })}
        </div>
      </aside>
      <section className="flex flex-col min-h-[30rem]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!selectedUserID ? <p className="text-secondary text-center py-20">Elige un miembro para comenzar.</p>
            : isBroadcast ? <p className="text-secondary text-center py-20">Este anuncio llegará a todos los miembros de la campaña.</p>
            : messages.isLoading ? <LoadingState />
            : ordered.length === 0 ? <p className="text-secondary text-center py-20">Sin mensajes todavía con {nameOf(selectedUserID)}.</p>
            : ordered.map((message) => {
              const mine = message.sender_user_id === user?.id;
              const gm = gmIds.has(message.sender_user_id);
              return <div key={message.id} className={`max-w-[85%] rounded-xl px-4 py-2 ${mine ? 'ml-auto bg-primary-container text-on-primary-container' : 'bg-surface-container'} ${gm ? 'border-2 border-gm-amber' : ''}`}>
                {gm && !mine && <p className="text-xs font-label-bold text-gm-amber">DM</p>}
                <p className="whitespace-pre-wrap">{message.body}</p><p className="text-xs text-secondary mt-1">{stamp(message.created_at)}</p></div>;
            })}
        </div>
        {notice && <p role="status" className="px-4 text-success-active">{notice}</p>}
        {errors.map((message) => <div key={message} className="px-4 pb-2"><ErrorState message={message} /></div>)}
        <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="border-t border-border-low-contrast p-4 flex gap-2">
          <textarea aria-label="Mensaje" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={isBroadcast ? 'Escribe un anuncio para toda la mesa…' : 'Escribe un mensaje…'} className="flex-1 rounded-lg bg-surface-subtle border-border-low-contrast resize-none" />
          <button type="submit" disabled={!body.trim() || !selectedUserID || send.isPending} aria-label="Enviar" className="px-4 bg-primary-container rounded-lg disabled:opacity-50"><span className="material-symbols-outlined">send</span></button>
        </form>
      </section>
    </div></div>;
}
