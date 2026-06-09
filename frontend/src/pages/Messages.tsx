import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { messageApi } from '../services/api';
import type { Conversation, Message } from '../types';

export function Messages() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    messageApi.list(campaignId)
      .then(r => setConversations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => {
    if (!selectedUserId || !campaignId) return;
    messageApi.conversation(campaignId, selectedUserId)
      .then(r => setMessages(r.data))
      .catch(() => {});
  }, [selectedUserId, campaignId]);

  const handleSend = async () => {
    if (!body.trim() || !selectedUserId || !campaignId) return;
    setSending(true);
    try {
      await messageApi.send(campaignId, {
        message_type: 'player_direct',
        body: body.trim(),
        recipient_user_id: selectedUserId,
      });
      setBody('');
      messageApi.conversation(campaignId, selectedUserId)
        .then(r => setMessages(r.data))
        .catch(() => {});
    } catch { /* ignore */ }
    setSending(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center px-4">
        <Link to={`/campaign/${campaignId}`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold ml-2">Messages</h1>
      </header>

      <div className="flex-1 flex">
        <div className="w-80 border-r border-border-low-contrast overflow-y-auto hidden md:block">
          {loading ? (
            <div className="p-4 text-secondary font-body-md">Cargando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-secondary font-body-md">No hay conversaciones</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.other_user_id}
                onClick={() => setSelectedUserId(c.other_user_id)}
                className={`w-full text-left p-4 border-b border-border-low-contrast hover:bg-surface-subtle transition-colors ${
                  selectedUserId === c.other_user_id ? 'bg-surface-subtle border-l-4 border-l-primary' : ''
                }`}
              >
                <div className="font-label-bold text-on-surface">{c.other_username}</div>
                <div className="font-label-sm text-on-surface-variant truncate">{c.last_message}</div>
                {c.unread_count > 0 && (
                  <span className="bg-primary text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2">{c.unread_count}</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {selectedUserId ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      m.sender_user_id === selectedUserId
                        ? 'bg-surface-container-high mr-auto rounded-bl-sm'
                        : 'bg-primary-container text-on-primary-container ml-auto rounded-br-sm'
                    }`}
                  >
                    <div className="font-body-md">{m.body}</div>
                    <div className="font-label-sm text-secondary mt-1">{new Date(m.created_at).toLocaleTimeString()}</div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center py-20 text-secondary font-body-md">No hay mensajes aún</div>
                )}
              </div>
              <div className="border-t border-border-low-contrast p-4 flex gap-3">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className="flex-1 bg-surface-subtle border border-border-low-contrast rounded-lg px-4 py-3 font-body-md resize-none outline-none focus:border-primary"
                />
                <button
                  onClick={handleSend}
                  disabled={!body.trim() || sending}
                  className="bg-primary-container text-on-primary-container px-4 rounded-lg font-label-bold hover:bg-surface-tint transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-secondary font-body-md">
              Selecciona una conversación
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
