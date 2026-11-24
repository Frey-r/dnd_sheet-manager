/* Hand an NPC item or coins to a character (npc-agenda.md §5): gift, payment or loot. */
import { useState } from 'react';

export function GiveDialog({ title, characters, max, unit, onGive, onCancel, busy = false }: {
  title: string; characters: { id: number; name: string }[]; max: number; unit: 'objeto' | 'monedas';
  onGive: (characterId: number, quantity: number) => void; onCancel: () => void; busy?: boolean;
}) {
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? 0);
  const [qty, setQty] = useState(String(unit === 'objeto' ? 1 : max));
  const amount = Math.max(1, Math.min(max, Math.floor(Number(qty) || 1)));
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="mc-card flex w-72 flex-col gap-3 p-4 shadow-[var(--shadow-3)]">
      <b>{title}</b>
      {characters.length === 0 ? <p className="text-xs text-muted">La campaña no tiene personajes a quien entregar.</p> : <>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Personaje
          <select className="h-9 w-full px-2.5 text-[13.5px]" value={characterId} onChange={(e) => setCharacterId(Number(e.target.value))}>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">{unit === 'objeto' ? 'Cantidad' : 'Monedas (pc)'}
          <input type="number" min={1} max={max} className="h-9 w-full px-2.5 text-[13.5px]" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <small className="text-xs text-muted">Máximo {max}{unit === 'monedas' ? ' pc' : ''}.</small>
      </>}
      <div className="flex justify-end gap-2">
        <button type="button" className="mc-btn mc-btn-sm" onClick={onCancel}>Cancelar</button>
        <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" disabled={busy || !characters.length || max < 1} onClick={() => onGive(characterId, amount)}>Entregar</button>
      </div>
    </div>
  );
}
