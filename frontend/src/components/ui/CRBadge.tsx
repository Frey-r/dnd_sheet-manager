/** Insignia de Valor de Desafío coloreada por nivel de amenaza. */
function crValue(cr: string): number {
  const [top, bottom] = cr.split('/');
  const value = bottom ? Number(top) / Number(bottom) : Number(top);
  return Number.isFinite(value) ? value : 0;
}

function threat(value: number): { label: string; className: string } {
  if (value < 1) return { label: 'Trivial', className: 'bg-card-3 text-muted' };
  if (value <= 4) return { label: 'Bajo', className: 'bg-ok-soft text-ok' };
  if (value <= 10) return { label: 'Medio', className: 'bg-warn-soft text-warn' };
  if (value <= 16) return { label: 'Alto', className: 'bg-accent-soft text-accent' };
  return { label: 'Mortal', className: 'bg-bad-soft text-bad' };
}

export function CRBadge({ cr, className = '' }: { cr: string; className?: string }) {
  const info = threat(crValue(cr));
  return <span title={`Amenaza: ${info.label}`} className={`mc-badge uppercase ${info.className} ${className}`}>VD {cr}</span>;
}
