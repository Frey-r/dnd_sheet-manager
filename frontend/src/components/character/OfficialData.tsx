import { useQuery } from '@tanstack/react-query';
import { getEquipment, getSpell } from '../../services/srdService';
import { catalogText } from '../../lib/abilities';

// Official catalog data shown next to the character's own copy (srd-data.md: with a
// reference, the UI shows the official data beside the campaign modifications).

export function OfficialSpell({ id }: { id: number }) {
  const spell = useQuery({ queryKey: ['srd-spell', id], queryFn: () => getSpell(id), staleTime: 300_000 });
  if (spell.isLoading) return <p className="text-xs text-secondary">Cargando datos oficiales…</p>;
  if (!spell.data) return null;
  const facts = [['Alcance', spell.data.range], ['Duración', spell.data.duration], ['Lanzamiento', spell.data.casting_time]].filter(([, value]) => value);
  return <section aria-label="Datos oficiales del catálogo" className="rounded-lg border border-dashed border-line p-3 text-xs space-y-1">
    <p className="font-label-bold text-secondary uppercase tracking-wide">Oficial · catálogo</p>
    <p>{facts.map(([label, value]) => `${label}: ${value}`).join(' · ')}</p>
    {spell.data.description && <p className="whitespace-pre-wrap text-on-surface-variant line-clamp-6">{catalogText(spell.data.description)}</p>}
  </section>;
}

export function OfficialItem({ id }: { id: number }) {
  const item = useQuery({ queryKey: ['srd-equipment', id], queryFn: () => getEquipment(id), staleTime: 300_000 });
  if (item.isLoading) return <p className="text-xs text-secondary">Cargando datos oficiales…</p>;
  if (!item.data) return null;
  const e = item.data;
  const facts = [
    e.category,
    e.damage_dice && `Daño ${e.damage_dice}`,
    e.ac_base != null && `CA ${e.ac_base}`,
    e.weight ? `${e.weight} lb` : '',
  ].filter(Boolean);
  return <section aria-label="Datos oficiales del catálogo" className="rounded-lg border border-dashed border-line p-3 text-xs space-y-1 mt-2">
    <p className="font-label-bold text-secondary uppercase tracking-wide">Oficial · catálogo</p>
    <p>{facts.join(' · ')}</p>
    {e.description && <p className="whitespace-pre-wrap text-on-surface-variant line-clamp-6">{catalogText(e.description)}</p>}
  </section>;
}
