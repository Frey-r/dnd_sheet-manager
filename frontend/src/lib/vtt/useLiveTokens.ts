/* Animates NPC routes on the board (vtt-npc-routines.md §5): while any route runs, re-renders once per animation
 * frame and returns the tokens at their live route position. No requests: the clock is local. */
import { useEffect, useMemo, useState } from 'react';
import type { VTTScene, VTTToken } from '../../services/vttApi';
import { liveTokenPosition } from './routePosition';

export function useLiveTokens(tokens: VTTToken[], scene: VTTScene): VTTToken[] {
  const running = tokens.some((t) => t.route && t.route_clock?.running);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    let id = 0;
    const loop = () => { setNow(performance.now()); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);
  return useMemo(() => tokens.map((t) => {
    if (!t.route || !t.route_clock) return t;
    const p = liveTokenPosition(t, scene, now);
    return p.x === t.x && p.y === t.y ? t : { ...t, ...p };
  }), [tokens, scene, now]);
}
