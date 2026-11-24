import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Pt as ZPt, SceneLight, VTTCombat, VTTObject, VTTScene, VTTToken, Wall, Zone } from '../../services/vttApi';
import { gridDistanceFt, newExploredCanvas, renderFog, type FogResult, type Pt } from '../../lib/vision';
import { auraForClass, drawAvatarInto, normalizeAppearance, parseStoredAppearance, resolveRaceVisual } from '../../lib/avatar';
import { useLiveTokens } from '../../lib/vtt/useLiveTokens';
import type { RoutePoint } from '../../lib/vtt/routePosition';
import { constrain45, mirrorHandle, nearestOnPath, reversePath, splitLeg, toCorner } from '../../lib/vtt/penOps';

export type Tool = 'select' | 'ruler' | 'wall' | 'door' | 'light' | 'erase' | 'zone' | 'object' | 'route' | 'npc';

interface Props {
  scene: VTTScene;
  tokens: VTTToken[];
  isGM: boolean;
  userId: number;
  /** tokens whose vision defines the fog; null = no fog (GM full view) */
  viewers: VTTToken[] | null;
  tool: Tool;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (token: VTTToken, x: number, y: number) => void;
  onWalls: (walls: Wall[]) => void;
  onLights: (lights: SceneLight[]) => void;
  objects?: VTTObject[];
  combats?: VTTCombat[];
  selectedObjectId?: number | null;
  onSelectObject?: (id: number | null) => void;
  onPlaceObject?: (x: number, y: number) => void;
  onZones?: (zones: Zone[]) => void;
  onRoute?: (token: VTTToken, points: { x: number; y: number }[], closed?: boolean) => void;
  onRouteEdit?: (token: VTTToken, points: { x: number; y: number }[]) => void;
  onPlaceNpc?: (x: number, y: number) => void;
  /** Campaign characters: tokens linked to one are drawn with its pixel-art avatar. */
  characters?: { id: number; race: string; class: string; appearance?: unknown }[];
}

function inPolygon(p: Pt, poly: ZPt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

interface View { x: number; y: number; z: number }

const imageCache = new Map<string, HTMLImageElement>();
function loadImage(url: string, onLoad: () => void): HTMLImageElement | null {
  if (!url) return null;
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    imageCache.set(url, img);
  }
  if (!img.complete) img.addEventListener('load', onLoad, { once: true });
  return img.complete && img.naturalWidth ? img : null;
}

function distToSegment(p: Pt, w: Wall) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2));
  return Math.hypot(p.x - (w.x1 + t * dx), p.y - (w.y1 + t * dy));
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Traces a route: straight legs with lineTo, legs with handles as cubic Béziers (D-0069). */
function tracePath(ctx: CanvasRenderingContext2D, pts: RoutePoint[], closed: boolean) {
  if (!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  const leg = (a: RoutePoint, b: RoutePoint) => {
    if (a.out || b.in) {
      const c1 = a.out ?? a, c2 = b.in ?? b;
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    } else ctx.lineTo(b.x, b.y);
  };
  for (let i = 1; i < pts.length; i++) leg(pts[i - 1], pts[i]);
  if (closed && pts.length > 1) leg(pts[pts.length - 1], pts[0]);
}

/** Bézier handles: a thin line from the anchor and a small circle at the handle. */
function drawHandles(ctx: CanvasRenderingContext2D, pts: RoutePoint[], z: number) {
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  for (const pt of pts) {
    for (const h of [pt.in, pt.out]) {
      if (!h) continue;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(h.x, h.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(h.x, h.y, 4 / z, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
  }
}

export function TableCanvas(props: Props) {
  const { scene, isGM, userId, viewers, tool, selectedId, onSelect, onMove, onWalls, onLights } = props;
  const { objects = [], combats = [], selectedObjectId = null, onSelectObject, onPlaceObject, onZones, onRoute, onRouteEdit, onPlaceNpc } = props;
  // Tokens at their live route position (vtt-npc-routines.md §5); the fog uses the stored ones.
  const tokens = useLiveTokens(props.tokens, scene);
  const [zoneDraft, setZoneDraft] = useState<Pt[]>([]);
  const [routeDraft, setRouteDraft] = useState<{ tokenId: number; points: RoutePoint[] } | null>(null);
  const activeTokenIds = useMemo(() => new Set(combats.map((c) => c.combatants[c.turn_index]?.token_id).filter(Boolean)), [combats]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [tick, setTick] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  const avatarFor = useMemo(() => {
    const byId = new Map((props.characters ?? []).map((c) => [c.id, c]));
    const look = (race: string | null | undefined, cls: string | null | undefined, appearance: unknown) => {
      const visual = resolveRaceVisual(race);
      return { visual, appearance: normalizeAppearance(parseStoredAppearance(appearance), visual), aura: auraForClass(cls) };
    };
    return (t: VTTToken) => {
      if (t.image_url) return null;
      if (t.character_id) {
        const c = byId.get(t.character_id);
        return c ? look(c.race, c.class, c.appearance) : null;
      }
      // Campaign NPCs placed on the map wear their pixel-art appearance (vtt-npc-routines.md §1).
      return t.npc_id && t.npc_appearance ? look(t.npc_race, t.npc_class, t.npc_appearance) : null;
    };
  }, [props.characters]);
  const drag = useRef<{ kind: 'pan'; sx: number; sy: number; vx: number; vy: number } | { kind: 'token'; token: VTTToken; ox: number; oy: number }
    | { kind: 'anchor'; token: VTTToken; index: number; sx: number; sy: number }
    | { kind: 'convert'; token: VTTToken; index: number; sx: number; sy: number }
    | { kind: 'handle'; token: VTTToken; index: number; which: 'in' | 'out'; alt: boolean }
    | { kind: 'pen'; index: number; sx: number; sy: number }
    | { kind: 'close'; sx: number; sy: number } | null>(null);
  /** The saved route being edited (anchors or handles dragged), shown live until the pointer is released. */
  const [editGhost, setEditGhost] = useState<RoutePoint[] | null>(null);
  const [ghost, setGhost] = useState<{ id: number; x: number; y: number } | null>(null);
  const [ruler, setRuler] = useState<{ a: Pt; b: Pt } | null>(null);
  const [chain, setChain] = useState<Pt | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const fitted = useRef<number | null>(null);
  const cell = scene.grid_size_px;

  // Explored memory per user and scene (vtt.md §4).
  const exploredKey = `vtt-explored:${scene.id}:${userId}:${viewers?.map((v) => v.id).join('-') ?? 'gm'}`;
  const explored = useMemo(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(exploredKey); } catch { /* ignore */ }
    return newExploredCanvas(scene, saved);
  }, [exploredKey, scene.width_px, scene.height_px]); // eslint-disable-line react-hooks/exhaustive-deps

  const storedTokens = props.tokens;
  const fog: FogResult | null = useMemo(() => {
    if (!viewers || !scene.fog_enabled) return null;
    return renderFog(scene, storedTokens, viewers, explored);
  }, [scene, storedTokens, viewers, explored]);

  useEffect(() => {
    if (!fog) return;
    const id = setTimeout(() => { try { localStorage.setItem(exploredKey, explored.toDataURL('image/png')); } catch { /* quota */ } }, 1500);
    return () => clearTimeout(id);
  }, [fog, explored, exploredKey]);

  // Resize to container.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the scene on first show.
  useEffect(() => {
    if (fitted.current === scene.id || size.w < 50) return;
    fitted.current = scene.id;
    const z = Math.min(size.w / scene.width_px, size.h / scene.height_px) * 0.95;
    setView({ z, x: (size.w - scene.width_px * z) / 2, y: (size.h - scene.height_px * z) / 2 });
  }, [scene.id, scene.width_px, scene.height_px, size]);

  const toScene = useCallback((cx: number, cy: number): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z };
  }, [view]);

  // ---------- Pen tool for NPC routes (vtt-npc-routines.md §6, D-0068) ----------
  /** Route anchors sit on background pixels: integers, no grid. */
  const pixel = (p: Pt): Pt => ({ x: Math.round(p.x), y: Math.round(p.y) });
  /** Anchor hit radius: 10 screen pixels. */
  const anchorHit = 10 / view.z;
  /** The token the route tool draws for: the selected NPC or monster. */
  const routeToken = tool === 'route' ? tokens.find((t) => t.id === selectedId && t.kind !== 'pc') ?? null : null;
  /** Callbacks get the token as the page gave it, not its live (animated) copy. */
  const original = (t: VTTToken) => props.tokens.find((x) => x.id === t.id) ?? t;
  /** The route being drawn for the selected token (the first anchor is P0). */
  const routePoints = routeToken && routeDraft?.tokenId === routeToken.id ? routeDraft.points : [];
  const finishOpen = () => {
    if (!routeToken || routePoints.length < 2) return; // one anchor is not a path yet: keep drawing
    onRoute?.(original(routeToken), routePoints, false);
    setRouteDraft(null);
  };
  /** The selected token's saved route anchors, as shown (with the anchor being dragged). */
  const editAnchors: RoutePoint[] = routeToken?.route && !routePoints.length ? editGhost ?? routeToken.route.points : [];

  const snapCorner = (p: Pt): Pt => ({
    x: scene.grid_offset_x + Math.round((p.x - scene.grid_offset_x) / cell) * cell,
    y: scene.grid_offset_y + Math.round((p.y - scene.grid_offset_y) / cell) * cell,
  });

  const visibleTokens = useMemo(() => tokens.filter((t) => isGM && !viewers ? true : !fog || t.owner_user_id === userId || fog.isVisible(t.x, t.y)), [tokens, fog, isGM, viewers, userId]);

  const tokenAt = (p: Pt) => [...visibleTokens].reverse().find((t) => Math.hypot(p.x - t.x, p.y - t.y) <= (t.size_cells * cell) / 2);
  const canMove = (t: VTTToken) => isGM || t.owner_user_id === userId;

  // ---------- Drawing ----------
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css('--bg') || '#0c0d10';
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.z, view.z);

    // Map
    const map = loadImage(scene.map_url, redraw);
    if (map) ctx.drawImage(map, 0, 0, scene.width_px, scene.height_px);
    else { ctx.fillStyle = '#23262c'; ctx.fillRect(0, 0, scene.width_px, scene.height_px); }

    // Grid
    ctx.beginPath();
    for (let x = scene.grid_offset_x % cell; x <= scene.width_px; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, scene.height_px); }
    for (let y = scene.grid_offset_y % cell; y <= scene.height_px; y += cell) { ctx.moveTo(0, y); ctx.lineTo(scene.width_px, y); }
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = 1 / view.z;
    ctx.stroke();

    // Interactive objects
    for (const o of objects) {
      if (fog && !isGM && !fog.isVisible(o.x, o.y)) continue;
      const r = cell * 0.32;
      ctx.save();
      ctx.globalAlpha = o.depleted ? 0.35 : 1;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(233,180,76,.92)'; ctx.fill();
      ctx.lineWidth = Math.max(2, 3 / view.z);
      ctx.strokeStyle = o.id === selectedObjectId ? '#ffffff' : (o.discover_dc ? 'rgba(90,169,230,.95)' : '#1d1405');
      if (o.discover_dc) ctx.setLineDash([5, 4]);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#1d1405';
      ctx.font = `${r * 1.25}px "Material Symbols Outlined"`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.icon || 'inventory_2', o.x, o.y + 1);
      ctx.restore();
    }

    // Tokens
    for (const t of visibleTokens) {
      const pos = ghost?.id === t.id ? ghost : t;
      const r = (t.size_cells * cell) / 2 - 3;
      ctx.save();
      ctx.globalAlpha = t.hidden ? 0.45 : 1;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      const linked = avatarFor(t);
      ctx.fillStyle = linked?.aura ? `${linked.aura}55` : t.color || '#c0392b';
      ctx.fill();
      const img = loadImage(t.image_url, redraw);
      if (img) { ctx.save(); ctx.clip(); ctx.drawImage(img, pos.x - r, pos.y - r, r * 2, r * 2); ctx.restore(); }
      else if (linked) {
        ctx.save(); ctx.clip();
        drawAvatarInto(ctx, linked.appearance, linked.visual, null, 'bust', pos.x - r, pos.y - r, r * 2, r * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${Math.max(10, r * 0.62)}px Geist, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(), pos.x, pos.y + 1);
      }
      ctx.lineWidth = Math.max(2, 3 / view.z);
      ctx.strokeStyle = t.id === selectedId ? '#ffffff' : t.owner_user_id === userId ? (css('--accent') || '#ff6a3d') : linked?.aura ?? 'rgba(0,0,0,.55)';
      if (t.hidden) ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      if (activeTokenIds.has(t.id)) {
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r + 7, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(3, 4 / view.z); ctx.strokeStyle = css('--accent') || '#ff6a3d'; ctx.stroke();
      }
      // HP bar: party tokens for everyone, the rest for the GM
      if (t.max_hp > 0 && (isGM || t.kind === 'pc' || t.owner_user_id === userId)) {
        const pct = Math.max(0, Math.min(1, t.hp / t.max_hp));
        const bw = r * 1.6, bx = pos.x - bw / 2, by = pos.y + r + 4;
        ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(bx, by, bw, 5);
        ctx.fillStyle = pct <= 0 ? '#ef4f55' : pct < 0.3 ? '#ef4f55' : pct < 0.6 ? '#e9a23b' : '#45c48a';
        ctx.fillRect(bx, by, bw * pct, 5);
      }
      ctx.restore();
    }

    // Fog of war
    if (fog) ctx.drawImage(fog.fog, 0, 0, scene.width_px, scene.height_px);

    // GM overlays: walls, doors, lights
    if (isGM) {
      for (const w of scene.walls) {
        ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2);
        ctx.lineWidth = (w.door ? 6 : 4) / view.z;
        ctx.strokeStyle = w.door ? (w.open ? 'rgba(69,196,138,.9)' : 'rgba(233,180,76,.95)') : 'rgba(90,169,230,.9)';
        if (w.door && w.open) ctx.setLineDash([8 / view.z, 6 / view.z]);
        ctx.stroke(); ctx.setLineDash([]);
      }
      for (const l of scene.lights) {
        ctx.beginPath(); ctx.arc(l.x, l.y, 9 / view.z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcf7a'; ctx.fill();
        ctx.lineWidth = 2 / view.z; ctx.strokeStyle = '#1b0a03'; ctx.stroke();
      }
      for (const z of scene.zones ?? []) {
        if (z.points.length < 2) continue;
        ctx.beginPath();
        z.points.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fillStyle = z.armed ? 'rgba(239,79,85,.14)' : 'rgba(141,145,154,.10)';
        ctx.fill();
        ctx.lineWidth = 2 / view.z; ctx.strokeStyle = z.armed ? 'rgba(239,79,85,.8)' : 'rgba(141,145,154,.6)';
        ctx.setLineDash([10 / view.z, 6 / view.z]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = z.armed ? '#ef4f55' : '#8d919a';
        ctx.font = `600 ${13 / view.z}px Geist, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${z.name}${z.armed ? '' : ' (desactivada)'}`, z.points[0].x + 6 / view.z, z.points[0].y + 6 / view.z);
      }
      if (zoneDraft.length) {
        ctx.beginPath();
        zoneDraft.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        if (hover) ctx.lineTo(hover.x, hover.y);
        ctx.lineWidth = 2 / view.z; ctx.strokeStyle = 'rgba(239,79,85,.9)'; ctx.stroke();
      }
      // NPC routes: dotted path, numbered points; a patrol closes its loop.
      for (const t of tokens) {
        const r = t.route;
        if (!r || r.points.length < 2) continue;
        const pts = t.id === routeToken?.id && editAnchors.length ? editAnchors : r.points;
        ctx.beginPath();
        tracePath(ctx, pts, r.mode === 'loop');
        ctx.lineWidth = 2 / view.z;
        ctx.strokeStyle = t.id === selectedId ? 'rgba(255,255,255,.9)' : t.route_paused ? 'rgba(141,145,154,.7)' : 'rgba(201,162,39,.85)';
        ctx.setLineDash([4 / view.z, 5 / view.z]); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = `600 ${11 / view.z}px Geist, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        pts.forEach((pt, i) => {
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 7 / view.z, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(29,20,5,.85)'; ctx.fill();
          ctx.fillStyle = '#f1d27a'; ctx.fillText(String(i + 1), pt.x, pt.y + 0.5 / view.z);
        });
        if (t.id === routeToken?.id) drawHandles(ctx, pts, view.z);
      }
      if (routePoints.length) {
        ctx.beginPath();
        tracePath(ctx, routePoints, false);
        ctx.lineWidth = 2.5 / view.z; ctx.strokeStyle = 'rgba(241,210,122,.95)'; ctx.stroke();
        drawHandles(ctx, routePoints, view.z);
        if (hover) { // elastic line to the cursor
          const last = routePoints[routePoints.length - 1];
          ctx.beginPath(); ctx.moveTo(last.x, last.y);
          if (last.out) ctx.bezierCurveTo(last.out.x, last.out.y, hover.x, hover.y, hover.x, hover.y); // next leg preview
          else ctx.lineTo(hover.x, hover.y);
          ctx.lineWidth = 1.5 / view.z; ctx.setLineDash([5 / view.z, 4 / view.z]); ctx.stroke(); ctx.setLineDash([]);
        }
        const first = routePoints[0];
        const closing = hover && routePoints.length >= 3 && Math.hypot(hover.x - first.x, hover.y - first.y) <= anchorHit;
        routePoints.forEach((pt, i) => { // anchors as squares; the first one lights up when it would close
          const h = (i === 0 && closing ? 6 : 4) / view.z;
          ctx.fillStyle = i === 0 && closing ? '#ffffff' : '#f1d27a';
          ctx.fillRect(pt.x - h, pt.y - h, h * 2, h * 2);
        });
      }
      if (chain && hover && (tool === 'wall' || tool === 'door')) {
        const h = snapCorner(hover);
        ctx.beginPath(); ctx.moveTo(chain.x, chain.y); ctx.lineTo(h.x, h.y);
        ctx.lineWidth = 3 / view.z; ctx.strokeStyle = tool === 'door' ? 'rgba(233,180,76,.8)' : 'rgba(90,169,230,.8)';
        ctx.setLineDash([6 / view.z, 4 / view.z]); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // Active combat markers (vtt-modes.md §4): visible to explorers too.
    for (const c of combats) {
      // Participants already have the HUD; the marker is for whoever is elsewhere on the map.
      if (!isGM && c.combatants.some((m) => tokens.some((t) => t.id === m.token_id && t.owner_user_id === userId))) continue;
      const R = 18 / view.z;
      const cy = c.center_y - cell * 0.9;
      ctx.beginPath(); ctx.arc(c.center_x, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,79,85,.92)'; ctx.fill();
      ctx.lineWidth = 2 / view.z; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `${R * 1.25}px "Material Symbols Outlined"`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('swords', c.center_x, cy + 1);
    }

    // Ruler
    if (ruler) {
      const ft = gridDistanceFt(ruler.a, ruler.b, cell, scene.feet_per_cell);
      ctx.beginPath(); ctx.moveTo(ruler.a.x, ruler.a.y); ctx.lineTo(ruler.b.x, ruler.b.y);
      ctx.lineWidth = 3 / view.z; ctx.strokeStyle = css('--accent') || '#ff6a3d'; ctx.stroke();
      const label = `${ft} pies`;
      ctx.font = `600 ${14 / view.z}px Geist Mono, monospace`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(12,13,16,.9)';
      ctx.fillRect(ruler.b.x + 10 / view.z, ruler.b.y - 22 / view.z, tw + 14 / view.z, 22 / view.z);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, ruler.b.x + 17 / view.z, ruler.b.y - 11 / view.z);
    }
    ctx.restore();
  }, [scene, visibleTokens, fog, view, size, ghost, ruler, chain, hover, tool, isGM, selectedId, userId, tick, cell, redraw, tokens, objects, combats, zoneDraft, selectedObjectId, activeTokenIds, avatarFor, routeDraft, editGhost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Interaction ----------
  const zoomAt = (factor: number, cx: number, cy: number) => {
    setView((v) => {
      const z = Math.min(4, Math.max(0.15, v.z * factor));
      return { z, x: cx - (cx - v.x) * (z / v.z), y: cy - (cy - v.y) * (z / v.z) };
    });
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    cv.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
      drag.current = null;
      return;
    }
    const p = toScene(e.clientX, e.clientY);
    if (e.button === 1 || e.button === 2) {
      if (e.button === 2) setChain(null);
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      return;
    }
    if (tool === 'ruler') { setRuler({ a: p, b: p }); return; }
    if (isGM && (tool === 'wall' || tool === 'door')) {
      const s = snapCorner(p);
      if (chain) {
        if (s.x !== chain.x || s.y !== chain.y) onWalls([...scene.walls, { x1: chain.x, y1: chain.y, x2: s.x, y2: s.y, door: tool === 'door', open: false }]);
        setChain(tool === 'door' ? null : s);
      } else setChain(s);
      return;
    }
    if (isGM && tool === 'light') { onLights([...scene.lights, { x: p.x, y: p.y, bright: 20, dim: 20 }]); return; }
    if (isGM && tool === 'zone') { setZoneDraft((d) => [...d, snapCorner(p)]); return; }
    if (isGM && tool === 'object') { onPlaceObject?.(p.x, p.y); return; }
    if (isGM && tool === 'npc') { onPlaceNpc?.(p.x, p.y); return; }
    if (isGM && routeToken) {
      // Editing the saved route (no path being drawn), like Photoshop's pen with auto add/delete (D-0070).
      // Handles first (they can sit over other anchors), then anchors, then the path itself.
      for (let i = 0; i < editAnchors.length; i++) {
        for (const which of ['out', 'in'] as const) {
          const h = editAnchors[i][which];
          if (h && Math.hypot(h.x - p.x, h.y - p.y) <= anchorHit) { drag.current = { kind: 'handle', token: routeToken, index: i, which, alt: e.altKey }; return; }
        }
      }
      const hit = editAnchors.findIndex((a) => Math.hypot(a.x - p.x, a.y - p.y) <= anchorHit);
      if (hit >= 0) {
        const pt = editAnchors[hit];
        if (e.altKey && (pt.in || pt.out)) { // Alt+click on a smooth anchor: corner
          onRouteEdit?.(original(routeToken), editAnchors.map((x, i) => (i === hit ? toCorner(x) : x)));
          return;
        }
        drag.current = { kind: e.altKey ? 'convert' : 'anchor', token: routeToken, index: hit, sx: e.clientX, sy: e.clientY };
        return;
      }
      const route = routeToken.route;
      if (route && editAnchors.length && editAnchors.length < 32) {
        const near = nearestOnPath(editAnchors, route.mode === 'loop', p);
        if (near && near.dist <= anchorHit) { // click on the path: add an anchor without changing the shape
          onRouteEdit?.(original(routeToken), splitLeg(editAnchors, near.leg, near.t));
          return;
        }
      }
      const first = routePoints[0];
      if (first && Math.hypot(first.x - p.x, first.y - p.y) <= anchorHit) {
        // Closing needs 3 anchors and happens on release, so a drag can shape the closing leg.
        if (routePoints.length >= 3) drag.current = { kind: 'close', sx: e.clientX, sy: e.clientY };
        return; // a click on P0 never adds a point
      }
      const last = routePoints[routePoints.length - 1];
      const a = pixel(e.shiftKey && last ? constrain45(last, p) : p);
      if (a.x < 0 || a.y < 0 || a.x > scene.width_px || a.y > scene.height_px) return; // anchors live on the map
      if (!last || a.x !== last.x || a.y !== last.y) {
        setRouteDraft({ tokenId: routeToken.id, points: [...routePoints, a] });
        drag.current = { kind: 'pen', index: routePoints.length, sx: e.clientX, sy: e.clientY }; // dragging pulls out handles
      }
      return;
    }
    if (isGM && tool === 'erase') {
      const tol = 10 / view.z;
      const li = scene.lights.findIndex((l) => Math.hypot(l.x - p.x, l.y - p.y) < tol + 4);
      if (li >= 0) { onLights(scene.lights.filter((_, i) => i !== li)); return; }
      const wi = scene.walls.findIndex((w) => distToSegment(p, w) < tol);
      if (wi >= 0) { onWalls(scene.walls.filter((_, i) => i !== wi)); return; }
      const zi = (scene.zones ?? []).findIndex((z) => inPolygon(p, z.points));
      if (zi >= 0) onZones?.(scene.zones.filter((_, i) => i !== zi));
      return;
    }
    const obj = objects.find((o) => Math.hypot(o.x - p.x, o.y - p.y) <= cell * 0.35 && (isGM || !fog || fog.isVisible(o.x, o.y)));
    if (obj && onSelectObject) { onSelectObject(obj.id); return; }
    const t = tokenAt(p);
    if (t) {
      onSelect(t.id);
      if (canMove(t)) drag.current = { kind: 'token', token: t, ox: p.x - t.x, oy: p.y - t.y };
      return;
    }
    if (isGM) {
      const door = scene.walls.findIndex((w) => w.door && distToSegment(p, w) < 10 / view.z);
      if (door >= 0) { onWalls(scene.walls.map((w, i) => (i === door ? { ...w, open: !w.open } : w))); return; }
    }
    onSelect(null);
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = canvasRef.current!.getBoundingClientRect();
      const factor = (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d) * pinch.current.z / view.z;
      zoomAt(factor, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    const p = toScene(e.clientX, e.clientY);
    setHover(p);
    const d = drag.current;
    if (ruler && e.buttons) setRuler((r) => (r ? { a: r.a, b: p } : r));
    if (!d) return;
    if (d.kind === 'pan') setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
    else if (d.kind === 'pen' || d.kind === 'close') {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return; // a still click stays a corner
      const index = d.kind === 'pen' ? d.index : 0;
      setRouteDraft((dr) => dr && { ...dr, points: dr.points.map((pt, i) => {
        if (i !== index) return pt;
        const out = pixel(e.shiftKey ? constrain45(pt, p) : p);
        return { ...pt, out, in: e.altKey && pt.in ? pt.in : mirrorHandle(pt, out) }; // Alt: only the out handle
      }) });
    } else if (d.kind === 'anchor' || d.kind === 'handle' || d.kind === 'convert') {
      if (d.kind !== 'handle' && !editGhost && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return; // still a click
      const base = editGhost ?? d.token.route?.points ?? [];
      setEditGhost(base.map((pt, i) => {
        if (i !== d.index) return pt;
        const q = pixel(e.shiftKey && d.kind !== 'anchor' ? constrain45(pt, p) : p);
        if (d.kind === 'convert') return { ...pt, out: q, in: mirrorHandle(pt, q) }; // Alt+drag: corner → smooth
        if (d.kind === 'anchor') {
          const dx = q.x - pt.x, dy = q.y - pt.y;
          const shift = (h?: Pt) => (h ? { x: h.x + dx, y: h.y + dy } : undefined);
          const moved: RoutePoint = { ...pt, x: q.x, y: q.y };
          if (pt.in) moved.in = shift(pt.in);
          if (pt.out) moved.out = shift(pt.out);
          return moved;
        }
        const other = d.which === 'out' ? 'in' : 'out';
        const next: RoutePoint = { ...pt, [d.which]: q };
        if (!d.alt && !e.altKey && pt[other]) next[other] = mirrorHandle(pt, q); // smooth anchor: the opposite handle follows
        return next;
      }));
    }
    else setGhost({ id: d.token.id, x: p.x - d.ox, y: p.y - d.oy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (tool === 'ruler') { setTimeout(() => setRuler(null), 1200); return; }
    if (d?.kind === 'pen') return;
    if (d?.kind === 'close') {
      if (routeToken && routePoints.length >= 3) onRoute?.(original(routeToken), routePoints, true);
      setRouteDraft(null);
      return;
    }
    if (d?.kind === 'anchor' && !editGhost) { // a click (no drag) on an anchor
      const route = d.token.route;
      if (!route) return;
      const pts = route.points, open = route.mode !== 'loop';
      if (open && (d.index === pts.length - 1 || d.index === 0)) { // an end: continue the path from it
        setRouteDraft({ tokenId: d.token.id, points: d.index === 0 ? reversePath(pts) : [...pts] });
        return;
      }
      if (pts.length > (open ? 2 : 3)) onRouteEdit?.(original(d.token), pts.filter((_, i) => i !== d.index)); // delete it
      return;
    }
    if (d?.kind === 'anchor' || d?.kind === 'handle' || d?.kind === 'convert') {
      if (editGhost) onRouteEdit?.(original(d.token), editGhost);
      setEditGhost(null);
      return;
    }
    if (d?.kind === 'token' && ghost) {
      const moved = Math.hypot(ghost.x - d.token.x, ghost.y - d.token.y) > cell * 0.25;
      if (moved) onMove(d.token, ghost.x, ghost.y);
      setGhost(null);
    }
  };

  const cursor = tool === 'select' ? (ghost ? 'grabbing' : 'default') : tool === 'erase' ? 'not-allowed' : 'crosshair';

  return (
    <div ref={wrapRef} className="relative h-full w-full touch-none select-none overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          setChain(null);
          if (zoneDraft.length >= 3 && onZones) {
            onZones([...(scene.zones ?? []), { id: `z${Date.now().toString(36)}`, name: `Zona ${(scene.zones?.length ?? 0) + 1}`, points: zoneDraft, monster_ids: [], armed: true }]);
          }
          setZoneDraft([]);
          if (routePoints.length) finishOpen();
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setChain(null); setRouteDraft(null); }
          if (routePoints.length && e.key === 'Enter') { e.preventDefault(); finishOpen(); }
          if (routePoints.length && e.key === 'Backspace') { e.preventDefault(); setRouteDraft(routeToken ? { tokenId: routeToken.id, points: routePoints.slice(0, -1) } : null); }
        }}
        tabIndex={0}
        aria-label={`Mesa virtual: ${scene.name}`}
      />
      <div className="absolute bottom-3 right-3 flex overflow-hidden rounded-lg border border-line-strong bg-card shadow-[var(--shadow-2)]">
        <button type="button" className="grid h-9 w-9 place-items-center text-ink-2 hover:bg-card-2" aria-label="Acercar" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)}><span className="material-symbols-outlined text-[20px]">add</span></button>
        <button type="button" className="grid h-9 w-9 place-items-center border-x border-line text-ink-2 hover:bg-card-2" aria-label="Alejar" onClick={() => zoomAt(0.8, size.w / 2, size.h / 2)}><span className="material-symbols-outlined text-[20px]">remove</span></button>
        <button type="button" className="grid h-9 w-9 place-items-center text-ink-2 hover:bg-card-2" aria-label="Encajar la escena" onClick={() => { fitted.current = null; setSize((s) => ({ ...s })); }}><span className="material-symbols-outlined text-[20px]">fit_screen</span></button>
        <span className="grid min-w-14 place-items-center border-l border-line px-2 font-mono text-xs">{Math.round(view.z * 100)}%</span>
      </div>
    </div>
  );
}
