/* Exploration & combat UI for the native VTT (openspec/specs/vtt-modes.md). */
import { useEffect, useRef, useState } from 'react';
import type { Milestone, VTTCombat, VTTObject, VTTToken, Zone, LootEntry } from '../../services/vttApi';

const inputCls = 'h-9 w-full px-2.5 text-[13.5px]';

/** Virtual joystick for touch devices. */
export function Joystick({ onChange }: { onChange: (v: { x: number; y: number }) => void }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    setKnob({ x, y });
    onChange({ x, y });
  };
  const stop = () => { setKnob({ x: 0, y: 0 }); onChange({ x: 0, y: 0 }); };
  return (
    <div ref={base} aria-label="Joystick de movimiento" className="relative h-28 w-28 touch-none rounded-full border border-line-strong bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] shadow-[var(--shadow-2)] backdrop-blur"
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (e.buttons) move(e); }} onPointerUp={stop} onPointerCancel={stop}>
      <span className="absolute h-12 w-12 rounded-full bg-accent shadow-[0_6px_18px_-6px_var(--accent-line)]"
        style={{ left: `calc(50% - 24px + ${knob.x * 32}px)`, top: `calc(50% - 24px + ${knob.y * 32}px)` }} />
    </div>
  );
}

/** Turn order + countdown for a combat the viewer takes part in (or the GM). */
export function CombatHud({ combat, tokens, userId, isGM, onAction }: {
  combat: VTTCombat; tokens: VTTToken[]; userId: number; isGM: boolean;
  onAction: (a: 'next' | 'end' | 'pause' | 'extend' | 'dash') => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [loadedAt] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  const cur = combat.combatants[combat.turn_index];
  const curToken = tokens.find((t) => t.id === cur?.token_id);
  const mine = curToken?.owner_user_id === userId;
  const left = combat.paused ? combat.remaining_ms : Math.max(0, combat.remaining_ms - (now - loadedAt));
  const secs = Math.ceil(left / 1000);
  const speed = curToken?.speed_ft ?? 30;
  const budget = cur?.dashed ? speed * 2 : speed;
  return (
    <div className="mc-card w-[min(420px,calc(100vw-24px))] overflow-hidden !rounded-2xl shadow-[var(--shadow-3)]">
      <div className={`flex items-center gap-3 px-4 py-2.5 ${mine ? 'bg-accent text-accent-ink' : 'border-b border-line'}`}>
        <span className="material-symbols-outlined">swords</span>
        <div className="min-w-0 grow">
          <b className="block truncate text-[14px]">{mine ? '¡Es tu turno!' : `Turno de ${cur?.name ?? '—'}`}</b>
          <small className={mine ? 'opacity-80' : 'text-muted'}>Ronda {combat.round}{cur?.is_player ? ` · movimiento ${Math.max(0, budget - (cur?.movement_used_ft ?? 0))}/${budget} pies` : ' · sin reloj'}</small>
        </div>
        {cur?.is_player && <span className={`font-mono text-2xl font-semibold ${!mine && secs <= 10 ? 'text-bad' : ''}`}>{combat.paused ? '⏸' : `${secs}s`}</span>}
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
        {combat.combatants.map((c, i) => (
          <span key={c.id} className={`flex-none rounded-md border px-2 py-1 text-xs ${i === combat.turn_index ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2'}`}>
            <b className="font-mono">{c.initiative}</b> {c.name}
          </span>
        ))}
      </div>
      {(mine || isGM) && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
          {mine && <button type="button" className="mc-btn mc-btn-sm" onClick={() => onAction('dash')} disabled={cur?.dashed}>Correr</button>}
          <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" onClick={() => onAction('next')}>{mine ? 'Terminar turno' : 'Siguiente turno'}</button>
          {isGM && <>
            <button type="button" className="mc-btn mc-btn-sm" onClick={() => onAction('pause')}>{combat.paused ? 'Reanudar' : 'Pausar'}</button>
            <button type="button" className="mc-btn mc-btn-sm" onClick={() => onAction('extend')}>+15 s</button>
            <button type="button" className="mc-btn mc-btn-sm mc-btn-danger ml-auto" onClick={() => onAction('end')}>Terminar combate</button>
          </>}
        </div>
      )}
    </div>
  );
}

/** GM: milestones list. */
export function MilestonesPanel({ milestones, onCreate, onToggle }: { milestones: Milestone[]; onCreate: (name: string) => void; onToggle: (m: Milestone) => void }) {
  const [name, setName] = useState('');
  return (
    <div>
      <span className="mc-eyebrow">Hitos de la campaña</span>
      <div className="mt-1.5 flex flex-col gap-1">
        {milestones.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={m.achieved} onChange={() => onToggle({ ...m, achieved: !m.achieved })} />{m.name}</label>
        ))}
      </div>
      <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onCreate(name.trim()); setName(''); } }}>
        <input className={inputCls} placeholder="Nuevo hito…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="mc-btn mc-btn-sm">Añadir</button>
      </form>
    </div>
  );
}

/** GM: zones list with armed toggle and linked monsters. */
export function ZonesPanel({ zones, tokens, onChange }: { zones: Zone[]; tokens: VTTToken[]; onChange: (z: Zone[]) => void }) {
  const monsters = tokens.filter((t) => t.kind !== 'pc');
  return (
    <div>
      <span className="mc-eyebrow">Zonas de encuentro</span>
      <p className="mt-1 text-xs text-muted">Herramienta «Zona»: clic para cada vértice, doble clic para cerrar. Borrar: herramienta goma dentro de la zona.</p>
      {zones.map((z, i) => (
        <div key={z.id} className="mt-2 rounded-md border border-line p-2">
          <div className="flex items-center gap-2">
            <input className={`${inputCls} !h-8`} value={z.name} onChange={(e) => onChange(zones.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={z.armed} onChange={() => onChange(zones.map((x, j) => (j === i ? { ...x, armed: !x.armed } : x)))} />Activa</label>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {monsters.map((m) => {
              const on = z.monster_ids.includes(m.id);
              return <button key={m.id} type="button" onClick={() => onChange(zones.map((x, j) => (j === i ? { ...x, monster_ids: on ? x.monster_ids.filter((id) => id !== m.id) : [...x.monster_ids, m.id] } : x)))}
                className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-bad bg-bad-soft text-bad' : 'border-line text-muted'}`}>{m.name}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const SKILLS = ['Percepción', 'Investigación', 'Supervivencia', 'Naturaleza', 'Atletismo', 'Juego de manos', 'Arcanos', 'Religión', 'Historia', 'Medicina'];
const ICONS = [['inventory_2', 'Cofre'], ['eco', 'Hierba'], ['diamond', 'Gema'], ['menu_book', 'Libro'], ['key', 'Llave'], ['skull', 'Restos'], ['local_florist', 'Flor'], ['savings', 'Bolsa']];

/** GM: editor of the selected interactive object. */
export function ObjectEditor({ obj, milestones, onSave, onDelete, onReset }: {
  obj: VTTObject; milestones: Milestone[]; onSave: (o: Partial<VTTObject>) => void; onDelete: () => void; onReset: () => void;
}) {
  const req = obj.requirements ?? {};
  const loot = obj.loot ?? {};
  const rows: LootEntry[] = obj.loot_kind === 'table' ? (loot.entries ?? []) : (loot.items ?? []);
  const setRows = (r: LootEntry[]) => onSave({ loot: obj.loot_kind === 'table' ? { entries: r } : { ...loot, items: r } });
  const conds = req.conditions ?? [];
  return (
    <div className="mc-card flex flex-col gap-2.5 p-3">
      <div className="flex items-center gap-2"><b className="grow truncate">{obj.name}</b>
        <button type="button" className="mc-btn mc-btn-sm" onClick={onReset} title="Borrar intentos y reponer">Reponer</button>
        <button type="button" className="mc-btn mc-btn-sm mc-btn-danger" onClick={onDelete} aria-label="Eliminar objeto"><span className="material-symbols-outlined text-[16px]">delete</span></button></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12.5px]">Nombre<input className={inputCls} defaultValue={obj.name} onBlur={(e) => onSave({ name: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-[12.5px]">Icono<select className={inputCls} value={obj.icon} onChange={(e) => onSave({ icon: e.target.value })}>{ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-[12.5px]">Oculto: CD por Percepción pasiva (0 = visible)<input type="number" min={0} max={40} className={inputCls} defaultValue={obj.discover_dc ?? 0} onBlur={(e) => onSave({ discover_dc: Number(e.target.value) })} /></label>
        <label className="flex items-center gap-2 pt-5 text-[12.5px]"><input type="checkbox" checked={!!obj.per_character} onChange={(e) => onSave({ per_character: e.target.checked })} />Cada personaje puede llevarse</label>
      </div>
      <span className="mc-eyebrow">Requisitos</span>
      {milestones.length > 0 && <div className="flex flex-wrap gap-1">{milestones.map((m) => {
        const on = (req.milestones ?? []).includes(m.id);
        return <button key={m.id} type="button" onClick={() => onSave({ requirements: { ...req, milestones: on ? (req.milestones ?? []).filter((id) => id !== m.id) : [...(req.milestones ?? []), m.id] } })}
          className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-gold bg-gold-soft text-gold' : 'border-line text-muted'}`}>{m.name}</button>;
      })}</div>}
      <div className="grid grid-cols-[1fr_70px_60px] gap-1.5">
        <select className={inputCls} value={req.check?.skill ?? ''} onChange={(e) => onSave({ requirements: { ...req, check: e.target.value ? { skill: e.target.value, dc: req.check?.dc || 10, bonus: req.check?.bonus ?? 0 } : null } })}>
          <option value="">Sin prueba visible</option>{SKILLS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <input type="number" className={inputCls} title="CD" placeholder="CD" disabled={!req.check} defaultValue={req.check?.dc ?? 10} onBlur={(e) => req.check && onSave({ requirements: { ...req, check: { ...req.check, dc: Number(e.target.value) } } })} />
        <input type="number" className={inputCls} title="Bonificador extra" placeholder="+" disabled={!req.check} defaultValue={req.check?.bonus ?? 0} onBlur={(e) => req.check && onSave({ requirements: { ...req, check: { ...req.check, bonus: Number(e.target.value) } } })} />
      </div>
      {conds.map((c, i) => (
        <div key={i} className="grid grid-cols-[110px_1fr_28px] gap-1.5">
          <select className={inputCls} value={c.type} onChange={(e) => onSave({ requirements: { ...req, conditions: conds.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof c.type } : x)) } })}>
            <option value="class">Clase</option><option value="race">Raza</option><option value="has_item">Lleva objeto</option><option value="passive">Pasiva ≥</option>
          </select>
          <input className={inputCls} defaultValue={c.type === 'passive' ? String(c.min ?? 10) : c.value ?? ''} onBlur={(e) => onSave({ requirements: { ...req, conditions: conds.map((x, j) => (j === i ? (c.type === 'passive' ? { ...x, min: Number(e.target.value) } : { ...x, value: e.target.value }) : x)) } })} />
          <button type="button" className="mc-btn mc-btn-sm mc-btn-icon" onClick={() => onSave({ requirements: { ...req, conditions: conds.filter((_, j) => j !== i) } })} aria-label="Quitar condición">×</button>
        </div>
      ))}
      <button type="button" className="mc-btn mc-btn-sm self-start" onClick={() => onSave({ requirements: { ...req, conditions: [...conds, { type: 'class', value: '' }] } })}>+ Condición silenciosa</button>
      <div className="flex items-center gap-2"><span className="mc-eyebrow grow">Botín</span>
        <div className="mc-seg"><button type="button" aria-pressed={obj.loot_kind !== 'table'} onClick={() => onSave({ loot_kind: 'fixed', loot: { items: [] } })}>Fijo</button><button type="button" aria-pressed={obj.loot_kind === 'table'} onClick={() => onSave({ loot_kind: 'table', loot: { entries: [] } })}>Tabla</button></div></div>
      {obj.loot_kind !== 'table' && <label className="flex items-center gap-2 text-[12.5px]">Oro<input type="number" className={`${inputCls} !w-24`} defaultValue={loot.gold ?? 0} onBlur={(e) => onSave({ loot: { ...loot, gold: Number(e.target.value) } })} /></label>}
      {rows.map((r, i) => (
        <div key={i} className={`grid gap-1.5 ${obj.loot_kind === 'table' ? 'grid-cols-[1fr_50px_56px_50px_28px]' : 'grid-cols-[1fr_56px_28px]'}`}>
          <input className={inputCls} placeholder="Objeto" defaultValue={r.name ?? ''} onBlur={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input type="number" className={inputCls} title="Cantidad" defaultValue={r.qty ?? 1} onBlur={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
          {obj.loot_kind === 'table' && <>
            <input type="number" className={inputCls} title="Oro" placeholder="po" defaultValue={r.gold ?? 0} onBlur={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, gold: Number(e.target.value) } : x)))} />
            <input type="number" className={inputCls} title="Peso en la tabla" defaultValue={r.weight ?? 1} onBlur={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} />
          </>}
          <button type="button" className="mc-btn mc-btn-sm mc-btn-icon" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Quitar fila">×</button>
        </div>
      ))}
      <button type="button" className="mc-btn mc-btn-sm self-start" onClick={() => setRows([...rows, { name: '', qty: 1, weight: 1 }])}>+ {obj.loot_kind === 'table' ? 'Fila de tabla (objeto, cant., po, peso)' : 'Objeto'}</button>
    </div>
  );
}
