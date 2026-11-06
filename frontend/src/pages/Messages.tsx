import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignApi, messageApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import type { CampaignMember, Conversation, Message } from '../types';

export function Messages() {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [selectedUserID, setSelectedUserID] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const conversations = useQuery({ queryKey: ['conversations', campaignId], queryFn: () => messageApi.list(campaignId).then((response) => response.data as Conversation[]) });
  const members = useQuery({ queryKey: ['campaign-members', campaignId], queryFn: () => campaignApi.members(campaignId).then((response) => response.data as CampaignMember[]) });
  const messages = useQuery({ queryKey: ['messages', campaignId, selectedUserID], enabled: selectedUserID > 0, queryFn: () => messageApi.conversation(campaignId, selectedUserID).then((response) => response.data as Message[]) });
  const send = useMutation({ mutationFn: () => messageApi.send(campaignId, { message_type: isGM ? 'gm_direct' : 'player_direct', body: body.trim(), recipient_user_id: selectedUserID }), onSuccess: () => { setBody(''); setError(''); void messages.refetch(); void conversations.refetch(); }, onError: (reason) => setError(getApiError(reason)) });
  const isGM = members.data?.some((member) => member.user_id === user?.id && member.role === 'gm') || false;
  const recipients = members.data?.filter((member) => member.user_id !== user?.id) || [];
  const selectRecipient = (id: number) => { setSelectedUserID(id); if (id) void messageApi.markRead().then(() => client.invalidateQueries({ queryKey: ['conversations', campaignId] })); };
  return <div className="min-h-screen flex flex-col"><header className="h-16 border-b border-border-low-contrast px-4 flex items-center gap-3"><Link to={`/campaign/${campaignId}`} aria-label="Volver"><span className="material-symbols-outlined">arrow_back</span></Link><h1 className="font-headline-md font-bold">Mensajes</h1></header><div className="flex-1 grid md:grid-cols-[18rem_1fr] min-h-0"><aside className="border-r border-border-low-contrast p-3"><label className="font-label-bold text-sm">Nueva conversación<select aria-label="Destinatario" value={selectedUserID} onChange={(event) => selectRecipient(Number(event.target.value))} className="mt-1 w-full rounded bg-surface-subtle border-border-low-contrast"><option value={0}>Selecciona un miembro</option>{recipients.map((member) => <option key={member.user_id} value={member.user_id}>{member.username} ({member.role})</option>)}</select></label><div className="mt-4">{conversations.isLoading ? <LoadingState /> : conversations.data?.map((conversation) => <button type="button" key={conversation.other_user_id} onClick={() => selectRecipient(conversation.other_user_id)} className={`w-full text-left p-3 rounded ${selectedUserID === conversation.other_user_id ? 'bg-primary-container' : 'hover:bg-surface-container'}`}><p className="font-label-bold">{conversation.other_username}</p><p className="text-sm text-secondary truncate">{conversation.last_message}</p></button>)}</div></aside><section className="flex flex-col min-h-[30rem]"><div className="flex-1 overflow-y-auto p-4 space-y-3">{!selectedUserID ? <p className="text-secondary text-center py-20">Elige un miembro para comenzar.</p> : messages.isLoading ? <LoadingState /> : messages.data?.slice().reverse().map((message) => <div key={message.id} className={`max-w-[85%] rounded-xl px-4 py-2 ${message.sender_user_id === user?.id ? 'ml-auto bg-primary-container text-on-primary-container' : 'bg-surface-container'}`}><p className="whitespace-pre-wrap">{message.body}</p><p className="text-xs text-secondary mt-1">{new Date(message.created_at).toLocaleString()}</p></div>)}</div>{error && <ErrorState message={error} />}<form onSubmit={(event) => { event.preventDefault(); if (selectedUserID && body.trim()) send.mutate(); }} className="border-t border-border-low-contrast p-4 flex gap-2"><textarea aria-label="Mensaje" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (selectedUserID && body.trim()) send.mutate(); } }} placeholder="Escribe un mensaje…" className="flex-1 rounded-lg bg-surface-subtle border-border-low-contrast resize-none" /><button type="submit" disabled={!body.trim() || !selectedUserID || send.isPending} aria-label="Enviar" className="px-4 bg-primary-container rounded-lg disabled:opacity-50"><span className="material-symbols-outlined">send</span></button></form></section></div></div>;
}
