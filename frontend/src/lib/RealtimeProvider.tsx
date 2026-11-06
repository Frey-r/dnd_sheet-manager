import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeContext, RealtimeSendContext, type ConnectionStatus } from './RealtimeContext';
import { useAuth } from './hooks';
import { getAuthToken } from '../services/authStorage';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const campaignID = Number(location.pathname.match(/^\/campaign\/(\d+)/)?.[1] || 0);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const lastEvent = useRef<Record<number, number>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const send = useCallback((type: string, data: unknown) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, data }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !campaignID) return;
    let socket: WebSocket | null = null;
    let retry = 500;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const connect = () => {
      const token = getAuthToken();
      if (!active || !token) return;
      setStatus('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 500;
        setStatus('connected');
        socket?.send(JSON.stringify({ token, campaign_id: campaignID, last_event_id: lastEvent.current[campaignID] || 0 }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; payload?: { event_id?: number; data?: unknown } };
          const eventID = message.payload?.event_id;
          if (eventID) lastEvent.current[campaignID] = Math.max(lastEvent.current[campaignID] || 0, eventID);
          // Fine-grained events for screens that apply them directly (e.g. the VTT).
          window.dispatchEvent(new CustomEvent('realtime', { detail: message }));
          // Token moves are applied in place by the table; everything else refreshes active queries,
          // coalesced so a replay of many stored events on reconnect triggers a single refetch.
          if (message.type !== 'vtt.token.moved' && !refreshTimer) {
            refreshTimer = setTimeout(() => {
              refreshTimer = undefined;
              void queryClient.invalidateQueries({ refetchType: 'active' });
            }, 150);
          }
        } catch { /* An invalid frame must not interrupt the session. */ }
      };
      socket.onclose = () => {
        if (!active) return;
        setStatus('disconnected');
        timer = setTimeout(connect, retry + Math.floor(Math.random() * 250));
        retry = Math.min(retry * 2, 30_000);
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, [campaignID, isAuthenticated, queryClient]);
  return <RealtimeContext.Provider value={campaignID ? status : 'disconnected'}><RealtimeSendContext.Provider value={send}>{children}</RealtimeSendContext.Provider></RealtimeContext.Provider>;
}
