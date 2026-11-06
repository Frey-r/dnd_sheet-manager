import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../services/api';
import { getApiError } from '../services/errors';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback';
import { PageHeader, Panel } from '../components/ui/Page';
import { ContentEntries } from '../components/content/ContentEntries';

type Summary = { id: number; type: string; name: string; source: string; is_srd: boolean; origin: string; page?: number };
type Detail = Summary & { data: Record<string, unknown> };

export function ContentLibrary() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const categories = useQuery({ queryKey: ['content-categories'], queryFn: () => contentApi.categories().then((response) => response.data.data) });
  const sources = useQuery({ queryKey: ['content-sources'], queryFn: () => contentApi.sources().then((response) => response.data.data) });
  const results = useQuery({ queryKey: ['content', query, type, source], queryFn: () => contentApi.search({ query, type, source, limit: 50 }).then((response) => response.data) });
  const detail = useQuery({ queryKey: ['content-detail', selected], enabled: selected !== null, queryFn: () => contentApi.get(selected!).then((response) => response.data as Detail) });
  return <div className="p-4 md:p-6 max-w-7xl mx-auto">
    <PageHeader title="Biblioteca 5e" description="Todo el contenido importado localmente, con su fuente de origen." />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
      <input aria-label="Buscar contenido" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en todo el catálogo…" className="md:col-span-2 rounded bg-surface-subtle border-border-low-contrast" />
      <select aria-label="Categoría" value={type} onChange={(event) => setType(event.target.value)} className="rounded bg-surface-subtle border-border-low-contrast"><option value="">Todas las categorías</option>{categories.data?.map((category: { type: string; count: number }) => <option key={category.type} value={category.type}>{category.type} ({category.count})</option>)}</select>
      <select aria-label="Fuente" value={source} onChange={(event) => setSource(event.target.value)} className="rounded bg-surface-subtle border-border-low-contrast"><option value="">Todas las fuentes</option>{sources.data?.map((item: string) => <option key={item}>{item}</option>)}</select>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Panel title={results.data ? `${results.data.total} resultados` : 'Catálogo'}>
        {results.isLoading ? <LoadingState /> : results.error ? <ErrorState message={getApiError(results.error)} onRetry={() => void results.refetch()} /> : results.data?.data.length === 0 ? <EmptyState title="No hay resultados con estos filtros" /> : <div className="divide-y divide-border-low-contrast">{results.data?.data.map((item: Summary) => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`w-full text-left py-3 px-2 rounded hover:bg-surface-container ${selected === item.id ? 'bg-surface-container' : ''}`}><div className="flex justify-between gap-3"><span className="font-label-bold text-on-surface">{item.name}</span><span className="text-xs text-on-surface-variant">{item.type}</span></div><div className="flex gap-2 mt-1 text-xs"><span className="text-on-surface-variant">{item.source}{item.page ? ` · p. ${item.page}` : ''}</span>{item.is_srd && <span className="text-primary font-bold">SRD</span>}{item.origin === 'homebrew' && <span className="text-primary font-bold">Homebrew</span>}</div></button>)}</div>}
      </Panel>
      <Panel title={detail.data?.name || 'Detalle'}>
        {selected === null ? <EmptyState title="Selecciona una entrada para consultarla" /> : detail.isLoading ? <LoadingState /> : detail.error ? <ErrorState message={getApiError(detail.error)} /> : detail.data && <div><div className="flex gap-2 mb-4 text-sm text-on-surface-variant"><span>{detail.data.type}</span><span>·</span><span>{detail.data.source}</span>{detail.data.is_srd && <span className="text-primary font-bold">SRD</span>}</div><ContentEntries data={detail.data.data} /></div>}
      </Panel>
    </div>
  </div>;
}
