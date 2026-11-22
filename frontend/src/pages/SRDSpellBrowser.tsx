import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { searchSpells, getSpell, SPELL_SCHOOLS } from '../services/srdService';
import type { SpellListItem, SRDSpell, SpellFilters } from '../types/srd';

export function SRDSpellBrowser() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [spells, setSpells] = useState<SpellListItem[]>([]);
  const [selectedSpell, setSelectedSpell] = useState<SRDSpell | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  
  const [filters, setFilters] = useState<SpellFilters>({
    limit: 20,
    offset: 0,
  });

  const fetchSpells = useCallback(async (f: SpellFilters) => {
    setLoading(true);
    try {
      const result = await searchSpells(f);
      setSpells(result.data || []);
      setTotal(result.total);
    } catch {
      setSpells([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar
    fetchSpells(filters);
  }, [filters, fetchSpells]);

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, query: search, offset: 0 }));
  };

  const handleLevelSelect = (lvl: number | undefined) => {
    setFilters(prev => ({ ...prev, level: lvl, offset: 0 }));
  };

  const handleSchoolSelect = (school: string | undefined) => {
    setFilters(prev => ({ ...prev, school: school, offset: 0 }));
  };

  const handleClassSelect = (cls: string | undefined) => {
    setFilters(prev => ({ ...prev, class: cls, offset: 0 }));
  };

  const toggleConcentration = () => {
    setFilters(prev => ({
      ...prev,
      concentration: prev.concentration === undefined ? true : prev.concentration ? false : undefined,
      offset: 0,
    }));
  };

  const toggleRitual = () => {
    setFilters(prev => ({
      ...prev,
      ritual: prev.ritual === undefined ? true : prev.ritual ? false : undefined,
      offset: 0,
    }));
  };

  const handleSpellClick = async (spellId: number) => {
    if (selectedSpell && selectedSpell.id === spellId) {
      setSelectedSpell(null);
      return;
    }
    setDetailLoading(true);
    try {
      const detail = await getSpell(spellId);
      setSelectedSpell(detail);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleNextPage = () => {
    if ((filters.offset || 0) + (filters.limit || 20) < total) {
      setFilters(prev => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || 20) }));
    }
  };

  const handlePrevPage = () => {
    if ((filters.offset || 0) > 0) {
      setFilters(prev => ({ ...prev, offset: Math.max(0, (prev.offset || 0) - (prev.limit || 20)) }));
    }
  };

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1;
  const totalPages = Math.ceil(total / (filters.limit || 20));

  const classesList = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];

  return (
    <div className="min-h-screen flex flex-col bg-surface-container-lowest">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Libro de conjuros</h1>
          <span className="bg-primary-fixed text-on-primary-fixed font-label-bold text-[10px] px-2.5 py-0.5 rounded-full">
            {total} spells
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 flex-1">
        {/* Left/Middle: Filters and List */}
        <div className="lg:col-span-2 border-r border-border-low-contrast flex flex-col">
          <div className="p-4 bg-surface border-b border-border-low-contrast space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">search</span>
                <input
                  type="text"
                  placeholder="Buscar conjuros por nombre o descripción…"
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
                Filter
              </button>
            </div>

            {/* Filter Rows */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Level Selector */}
              <div>
                <label className="font-label-sm text-secondary block mb-1">Nivel de conjuro</label>
                <select
                  value={filters.level ?? ''}
                  onChange={(e) => handleLevelSelect(e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">Todos los niveles</option>
                  <option value="0">Trucos</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => (
                    <option key={l} value={l}>Nivel {l}</option>
                  ))}
                </select>
              </div>

              {/* School Selector */}
              <div>
                <label className="font-label-sm text-secondary block mb-1">Escuela de magia</label>
                <select
                  value={filters.school ?? ''}
                  onChange={(e) => handleSchoolSelect(e.target.value === '' ? undefined : e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">Todas las escuelas</option>
                  {SPELL_SCHOOLS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Class Selector */}
              <div>
                <label className="font-label-sm text-secondary block mb-1">Lista de conjuros de clase</label>
                <select
                  value={filters.class ?? ''}
                  onChange={(e) => handleClassSelect(e.target.value === '' ? undefined : e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="">Todas las clases</option>
                  {classesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Checkboxes */}
            <div className="flex flex-wrap gap-4 pt-1">
              <button
                onClick={toggleConcentration}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-label-sm transition-colors ${
                  filters.concentration === true
                    ? 'bg-primary/10 text-primary border-primary'
                    : filters.concentration === false
                    ? 'bg-error/10 text-error border-error'
                    : 'bg-surface-container-lowest text-on-surface-variant border-border-low-contrast'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {filters.concentration === true ? 'check_box' : filters.concentration === false ? 'indeterminate_check_box' : 'check_box_outline_blank'}
                </span>
                Concentración
              </button>

              <button
                onClick={toggleRitual}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-label-sm transition-colors ${
                  filters.ritual === true
                    ? 'bg-primary/10 text-primary border-primary'
                    : filters.ritual === false
                    ? 'bg-error/10 text-error border-error'
                    : 'bg-surface-container-lowest text-on-surface-variant border-border-low-contrast'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {filters.ritual === true ? 'check_box' : filters.ritual === false ? 'indeterminate_check_box' : 'check_box_outline_blank'}
                </span>
                Ritual
              </button>
            </div>
          </div>

          {/* Spell List */}
          <div className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-270px)]">
            {loading ? (
              <div className="h-full flex items-center justify-center py-20">
                <span className="font-body-lg text-secondary">Loading spells...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {spells.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSpellClick(s.id)}
                    className={`text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                      selectedSpell?.id === s.id
                        ? 'bg-primary/5 border-primary shadow-sm'
                        : 'bg-surface border-border-low-contrast hover:border-primary'
                    }`}
                  >
                    <div>
                      <div className="font-label-bold text-on-surface">{s.name}</div>
                      <div className="font-label-sm text-secondary flex gap-2 items-center mt-1">
                        <span className="bg-surface-variant px-2 py-0.5 rounded font-label-xs text-on-surface-variant uppercase">
                          Nv. {s.level}
                        </span>
                        <span className="capitalize">{s.school}</span>
                        {s.concentration && <span className="text-primary font-bold">• Concentración</span>}
                        {s.ritual && <span className="text-tertiary font-bold">• Ritual</span>}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-secondary">
                      {selectedSpell?.id === s.id ? 'keyboard_arrow_right' : 'chevron_right'}
                    </span>
                  </button>
                ))}

                {spells.length === 0 && (
                  <div className="text-center py-20 text-secondary font-body-lg">
                    Ningún conjuro coincide con la búsqueda.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-surface border-t border-border-low-contrast p-4 flex items-center justify-between">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-border-low-contrast font-label-bold disabled:opacity-30 hover:bg-surface-container transition-colors"
              >
                Previous
              </button>
              <span className="font-body-md text-on-surface-variant">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-border-low-contrast font-label-bold disabled:opacity-30 hover:bg-surface-container transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right side: Detailed View */}
        <div className="p-4 bg-surface-subtle lg:max-h-[calc(100vh-64px)] overflow-y-auto">
          {detailLoading ? (
            <div className="h-full flex items-center justify-center py-20">
              <span className="font-body-lg text-secondary">Cargando conjuro…</span>
            </div>
          ) : selectedSpell ? (
            <div className="bg-surface border border-border-low-contrast rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-headline-md text-on-surface font-bold mb-1">{selectedSpell.name}</h2>
                <div className="font-label-sm text-secondary capitalize italic">
                  {selectedSpell.level === 0 ? 'Truco' : `Nivel ${selectedSpell.level}`} · {selectedSpell.school}
                  {selectedSpell.ritual && ' (ritual)'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-b border-border-low-contrast py-3 text-sm">
                <div>
                  <span className="font-label-bold text-secondary block uppercase text-[10px]">Tiempo de lanzamiento</span>
                  <span className="text-on-surface">{selectedSpell.casting_time}</span>
                </div>
                <div>
                  <span className="font-label-bold text-secondary block uppercase text-[10px]">Alcance</span>
                  <span className="text-on-surface">{selectedSpell.range}</span>
                </div>
                <div>
                  <span className="font-label-bold text-secondary block uppercase text-[10px]">Componentes</span>
                  <span className="text-on-surface">
                    {[
                      selectedSpell.components_v && 'V',
                      selectedSpell.components_s && 'S',
                      selectedSpell.components_m && 'M'
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
                <div>
                  <span className="font-label-bold text-secondary block uppercase text-[10px]">Duración</span>
                  <span className="text-on-surface">
                    {selectedSpell.concentration && 'Concentration, '}
                    {selectedSpell.duration}
                  </span>
                </div>
              </div>

              {selectedSpell.components_m && selectedSpell.material_desc && (
                <div className="bg-surface-variant/40 rounded p-3 text-sm text-on-surface-variant">
                  <span className="font-label-bold text-secondary block uppercase text-[10px] mb-1">Materiales</span>
                  {selectedSpell.material_desc}
                </div>
              )}

              <div className="space-y-2">
                <span className="font-label-bold text-secondary block uppercase text-[10px]">Descripción</span>
                <p className="font-body-md text-on-surface leading-relaxed whitespace-pre-wrap">{selectedSpell.description}</p>
              </div>

              {selectedSpell.higher_levels && (
                <div className="space-y-1 bg-primary/5 rounded-lg border border-primary/10 p-3">
                  <span className="font-label-bold text-primary block uppercase text-[10px]">A niveles superiores</span>
                  <p className="font-body-sm text-on-surface-variant">{selectedSpell.higher_levels}</p>
                </div>
              )}

              {selectedSpell.classes && selectedSpell.classes.length > 0 && (
                <div className="space-y-1">
                  <span className="font-label-bold text-secondary block uppercase text-[10px]">Clases</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedSpell.classes.map((cls) => (
                      <span key={cls} className="bg-surface-container px-2 py-0.5 rounded text-xs text-on-surface font-label-md">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="material-symbols-outlined text-6xl text-outline mb-4">auto_stories</span>
              <h3 className="font-label-bold text-on-surface text-lg">Ningún conjuro seleccionado</h3>
              <p className="font-body-md text-secondary max-w-xs mt-1">
                Selecciona un conjuro de la lista para ver sus detalles, requisitos y clases.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
