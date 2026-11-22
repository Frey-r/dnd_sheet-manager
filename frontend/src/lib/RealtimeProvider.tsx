import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeContext, RealtimeSendContext, type ConnectionStatus } from './RealtimeContext';
import { useAuth } from './hooks';
import { getAuthToken } from '../services/authStorage';

// Two 30 s heartbeats plus 20 s of grace (resilience.md: two missed pongs close the socket).
const HEARTBEAT_TIMEOUT_MS = 80_000;

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
    // resilience.md: exponential backoff with jitter, base 1 s, max 30 s.
    let retry = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The server sends a text heartbeat every 30 s; two missed ones (plus grace) mean a dead link.
    let lastSeen = Date.now();
    const watchdog = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN && Date.now() - lastSeen > HEARTBEAT_TIMEOUT_MS) socket.close();
    }, 10_000);
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
        retry = 1000;
        lastSeen = Date.now();
        setStatus('connected');
        socket?.send(JSON.stringify({ token, campaign_id: campaignID, last_event_id: lastEvent.current[campaignID] || 0 }));
      };
      socket.onmessage = (event) => {
        lastSeen = Date.now();
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; payload?: { event_id?: number; data?: unknown } };
          if (message.type === 'heartbeat') return;
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
      clearInterval(watchdog);
      if (timer) clearTimeout(timer);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, [campaignID, isAuthenticated, queryClient]);
  return <RealtimeContext.Provider value={campaignID ? status : 'disconnected'}><RealtimeSendContext.Provider value={send}>{children}</RealtimeSendContext.Provider></RealtimeContext.Provider>;
}
