/* Real-time exploration movement (openspec/specs/vtt-modes.md §2). */
import { useEffect, useRef } from 'react';
import type { VTTScene, VTTToken, Wall } from '../services/vttApi';

function crosses(ax: number, ay: number, bx: number, by: number, w: Wall) {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = o(w.x1, w.y1, w.x2, w.y2, ax, ay), d2 = o(w.x1, w.y1, w.x2, w.y2, bx, by);
  const d3 = o(ax, ay, bx, by, w.x1, w.y1), d4 = o(ax, ay, bx, by, w.x2, w.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Mirrors the server's SlideMove: blocked steps slide along one axis or stop. */
function slide(walls: Wall[], x1: number, y1: number, x2: number, y2: number): [number, number] {
  const blocked = (bx: number, by: number) => walls.some((w) => !(w.door && w.open) && crosses(x1, y1, bx, by, w));
  if (!blocked(x2, y2)) return [x2, y2];
  if (x2 !== x1 && !blocked(x2, y1)) return [x2, y1];
  if (y2 !== y1 && !blocked(x1, y2)) return [x1, y2];
  return [x1, y1];
}

/** Real-time movement: WASD/arrows or the joystick vector move `token` at its sheet speed. */
export function useExplorationMovement(opts: {
  scene: VTTScene | null | undefined;
  token: VTTToken | null;
  enabled: boolean;
  joystick: { x: number; y: number };
  onStep: (x: number, y: number) => void;
}) {
  const { scene, token, enabled, joystick, onStep } = opts;
  const keys = useRef(new Set<string>());
  const pos = useRef<{ id: number; x: number; y: number } | null>(null);
  const stick = useRef(joystick);
  const step = useRef(onStep);
  const walls = useRef<Wall[]>(scene?.walls ?? []);
  useEffect(() => { stick.current = joystick; step.current = onStep; walls.current = scene?.walls ?? []; });
  useEffect(() => {
    if (token && (!pos.current || pos.current.id !== token.id || Math.hypot(pos.current.x - token.x, pos.current.y - token.y) > (scene?.grid_size_px ?? 70) * 2)) {
      pos.current = { id: token.id, x: token.x, y: token.y };
    }
  }, [token, scene?.grid_size_px]);
  // Depend on primitives only: every step patches the scene object, which must not restart the loop.
  const sceneId = scene?.id;
  const grid = scene?.grid_size_px ?? 70;
  const ftPerCell = scene?.feet_per_cell ?? 5;
  const pace = scene?.exploration_pace ?? 2;
  const maxX = scene?.width_px ?? 0;
  const maxY = scene?.height_px ?? 0;
  const tokenId = token?.id;
  const speed = token?.speed_ft ?? 30;
  const sneaking = !!token?.sneaking;
  useEffect(() => {
    if (!enabled || !sceneId || !tokenId) return;
    const pressed = keys.current;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { pressed.add(k); e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => pressed.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const blur = () => pressed.clear();
    window.addEventListener('blur', blur);
    // The server is authoritative: resync when it corrects our position.
    const onRealtime = (e: Event) => {
      const msg = (e as CustomEvent<{ type?: string; payload?: { data?: { token_id: number; x: number; y: number; corrected?: boolean } } }>).detail;
      const d = msg?.payload?.data;
      if (msg?.type === 'vtt.token.moved' && d?.corrected && d.token_id === tokenId) pos.current = { id: tokenId, x: d.x, y: d.y };
    };
    window.addEventListener('realtime', onRealtime);
    const pxPerFt = grid / Math.max(1, ftPerCell);
    const rate = Math.max(5, speed || 30) * pxPerFt / 6 * (pace || 2) * (sneaking ? 0.5 : 1);
    let last = performance.now();
    let sent = 0;
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const k = pressed;
      let dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + stick.current.x;
      let dy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0) + stick.current.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.15 || !pos.current) return;
      if (len > 1) { dx /= len; dy /= len; }
      const [nx, ny] = slide(walls.current, pos.current.x, pos.current.y,
        Math.max(0, Math.min(maxX, pos.current.x + dx * rate * dt)),
        Math.max(0, Math.min(maxY, pos.current.y + dy * rate * dt)));
      pos.current = { id: pos.current.id, x: nx, y: ny };
      if (now - sent > 120) { sent = now; step.current(pos.current.x, pos.current.y); }
    }, 33);
    return () => { clearInterval(id); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('realtime', onRealtime); };
  }, [enabled, sceneId, tokenId, grid, ftPerCell, pace, maxX, maxY, speed, sneaking]);
}
