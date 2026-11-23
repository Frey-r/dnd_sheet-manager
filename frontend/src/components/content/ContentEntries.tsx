function cleanTags(value: string) {
  return value.replace(/\{@\w+\s+([^}|]+)(?:\|[^}]*)?}/g, '$1').replace(/\{@\w+\s+([^}]+)}/g, '$1');
}

function Entry({ value }: { value: unknown }) {
  if (value == null || typeof value === 'boolean') return null;
  if (typeof value === 'string' || typeof value === 'number') return <p className="text-on-surface-variant whitespace-pre-wrap leading-relaxed">{cleanTags(String(value))}</p>;
  if (Array.isArray(value)) return <div className="space-y-2">{value.map((item, index) => <Entry key={index} value={item} />)}</div>;
  if (typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.name === 'string' && data.entries) return <div className="space-y-2"><h3 className="font-label-bold text-on-surface">{data.name}</h3><Entry value={data.entries} /></div>;
  if (data.type === 'list' && Array.isArray(data.items)) return <ul className="list-disc pl-5 space-y-1">{data.items.map((item, index) => <li key={index}><Entry value={item} /></li>)}</ul>;
  if (data.type === 'table') return <div className="overflow-x-auto"><pre className="whitespace-pre-wrap text-sm text-on-surface-variant">{cleanTags(JSON.stringify(data, null, 2))}</pre></div>;
  const entries = data.entries ?? data.entry ?? data.text ?? data.description;
  if (entries) return <Entry value={entries} />;
  return <p className="text-on-surface-variant">{cleanTags(JSON.stringify(data))}</p>;
}

export function ContentEntries({ data }: { data: Record<string, unknown> }) {
  const entries = data.entries ?? data.entry ?? data.description ?? data.content ?? data.data;
  if (!entries) return <p className="text-on-surface-variant">No hay descripción estructurada para esta entrada.</p>;
  return <div className="space-y-3"><Entry value={entries} /></div>;
}
