/* NPC agenda editor (npc-agenda.md §5): a table with a form per entry and an editable JSON view. Routes are
   drawn on the map with the pen and saved here with «Guardar en la agenda»; the form keeps them when editing. */
import { useState } from 'react';
import { dayLabel, describeEntry, MOMENTS, momentLabel, problemsOf, sortAgenda, WEEKDAYS, type AgendaEntry, type DaySpec, type SceneRef, type TimeOfDay } from '../../lib/npc/agenda';

type DayKind = 'numero' | 'todos' | 'laborables' | 'fin_de_semana' | 'semana';
interface Draft { index: number | null; kind: DayKind; day: string; weekday: string; momento: TimeOfDay; scene: string; x: string; y: string; oculto: boolean; nota: string; entry: AgendaEntry | null }

const kindOf = (d: DaySpec): DayKind => (typeof d === 'number' ? 'numero' : WEEKDAYS.includes(d) ? 'semana' : (d as DayKind));
const fieldCls = 'h-9 w-full px-2.5 text-[13.5px]';

function toDraft(e: AgendaEntry | null, index: number | null): Draft {
  return {
    index, entry: e, kind: e ? kindOf(e.dia) : 'todos', day: typeof e?.dia === 'number' ? String(e.dia) : '1',
    weekday: e && typeof e.dia === 'string' && WEEKDAYS.includes(e.dia) ? e.dia : 'lunes', momento: e?.momento ?? 'dia',
    scene: e ? (e.ubicacion ? String(e.ubicacion.escena_id) : 'ausente') : 'ausente',
    x: String(e?.posicion?.x ?? 0), y: String(e?.posicion?.y ?? 0), oculto: Boolean(e?.oculto), nota: e?.nota ?? '',
  };
}

function fromDraft(d: Draft): AgendaEntry {
  const dia: DaySpec = d.kind === 'numero' ? Math.max(1, Math.floor(Number(d.day) || 1)) : d.kind === 'semana' ? d.weekday : d.kind;
  const out: AgendaEntry = { dia, momento: d.momento, ubicacion: null };
  if (d.scene !== 'ausente') {
    out.ubicacion = { escena_id: Number(d.scene) };
    const path = d.entry?.ubicacion?.escena_id === Number(d.scene) ? d.entry?.path ?? null : null; // a route belongs to its scene
    if (!path) out.posicion = { x: Number(d.x) || 0, y: Number(d.y) || 0 };
    out.path = path;
    if (d.oculto) out.oculto = true;
  }
  if (d.nota.trim()) out.nota = d.nota.trim();
  return out;
}

export function AgendaEditor({ agenda, scenes, onSave }: { agenda: AgendaEntry[]; scenes: SceneRef[]; onSave: (agenda: AgendaEntry[]) => Promise<void> }) {
  const [tab, setTab] = useState<'tabla' | 'json'>('tabla');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [json, setJson] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const rows = sortAgenda(agenda);

  const save = async (next: AgendaEntry[]) => {
    setProblems([]);
    try {
      await onSave(next);
      setDraft(null);
      setJson(null);
    } catch (err) {
      setProblems(problemsOf(err));
    }
  };
  const saveDraft = (d: Draft) => {
    const entry = fromDraft(d);
    const original = d.index === null ? null : rows[d.index];
    void save(original ? agenda.map((e) => (e === original ? entry : e)) : [...agenda, entry]);
  };
  const saveJson = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json ?? JSON.stringify(agenda, null, 2));
    } catch (err) {
      setProblems([`JSON no válido: ${(err as Error).message}`]);
      return;
    }
    if (!Array.isArray(parsed)) { setProblems(['JSON no válido: la agenda es una lista [ … ] de entradas']); return; }
    void save(parsed as AgendaEntry[]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="mc-seg w-fit">
        <button type="button" role="tab" aria-selected={tab === 'tabla'} aria-pressed={tab === 'tabla'} onClick={() => setTab('tabla')}>Tabla</button>
        <button type="button" role="tab" aria-selected={tab === 'json'} aria-pressed={tab === 'json'} onClick={() => setTab('json')}>JSON</button>
      </div>
      {problems.length > 0 && (
        <div role="alert" className="rounded-md border border-bad px-3 py-2 text-[13px] text-bad">
          <ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {tab === 'tabla' ? (
        <>
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted"><tr><th className="py-1">Día</th><th>Momento</th><th>Dónde</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={`${e.dia}|${e.momento}`} className="border-t border-line">
                  <td className="py-1.5">{dayLabel(e.dia)}</td>
                  <td>{momentLabel(e.momento)}</td>
                  <td>{describeEntry(e, scenes)}{e.nota && <small className="block text-xs text-muted">{e.nota}</small>}</td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" aria-label={`Editar entrada ${i + 1}`} className="mc-btn mc-btn-sm" onClick={() => setDraft(toDraft(e, i))}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">edit</span></button>
                    <button type="button" aria-label={`Borrar entrada ${i + 1}`} className="mc-btn mc-btn-sm mc-btn-danger ml-1" onClick={() => void save(agenda.filter((x) => x !== e))}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span></button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="py-2 text-muted">Sin entradas: el PNJ se queda donde lo dejes.</td></tr>}
            </tbody>
          </table>
          {draft ? (
            <form className="grid grid-cols-2 gap-2 rounded-md border border-line p-3" onSubmit={(ev) => { ev.preventDefault(); saveDraft(draft); }}>
              <label className="flex flex-col gap-1 text-[12.5px]">Tipo de día
                <select className={fieldCls} value={draft.kind} onChange={(ev) => setDraft({ ...draft, kind: ev.target.value as DayKind })}>
                  <option value="numero">Un día concreto</option><option value="todos">Todos los días</option><option value="laborables">Laborables</option>
                  <option value="fin_de_semana">Fin de semana</option><option value="semana">Un día de la semana</option>
                </select></label>
              {draft.kind === 'numero' && <label className="flex flex-col gap-1 text-[12.5px]">Día de juego<input type="number" min={1} className={fieldCls} value={draft.day} onChange={(ev) => setDraft({ ...draft, day: ev.target.value })} /></label>}
              {draft.kind === 'semana' && <label className="flex flex-col gap-1 text-[12.5px]">Día de la semana
                <select className={fieldCls} value={draft.weekday} onChange={(ev) => setDraft({ ...draft, weekday: ev.target.value })}>{WEEKDAYS.map((w) => <option key={w} value={w}>{dayLabel(w)}</option>)}</select></label>}
              <label className="flex flex-col gap-1 text-[12.5px]">Momento
                <select className={fieldCls} value={draft.momento} onChange={(ev) => setDraft({ ...draft, momento: ev.target.value as TimeOfDay })}>{MOMENTS.map((m) => <option key={m} value={m}>{momentLabel(m)}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-[12.5px]">Escena
                <select className={fieldCls} value={draft.scene} onChange={(ev) => setDraft({ ...draft, scene: ev.target.value })}>
                  <option value="ausente">Ausente (fuera de los mapas)</option>{scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></label>
              {draft.scene !== 'ausente' && !(draft.entry?.path && draft.entry.ubicacion?.escena_id === Number(draft.scene)) && <>
                <label className="flex flex-col gap-1 text-[12.5px]">Posición X<input type="number" min={0} className={fieldCls} value={draft.x} onChange={(ev) => setDraft({ ...draft, x: ev.target.value })} /></label>
                <label className="flex flex-col gap-1 text-[12.5px]">Posición Y<input type="number" min={0} className={fieldCls} value={draft.y} onChange={(ev) => setDraft({ ...draft, y: ev.target.value })} /></label>
              </>}
              {draft.entry?.path && draft.entry.ubicacion?.escena_id === Number(draft.scene) && <p className="col-span-2 text-xs text-muted">Conserva su ruta; para cambiarla, redibújala en el mapa y usa «Guardar en la agenda».</p>}
              {draft.scene !== 'ausente' && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.oculto} onChange={(ev) => setDraft({ ...draft, oculto: ev.target.checked })} />Oculto</label>}
              <label className="col-span-2 flex flex-col gap-1 text-[12.5px]">Nota<input className={fieldCls} maxLength={500} value={draft.nota} onChange={(ev) => setDraft({ ...draft, nota: ev.target.value })} /></label>
              <div className="col-span-2 flex justify-end gap-2">
                <button type="button" className="mc-btn mc-btn-sm" onClick={() => setDraft(null)}>Cancelar</button>
                <button type="submit" className="mc-btn mc-btn-sm mc-btn-primary">Guardar entrada</button>
              </div>
            </form>
          ) : (
            <button type="button" className="mc-btn mc-btn-sm self-start" onClick={() => setDraft(toDraft(null, null))}>
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>Añadir entrada</button>
          )}
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Agenda en JSON
            <textarea rows={14} spellCheck={false} className="w-full p-2.5 font-mono text-[12.5px]" value={json ?? JSON.stringify(agenda, null, 2)} onChange={(ev) => setJson(ev.target.value)} /></label>
          <p className="text-xs text-muted">Cada entrada: <code>dia</code> (número, todos, laborables, fin_de_semana o lunes…domingo), <code>momento</code> (dia, tarde, noche), <code>ubicacion</code> (<code>{'{"escena_id": N}'}</code> o <code>null</code> = ausente), <code>posicion</code>, <code>path</code>, <code>oculto</code>, <code>nota</code>.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="mc-btn mc-btn-sm" onClick={() => { setJson(null); setProblems([]); }}>Descartar cambios</button>
            <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" onClick={saveJson}>Guardar JSON</button>
          </div>
        </>
      )}
    </div>
  );
}
