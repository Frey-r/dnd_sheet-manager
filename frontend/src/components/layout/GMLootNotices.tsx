import { useEffect, useState } from 'react';
import { useCampaign } from '../../lib/useCampaign';

type LootEvent = { object_id: number; character_id: number; success: boolean; detail: string };
type Notice = LootEvent & { id: string };

function isLootEvent(value: unknown): value is LootEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.object_id === 'number' && typeof v.character_id === 'number' && typeof v.success === 'boolean';
}

/**
 * GM-only feed of object interactions (vtt-modes.md §3/§6: "the GM SHALL be notified").
 * The server sends vtt.object.looted only to the campaign's GMs, so players never get it.
 */
export function GMLootNotices({ campaignId }: { campaignId: string }) {
  const { characters } = useCampaign(campaignId);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const message = (event as CustomEvent<{ type?: string; payload?: { data?: unknown } }>).detail;
      if (message?.type !== 'vtt.object.looted' || !isLootEvent(message.payload?.data)) return;
      const notice: Notice = { ...message.payload.data, id: crypto.randomUUID() };
      setNotices((previous) => [...previous.slice(-4), notice]);
      setTimeout(() => setNotices((previous) => previous.filter((n) => n.id !== notice.id)), 12_000);
    };
    window.addEventListener('realtime', onRealtime);
    return () => window.removeEventListener('realtime', onRealtime);
  }, []);

  if (notices.length === 0) return null;
  return (
    <div className="fixed right-4 top-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
      {notices.map((notice) => {
        const who = characters.find((c) => c.id === notice.character_id)?.name ?? `Personaje #${notice.character_id}`;
        return (
          <div key={notice.id} className={`rounded-lg border bg-bg-elev p-3 text-sm shadow-lg ${notice.success ? 'border-success-active' : 'border-line'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-label-bold">{who} {notice.success ? 'consiguió el objeto' : 'falló la interacción'}</p>
              <button type="button" aria-label="Cerrar aviso" className="text-secondary" onClick={() => setNotices((previous) => previous.filter((n) => n.id !== notice.id))}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            {notice.detail && <p className="mt-1 text-on-surface-variant">{notice.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}
