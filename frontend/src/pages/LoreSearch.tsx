import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loreApi } from '../services/api';

export function LoreSearch() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('character_lore');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !campaignId) return;
    setLoading(true);
    try {
      const res = await loreApi.search(campaignId, query, scope);
      setResult(res.data.answer || res.data.summary || JSON.stringify(res.data));
    } catch {
      setResult('Error al buscar. Prueba de nuevo.');
    }
    setLoading(false);
  };

  const scopes = [
    { value: 'character_lore', label: 'Mi Personaje' },
    { value: 'campaign_plot', label: 'Trama de la Partida' },
    { value: 'gm_hidden_lore', label: 'Lore Oculto' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center px-4">
        <Link to={`/campaign/${campaignId}`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold ml-2">Lore Search</h1>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-4">
        <div className="flex gap-2 mb-4 flex-wrap">
          {scopes.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              className={`font-label-bold px-4 py-2 rounded-full border transition-colors ${
                scope === s.value
                  ? s.value === 'gm_hidden_lore' ? 'bg-gm-amber/10 border-gm-amber text-gm-amber' : 'bg-primary/5 border-primary text-primary'
                  : 'border-border-low-contrast text-on-surface-variant hover:bg-surface-subtle'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {result && (
          <div className="flex-1 overflow-y-auto mb-4">
            <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              <p className="font-body-md text-on-surface whitespace-pre-wrap">{result}</p>
            </div>
          </div>
        )}

        <div className="sticky bottom-20 md:bottom-0 bg-background py-4 border-t border-border-low-contrast">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Pregunta sobre el lore..."
              className="flex-1 bg-surface-subtle border border-border-low-contrast rounded-lg px-4 py-3 font-body-md outline-none focus:border-primary"
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || loading}
              className="bg-primary-container text-on-primary-container px-4 rounded-lg font-label-bold hover:bg-surface-tint transition-colors disabled:opacity-50"
            >
              {loading ? '...' : <span className="material-symbols-outlined">send</span>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
