import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/hooks';

type Frame = { type?: string; timestamp?: number; payload?: { data?: { actor_id?: number } } };
type Toast = { id: string; text: string; to: string };

/** Typed realtime events that deserve a toast, with their text and destination. */
const NOTICES: Record<string, { text: string; page: 'trade' | 'chat' }> = {
  TRADE_OFFER: { text: 'Nueva oferta de intercambio', page: 'trade' },
  TRADE_ACCEPTED: { text: 'Se aceptó un intercambio', page: 'trade' },
  TRADE_REJECTED: { text: 'Se rechazó un intercambio', page: 'trade' },
  TRADE_INVALIDATED: { text: 'Un intercambio quedó invalidado: un objeto ya no está disponible', page: 'trade' },
  MESSAGE_PLAYER: { text: 'Nuevo mensaje', page: 'chat' },
  MESSAGE_GM: { text: 'Nuevo mensaje del DM', page: 'chat' },
};
/** Events replayed after a reconnect are older than this and do not pop up again. */
const FRESH_MS = 15_000;

/** Global toasts for trade and message events of the open campaign (frontend-screens.md). */
export function RealtimeToasts({ campaignId }: { campaignId: string }) {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const frame = (event as CustomEvent<Frame>).detail;
      const notice = frame?.type ? NOTICES[frame.type] : undefined;
      if (!notice) return;
      if (frame.payload?.data?.actor_id && frame.payload.data.actor_id === user?.id) return;
      if (frame.timestamp && Date.now() - frame.timestamp > FRESH_MS) return;
      const toast: Toast = { id: crypto.randomUUID(), text: notice.text, to: `/campaign/${campaignId}/${notice.page}` };
      setToasts((previous) => [...previous.slice(-2), toast]);
      setTimeout(() => setToasts((previous) => previous.filter((t) => t.id !== toast.id)), 6000);
    };
    window.addEventListener('realtime', onRealtime);
    return () => window.removeEventListener('realtime', onRealtime);
  }, [campaignId, user?.id]);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed left-1/2 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg-elev p-3 text-sm shadow-lg">
          <Link to={toast.to} className="font-label-bold hover:underline" onClick={() => setToasts((previous) => previous.filter((t) => t.id !== toast.id))}>{toast.text}</Link>
          <button type="button" aria-label="Cerrar aviso" className="text-secondary" onClick={() => setToasts((previous) => previous.filter((t) => t.id !== toast.id))}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}
