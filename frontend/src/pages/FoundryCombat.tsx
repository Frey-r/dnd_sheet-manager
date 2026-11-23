import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { foundryApi } from '../services/api';
import { useCampaign } from '../lib/useCampaign';
import { itemCount } from '../lib/plural';

const FOUNDRY_URL = import.meta.env.VITE_FOUNDRY_URL as string | undefined;

interface SyncCounts {
  characters: number;
  npcs: number;
  items: number;
  scenes: number;
  journal: number;
  monsters: number;
}

interface SyncState {
  status: string;
  last_synced_at?: string;
  counts?: SyncCounts;
  error?: string;
}

/**
 * Live combat / play view: embeds the Foundry client in an iframe.
 * Foundry is the source of truth for game state; the GM can trigger a one-way
 * sync into this app's mirror. See openspec/specs/foundry-integration.md.
 */
export function FoundryCombat() {
  const { campaignId } = useParams<{ campaignId: string }>();
  // Only the campaign's GM may trigger a sync; players just see the Foundry client.
  const { isGM: isDM } = useCampaign(campaignId);
  const [state, setState] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!campaignId) return;
    try {
      const res = await foundryApi.status(campaignId);
      setState(res.data);
    } catch {
      /* status is best-effort */
    }
  }, [campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar
    loadStatus();
  }, [loadStatus]);

  const handleSync = async () => {
    if (!campaignId) return;
    setSyncing(true);
    setMsg(null);
    try {
      const res = await foundryApi.sync(campaignId);
      const c: SyncCounts = res.data.counts;
      setMsg(
        `Sincronizado: ${c.characters} personajes, ${c.npcs} NPCs, ${itemCount(c.items)}, ${c.scenes} mapas, ${c.journal} entradas de lore.`,
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg(`Error al sincronizar: ${err.response?.data?.error ?? 'desconocido'}`);
    } finally {
      setSyncing(false);
      loadStatus();
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-title-lg text-on-surface">Combate (Foundry VTT)</h1>
          <p className="font-body-sm text-on-surface-variant">
            Vista en vivo del cliente de Foundry. Inicia sesión en Foundry dentro del marco si se te solicita.
          </p>
        </div>
        {isDM && (
          <div className="flex items-center gap-3">
            {state?.last_synced_at && (
              <span className="font-label-sm text-on-surface-variant">
                Último sync: {new Date(state.last_synced_at).toLocaleString()}
                {state.status === 'error' && <span className="text-error"> (con errores)</span>}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-bold disabled:opacity-60"
            >
              <span className="material-symbols-outlined">{syncing ? 'progress_activity' : 'sync'}</span>
              {syncing ? 'Sincronizando…' : 'Sincronizar desde Foundry'}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-body-sm">{msg}</div>
      )}

      {FOUNDRY_URL ? (
        <iframe
          title="Foundry VTT"
          src={FOUNDRY_URL}
          className="flex-1 w-full rounded-lg border border-border-low-contrast bg-black min-h-[60vh]"
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border-low-contrast text-on-surface-variant text-center p-8">
          <div>
            <span className="material-symbols-outlined text-4xl">tv_off</span>
            <p className="font-body-md mt-2">
              Configura <code>VITE_FOUNDRY_URL</code> en el frontend para mostrar el cliente de Foundry aquí.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
