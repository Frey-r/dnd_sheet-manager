/* NPC routines on the map — openspec/specs/vtt-npc-routines.md §6.
 * RoutinePanel: route mode, waits, pause/resume/restart/remove and disposition of the selected token.
 * PlaceNpcList: the campaign NPCs the GM can place on the scene. */
import { useState, type ReactNode } from 'react';
import type { Disposition, VTTToken } from '../../services/vttApi';
import type { Route, RouteMode, RoutePoint } from '../../lib/vtt/routePosition';

const MODES: [RouteMode, string][] = [['once', 'Ida'], ['pingpong', 'Ida y vuelta'], ['loop', 'Patrulla']];
const DISPOSITIONS: [Disposition, string][] = [['hostile', 'Hostil'], ['neutral', 'Neutral'], ['friendly', 'Amistoso']];
const RELATION: Record<string, string> = { enemy: 'Enemigo', neutral: 'Neutral', ally: 'Aliado' };

export type RouteAction = 'pause' | 'resume' | 'restart';

interface RoutineProps {
  token: VTTToken;
  onSetRoute: (route: Route | null) => void;
  onAction: (action: RouteAction) => void;
  onDisposition: (d: Disposition) => void;
  onStartDrawing: () => void;
  /** Campaign NPC actions (agenda, inventory, loot), shown under the routine. */
  extra?: ReactNode;
}

/** Wait (s) shared by every point, committed on blur/Enter so typing does not save each keystroke. */
function WaitInput({ route, onSetRoute }: { route: Route; onSetRoute: (r: Route) => void }) {
  const current = route.points[0]?.wait_s ?? 0;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Math.max(0, Math.min(600, Number(draft) || 0));
    setDraft(null);
    if (route.points.some((p) => (p.wait_s ?? 0) !== v)) onSetRoute({ ...route, points: route.points.map((p) => ({ ...p, wait_s: v })) });
  };
  return (
    <label className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink-2">
      Espera en cada punto (s)
      <input type="number" min={0} max={600} className="h-8 w-20 px-2 text-[13px]" value={draft ?? String(current)}
        onFocus={() => setDraft(String(current))} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </label>
  );
}

export function RoutinePanel({ token, onSetRoute, onAction, onDisposition, onStartDrawing, extra }: RoutineProps) {
  if (token.kind === 'pc') return null;
  const route = token.route ?? null;
  const status = !route ? 'Quieto' : token.route_paused ? 'Pausado' : token.route_clock?.running ? 'En ruta' : 'Detenido';
  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-2.5">
      <div className="flex items-center justify-between">
        <span className="mc-eyebrow">Rutina</span>
        <span className="mc-badge">{status}</span>
      </div>
      {!route ? (
        <>
          <p className="text-xs text-muted">Sin ruta, la ficha se queda en su sitio. Traza una línea o una patrulla sobre el mapa.</p>
          <button type="button" className="mc-btn mc-btn-sm self-start" onClick={onStartDrawing}>
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">route</span>Trazar ruta</button>
        </>
      ) : (
        <>
          <div className="mc-seg" role="group" aria-label="Modo de la ruta">
            {MODES.map(([m, label]) => (
              <button key={m} type="button" className="flex-1 justify-center" aria-pressed={route.mode === m}
                onClick={() => { if (route.mode !== m) onSetRoute({ mode: m, points: route.points }); }}>{label}</button>
            ))}
          </div>
          <WaitInput route={route} onSetRoute={onSetRoute} />
          <p className="text-xs text-muted">{route.points.length} puntos · camina a {token.speed_ft} pies por asalto al ritmo de la escena.</p>
          <div className="flex flex-wrap gap-1.5">
            {token.route_paused
              ? <button type="button" className="mc-btn mc-btn-sm" onClick={() => onAction('resume')}><span aria-hidden="true" className="material-symbols-outlined text-[16px]">play_arrow</span>Reanudar</button>
              : <button type="button" className="mc-btn mc-btn-sm" onClick={() => onAction('pause')}><span aria-hidden="true" className="material-symbols-outlined text-[16px]">pause</span>Pausar</button>}
            <button type="button" className="mc-btn mc-btn-sm" onClick={() => onAction('restart')}><span aria-hidden="true" className="material-symbols-outlined text-[16px]">restart_alt</span>Reiniciar</button>
            <button type="button" className="mc-btn mc-btn-sm" onClick={onStartDrawing}><span aria-hidden="true" className="material-symbols-outlined text-[16px]">route</span>Redibujar</button>
            <button type="button" className="mc-btn mc-btn-sm mc-btn-danger" onClick={() => onSetRoute(null)}>Quitar ruta</button>
          </div>
        </>
      )}
      {token.npc_id ? (
        <p className="text-xs text-muted">Relación con el grupo: <b className="text-ink-2">{RELATION[token.npc_status ?? 'neutral'] ?? 'Neutral'}</b> (se cambia en la ficha del PNJ; solo los enemigos inician encuentros al verte).</p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-medium text-ink-2">Disposición</span>
          <div className="mc-seg" role="group" aria-label="Disposición">
            {DISPOSITIONS.map(([d, label]) => (
              <button key={d} type="button" className="flex-1 justify-center" aria-pressed={(token.disposition ?? (token.kind === 'monster' ? 'hostile' : 'neutral')) === d}
                onClick={() => onDisposition(d)}>{label}</button>
            ))}
          </div>
        </div>
      )}
      {extra}
    </div>
  );
}

export interface PlaceableNpc { id: number; name: string; status?: string; role?: string }

export function PlaceNpcList({ npcs, placedIds, onPick }: { npcs: PlaceableNpc[]; placedIds: Set<number>; onPick: (npc: PlaceableNpc) => void }) {
  const [q, setQ] = useState('');
  if (!npcs.length) return <p className="text-xs text-muted">La campaña no tiene PNJ todavía: créalos en la sección PNJ.</p>;
  const shown = npcs.filter((n) => !q.trim() || n.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-1.5">
      <input className="h-9 w-full px-2.5 text-[13.5px]" placeholder="Buscar PNJ…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-48 overflow-y-auto rounded-md border border-line">
        {shown.map((n) => (
          <button key={n.id} type="button" aria-label={`Colocar ${n.name}`} onClick={() => onPick(n)}
            className="flex w-full items-center gap-2 border-b border-line px-2.5 py-2 text-left text-[13px] last:border-b-0 hover:bg-card-2">
            <span className="grow truncate">{n.name}</span>
            {placedIds.has(n.id) && <span className="text-xs text-muted">en la escena</span>}
            <span className="mc-badge">{RELATION[n.status ?? 'neutral'] ?? 'Neutral'}</span>
          </button>
        ))}
        {!shown.length && <p className="px-2.5 py-2 text-xs text-muted">Sin resultados.</p>}
      </div>
    </div>
  );
}

/** Shown when the pen finishes a path: an open path is Ida or Ida y vuelta, a closed one is a cycle (D-0068). */
export function RouteFinishDialog({ tokenName, points, closed, onConfirm, onCancel }: {
  tokenName: string; points: RoutePoint[]; closed: boolean; onConfirm: (route: Route) => void; onCancel: () => void;
}) {
  const [wait, setWait] = useState('0');
  const confirm = (mode: RouteMode) => {
    const w = Math.max(0, Math.min(600, Number(wait) || 0));
    onConfirm({ mode, points: w ? points.map((p) => ({ ...p, wait_s: w })) : points });
  };
  const options: [RouteMode, string, string][] = closed
    ? [['loop', 'Ciclo', 'Recorre el circuito una y otra vez.']]
    : [['once', 'Ida', 'Va hasta el final y se queda allí.'], ['pingpong', 'Ida y vuelta', 'Va y vuelve por el mismo camino, sin parar.']];
  return (
    <div role="dialog" aria-modal="true" aria-label={`Ruta de ${tokenName}`} className="mc-card flex w-72 flex-col gap-3 p-4 shadow-[var(--shadow-3)]">
      <div><span className="mc-eyebrow">Ruta de {tokenName}</span>
        <p className="mt-0.5 text-xs text-muted">{closed ? 'Trazado cerrado' : 'Trazado abierto'} · {points.length} puntos</p></div>
      <label className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink-2">
        Espera en cada punto (s)
        <input type="number" min={0} max={600} className="h-8 w-20 px-2 text-[13px]" value={wait} onChange={(e) => setWait(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1.5">
        {options.map(([mode, label, hint]) => (
          <button key={mode} type="button" aria-label={label} className="mc-btn flex-col !items-start !gap-0 !py-2 text-left" onClick={() => confirm(mode)}>
            <b>{label}</b><small className="text-xs text-muted">{hint}</small>
          </button>
        ))}
      </div>
      <button type="button" className="mc-btn mc-btn-sm self-end" onClick={onCancel}>Cancelar</button>
    </div>
  );
}
