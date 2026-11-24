/* «Dónde están ahora» (npc-agenda.md §5): every NPC with its scene, state and next destination. */
import { describeEntry, STATE_LABEL, type SceneRef, type Whereabout } from '../../lib/npc/agenda';

const RELATION: Record<string, string> = { enemy: 'Enemigo', neutral: 'Neutral', ally: 'Aliado' };

export function WhereaboutsView({ rows, scenes, onOpen }: { rows: Whereabout[]; scenes: SceneRef[]; onOpen?: (npcId: number) => void }) {
  if (!rows.length) return <p className="text-sm text-muted">La campaña no tiene PNJ todavía.</p>;
  return (
    <table className="w-full text-left text-[13px]">
      <thead className="text-xs text-muted"><tr><th className="py-1">PNJ</th><th>Ahora</th><th>Estado</th><th>Siguiente momento</th></tr></thead>
      <tbody>
        {rows.map((w) => (
          <tr key={w.npc_id} className="border-t border-line align-top">
            <td className="py-1.5">
              {onOpen ? <button type="button" className="text-left font-medium underline-offset-2 hover:underline" onClick={() => onOpen(w.npc_id)}>{w.nombre}</button> : <span className="font-medium">{w.nombre}</span>}
              <small className="block text-xs text-muted">{RELATION[w.relacion] ?? 'Neutral'}</small>
            </td>
            <td>{w.escena || '—'}</td>
            <td><span className="mc-badge">{STATE_LABEL[w.estado] ?? w.estado}</span></td>
            <td className="text-ink-2">{w.siguiente ? describeEntry(w.siguiente, scenes) : w.estado === 'sin_agenda' ? '—' : 'Se queda'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
