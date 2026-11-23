import { createContext, useContext } from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export const RealtimeContext = createContext<ConnectionStatus>('disconnected');
export function useRealtime() { return useContext(RealtimeContext); }

/** Sends a typed message over the campaign WebSocket (no-op while disconnected). */
export type RealtimeSend = (type: string, data: unknown) => void;
export const RealtimeSendContext = createContext<RealtimeSend>(() => undefined);
export function useRealtimeSend() { return useContext(RealtimeSendContext); }
