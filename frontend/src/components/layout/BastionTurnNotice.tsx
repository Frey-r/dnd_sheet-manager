import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Player-facing notice when the GM runs a Bastion turn (market-bastions.md §6.4: "owners are
 * notified"). The turn log itself lives on the Bastions page; this only points there.
 */
export function BastionTurnNotice({ campaignId }: { campaignId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onRealtime = (event: Event) => {
      const message = (event as CustomEvent<{ type?: string }>).detail;
      if (message?.type !== 'BASTION_TURN') return;
      setVisible(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 15_000);
    };
    window.addEventListener('realtime', onRealtime);
    return () => {
      window.removeEventListener('realtime', onRealtime);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed right-4 top-20 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-bg-elev p-3 text-sm shadow-lg" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <p className="font-label-bold">El DM ha resuelto un turno de bastión</p>
        <button type="button" aria-label="Cerrar aviso" className="text-secondary" onClick={() => setVisible(false)}>
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      <Link to={`/campaign/${campaignId}/bastions`} className="mt-1 inline-block text-accent underline" onClick={() => setVisible(false)}>
        Ver el resultado en tu bastión
      </Link>
    </div>
  );
}
