import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { searchMonsters, MONSTER_TYPES, MONSTER_SIZES } from '../services/srdService';
import { HomebrewMonsterForm } from '../components/content/HomebrewMonsterForm';
import { CRBadge } from '../components/ui/CRBadge';
import type { MonsterListItem, MonsterFilters } from '../types/srd';

export function Bestiary() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [creatures, setCreatures] = useState<MonsterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<MonsterFilters>({ limit: 24, offset: 0 });
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCreatures = useCallback(async (f: MonsterFilters) => {
    setLoading(true);
    try {
      const result = await searchMonsters(f);
      setCreatures(result.data || []);
      setTotal(result.total);
    } catch {
      setCreatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar
    fetchCreatures(filters);
  }, [filters, fetchCreatures]);

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, query: search, offset: 0 }));
  };

  const handleTypeFilter = (type: string) => {
    setFilters(prev => ({
      ...prev,
      type: prev.type === type ? undefined : type,
      offset: 0,
    }));
  };

  const handleSizeFilter = (size: string) => {
    setFilters(prev => ({
      ...prev,
      size: prev.size === size ? undefined : size,
      offset: 0,
    }));
  };

  const handleNextPage = () => {
    if ((filters.offset || 0) + (filters.limit || 24) < total) {
      setFilters(prev => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || 24) }));
    }
  };

  const handlePrevPage = () => {
    if ((filters.offset || 0) > 0) {
      setFilters(prev => ({ ...prev, offset: Math.max(0, (prev.offset || 0) - (prev.limit || 24)) }));
    }
  };

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 24)) + 1;
  const totalPages = Math.ceil(total / (filters.limit || 24));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Bestiario</h1>
          <span className="bg-tertiary-fixed text-on-tertiary-fixed font-label-bold text-[10px] px-2 py-0.5 rounded-full">
            {total} criaturas
          </span>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold">Nueva criatura</button>
      </header>

      <div className="sticky top-16 z-30 bg-surface px-4 py-3 border-b border-border-low-contrast space-y-3">
        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">search</span>
            <input
              type="text"
              placeholder="Buscar monstruos por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-border-low-contrast rounded-lg font-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-bold hover:bg-primary/90 transition-colors"
          >
            Buscar
          </button>
        </div>

        {/* Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {MONSTER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeFilter(type.toLowerCase())}
              className={`shrink-0 px-3 py-1 rounded-full font-label-sm border transition-colors ${
                filters.type === type.toLowerCase()
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-lowest text-on-surface border-border-low-contrast hover:border-primary'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Size Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {MONSTER_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => handleSizeFilter(size)}
              className={`shrink-0 px-3 py-1 rounded-full font-label-sm border transition-colors ${
                filters.size === size
                  ? 'bg-tertiary text-on-tertiary border-tertiary'
                  : 'bg-surface-container-lowest text-on-surface border-border-low-contrast hover:border-tertiary'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-4 md:p-10 max-w-5xl mx-auto w-full">
        {loading ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="font-body-lg text-secondary">Cargando bestiario...</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creatures.map((c) => (
                <Link
                  key={c.id}
                  to={`/campaign/${campaignId}/gm/bestiary/${c.id}`}
                  className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 hover:border-primary transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-error-container">pets</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-label-bold text-on-surface truncate">{c.name}</h3>
                      <p className="font-label-sm text-on-surface-variant capitalize">{c.type}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <CRBadge cr={c.cr} />
                      <span className={`font-label-bold text-[8px] px-1.5 py-0.5 rounded-full ${c.is_homebrew ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'}`} title={c.is_homebrew ? 'Criatura propia' : `Libro: ${c.source}`}>
                        {c.is_homebrew ? 'Propia' : c.source}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-surface-subtle rounded border border-border-low-contrast p-sm">
                    <div className="text-center">
                      <span className="font-label-sm text-secondary block">CA</span>
                      <span className="font-label-bold text-on-surface">{c.ac}</span>
                    </div>
                    <div className="text-center">
                      <span className="font-label-sm text-secondary block">PV</span>
                      <span className="font-label-bold text-hp-danger">{c.hp}</span>
                    </div>
                    <div className="text-center">
                      <span className="font-label-sm text-secondary block">XP</span>
                      <span className="font-label-bold text-on-surface">{c.xp.toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {creatures.length === 0 && (
              <div className="text-center py-20 text-secondary font-body-lg">
                No se encontraron criaturas con estos filtros.
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-border-low-contrast font-label-bold disabled:opacity-30 hover:bg-surface-container transition-colors"
                >
                  ← Anterior
                </button>
                <span className="font-body-md text-on-surface-variant">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="px-4 py-2 rounded-lg border border-border-low-contrast font-label-bold disabled:opacity-30 hover:bg-surface-container transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </main>
      {creating && <HomebrewMonsterForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void fetchCreatures(filters); }} />}
    </div>
  );
}
