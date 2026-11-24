/* NPC combat sheet (npc-agenda.md §5): copied to its map tokens; the NPC owns its HP. */
import { useState } from 'react';

import { DEFAULT_COMBAT, type NPCCombat } from '../../lib/npc/combat';

export type { NPCCombat };

const FIELDS: [keyof NPCCombat, string, number?][] = [
  ['hp', 'PG'], ['max_hp', 'PG máx.'], ['ac', 'CA'], ['speed_ft', 'Velocidad (pies)', 5], ['passive_perception', 'Percepción pasiva'],
  ['darkvision_ft', 'Visión en la oscuridad (pies)', 5], ['blindsight_ft', 'Vista ciega (pies)', 5], ['dex_mod', 'Mod. DES'], ['stealth_bonus', 'Bonus de Sigilo'],
];

export function CombatSheetForm({ combat, onSave, busy = false }: { combat: Partial<NPCCombat> | null; onSave: (c: NPCCombat) => void; busy?: boolean }) {
  const [draft, setDraft] = useState<NPCCombat>({ ...DEFAULT_COMBAT, ...(combat ?? {}) });
  const num = (key: keyof NPCCombat, v: string) => setDraft({ ...draft, [key]: v === '' ? 0 : Number(v) });
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FIELDS.map(([key, label, step]) => (
          <label key={key} className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">{label}
            <input type="number" step={step ?? 1} className="h-9 w-full px-2.5 text-[13.5px]" value={draft[key] as number} onChange={(e) => num(key, e.target.value)} /></label>
        ))}
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Tamaño (celdas)
          <select className="h-9 w-full px-2.5 text-[13.5px]" value={draft.size_cells} onChange={(e) => num('size_cells', e.target.value)}>
            {[[0.5, 'Diminuto'], [1, 'Pequeño/Mediano'], [2, 'Grande'], [3, 'Enorme'], [4, 'Gargantuesco']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={draft.detects} onChange={(e) => setDraft({ ...draft, detects: e.target.checked })} />Detecta jugadores</label>
        <small className="text-xs text-muted">(si es hostil, inicia un encuentro al verlos)</small>
      </div>
      <button type="submit" disabled={busy} className="mc-btn mc-btn-primary self-start">Guardar hoja de combate</button>
    </form>
  );
}
