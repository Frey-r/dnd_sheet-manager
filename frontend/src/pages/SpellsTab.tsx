import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { characterApi } from '../services/api';
import { searchSpells, getSpell } from '../services/srdService';
import type { Spell, SpellSlot } from '../types';
import type { SpellListItem } from '../types/srd';

export function SpellsTab() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const [spells, setSpells] = useState<Spell[]>([]);
  const [slots, setSlots] = useState<SpellSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Add spell modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [srdResults, setSrdResults] = useState<SpellListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchCharacterData = () => {
    if (!characterId) return;
    setLoading(true);
    Promise.all([
      characterApi.spells(characterId).then(r => setSpells(r.data)).catch(() => {}),
      characterApi.spellSlots(characterId).then(r => setSlots(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCharacterData();
  }, [characterId]);

  const handleCast = (spellId: number) => {
    characterApi.castSpell(characterId!, spellId)
      .then(() => characterApi.spellSlots(characterId!))
      .then(r => setSlots(r.data))
      .catch(() => {});
  };

  // Search SRD spells
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSrdResults([]);
      return;
    }
    setSearching(true);
    const delayDebounceFn = setTimeout(() => {
      searchSpells({ query: searchQuery, limit: 10 })
        .then((res) => {
          setSrdResults(res.data || []);
        })
        .catch(() => setSrdResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Add spell to character sheet
  const handleAddSpell = async (srdSpellId: number) => {
    setAdding(true);
    try {
      const srdSpell = await getSpell(srdSpellId);
      const componentsList: string[] = [];
      if (srdSpell.components_v) componentsList.push('V');
      if (srdSpell.components_s) componentsList.push('S');
      if (srdSpell.components_m) componentsList.push('M');

      await characterApi.addSpell(characterId!, {
        name: srdSpell.name,
        level: srdSpell.level,
        school: srdSpell.school,
        casting_time: srdSpell.casting_time,
        range: srdSpell.range,
        duration: srdSpell.duration,
        description: srdSpell.description,
        components: JSON.stringify(componentsList),
        damage_type: srdSpell.damage_type || '',
        srd_ref_id: srdSpell.id,
      });

      setShowAddModal(false);
      setSearchQuery('');
      setSrdResults([]);
      // Refresh character spells list
      characterApi.spells(characterId!).then(r => setSpells(r.data));
    } catch (e) {
      console.error('Failed to add spell:', e);
    } finally {
      setAdding(false);
    }
  };

  const groupedSpells = spells.reduce<Record<number, Spell[]>>((acc, s) => {
    (acc[s.level] ??= []).push(s);
    return acc;
  }, {});

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col bg-surface-container-lowest">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Spells</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-on-primary font-label-bold px-4 py-2 rounded-lg hover:bg-primary/95 transition-colors flex items-center gap-1 shadow-sm"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Prepare Spell
        </button>
      </header>

      <nav className="bg-surface border-b border-border-low-contrast sticky top-16 z-30">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-4">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Stats</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/spells`} className="py-3 border-b-2 border-primary text-primary font-label-bold whitespace-nowrap">Spells</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/inventory`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Inventory</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/bio`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Bio</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/features`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Features</Link>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        {slots.length > 0 && (
          <section className="bg-surface border border-border-low-contrast rounded-xl p-4 shadow-sm">
            <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-3">Spell Slots</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {slots.map((slot) => (
                <div key={slot.level} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-3 flex flex-col items-center shadow-2xs">
                  <span className="font-label-sm text-secondary mb-1">Lvl {slot.level}</span>
                  <span className="font-stat-number text-on-surface">{slot.used}/{slot.total}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {Object.keys(groupedSpells).length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline mb-4 block">auto_awesome</span>
            <p className="font-body-lg text-secondary">No spells prepared. Click "Prepare Spell" to add from the SRD.</p>
          </div>
        ) : (
          Object.entries(groupedSpells).sort(([a], [b]) => Number(a) - Number(b)).map(([level, levelSpells]) => (
            <section key={level}>
              <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider border-b border-border-low-contrast pb-2 mb-3">
                {level === '0' ? 'Cantrips' : `Level ${level}`}
              </h3>
              <div className="flex flex-col gap-3">
                {levelSpells.map((spell) => (
                  <div key={spell.id} className="bg-surface border border-border-low-contrast rounded-xl p-4 hover:border-primary transition-all shadow-2xs">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-label-bold text-on-surface">{spell.name}</h4>
                        <span className="font-label-sm text-secondary bg-surface-variant px-2 py-0.5 rounded uppercase font-label-xs mt-1 inline-block">{spell.school}</span>
                      </div>
                      <button
                        onClick={() => handleCast(spell.id)}
                        className="bg-primary-container text-on-primary-container font-label-bold px-3.5 py-1.5 rounded-lg hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                        Cast
                      </button>
                    </div>
                    <p className="font-body-md text-on-surface-variant line-clamp-2 mb-2">{spell.description}</p>
                    <div className="flex gap-4 font-label-sm text-secondary pt-1 border-t border-border-low-contrast mt-2">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span>{spell.casting_time}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">straighten</span>{spell.range}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">flash_on</span>{spell.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Prepare Spell Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface w-full max-w-md rounded-xl shadow-xl overflow-hidden border border-border-low-contrast flex flex-col max-h-[80vh]">
            <header className="px-4 py-3 bg-surface-subtle border-b border-border-low-contrast flex items-center justify-between">
              <h3 className="font-label-bold text-on-surface">Prepare New Spell</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setSrdResults([]);
                }}
                className="p-1 rounded-full hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-secondary">close</span>
              </button>
            </header>
            
            <div className="p-4 border-b border-border-low-contrast">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">search</span>
                <input
                  type="text"
                  placeholder="Type spell name (e.g., Fireball)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-border-low-contrast rounded-lg font-body-md text-on-surface focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {searching ? (
                <div className="text-center py-10 text-secondary">Searching standard magical scrolls...</div>
              ) : srdResults.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {srdResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleAddSpell(s.id)}
                      disabled={adding}
                      className="w-full text-left p-3 rounded-lg hover:bg-primary/5 transition-colors flex items-center justify-between group disabled:opacity-50"
                    >
                      <div>
                        <div className="font-label-bold text-on-surface group-hover:text-primary transition-colors">{s.name}</div>
                        <div className="font-label-sm text-secondary capitalize">
                          Level {s.level} • {s.school}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        add_circle
                      </span>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <div className="text-center py-10 text-secondary">No SRD spells found matching your search.</div>
              ) : (
                <div className="text-center py-10 text-secondary font-body-sm">
                  Start typing to search the System Reference Document (SRD) spells list.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
