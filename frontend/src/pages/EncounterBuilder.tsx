import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { buildEncounter, MONSTER_TYPES } from '../services/srdService';
import { combatApi } from '../services/api';
import { useCampaign } from '../lib/useCampaign';
import type { EncounterResult, EncounterSuggestion } from '../types/srd';

export function EncounterBuilder() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { isFoundry } = useCampaign(campaignId);
  const [partySize, setPartySize] = useState<number>(4);
  const [partyLevel, setPartyLevel] = useState<number>(1);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'deadly'>('medium');
  const [monsterType, setMonsterType] = useState<string>('');
  const [maxMonsters, setMaxMonsters] = useState<number>(10);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EncounterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await buildEncounter({
        party_size: partySize,
        party_level: partyLevel,
        difficulty,
        monster_type: monsterType || undefined,
        max_monster_count: maxMonsters || undefined,
      });
      setResult(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to calculate encounter suggestions.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCombat = async (suggestion: EncounterSuggestion) => {
    try {
      // hp, AC e iniciativa se resuelven en el servidor desde srd_monsters.
      const combatants = suggestion.monsters.map((item) => ({ monster_id: item.monster_id, count: item.count }));
      await combatApi.addEncounter(campaignId!, combatants);
      // Local campaigns use the built-in initiative tracker; /combat is the Foundry live view.
      navigate(isFoundry ? `/campaign/${campaignId}/combat` : `/campaign/${campaignId}/gm/combat`);
    } catch {
      setError('No se pudo añadir el encuentro al combate.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-container-lowest">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Encounter Builder</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 flex-1">
        {/* Left: Input Form */}
        <div className="p-5 bg-surface border-r border-border-low-contrast lg:col-span-1 space-y-4">
          <h2 className="font-headline-sm text-on-surface font-bold">Party Parameters</h2>
          
          <form onSubmit={handleBuild} className="space-y-4">
            <div>
              <label className="font-label-sm text-secondary block mb-1">Party Size</label>
              <input
                type="number"
                min="1"
                max="20"
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="font-label-sm text-secondary block mb-1">Average Party Level</label>
              <input
                type="number"
                min="1"
                max="20"
                value={partyLevel}
                onChange={(e) => setPartyLevel(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="font-label-sm text-secondary block mb-1">Target Difficulty</label>
              <div className="grid grid-cols-2 gap-2">
                {(['easy', 'medium', 'hard', 'deadly'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`px-3 py-2 rounded-lg border font-label-md capitalize transition-colors ${
                      difficulty === diff
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-surface text-on-surface border-border-low-contrast hover:border-primary'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-label-sm text-secondary block mb-1">Monster Type Preference (Optional)</label>
              <select
                value={monsterType}
                onChange={(e) => setMonsterType(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">Any Type</option>
                {MONSTER_TYPES.map(t => (
                  <option key={t} value={t.toLowerCase()}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-label-sm text-secondary block mb-1">Max Monsters Count</label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxMonsters}
                onChange={(e) => setMaxMonsters(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-label-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Building Encounter...' : 'Generate Suggestions'}
            </button>
          </form>

          {error && (
            <div className="p-3 bg-error-container text-on-error-container rounded-lg font-body-sm">
              {error}
            </div>
          )}
        </div>

        {/* Right: Results / Suggestions */}
        <div className="lg:col-span-2 p-5 overflow-y-auto max-h-[calc(100vh-64px)]">
          {result ? (
            <div className="space-y-6">
              {/* Budgets Summary */}
              <div className="bg-surface border border-border-low-contrast rounded-xl p-4 shadow-xs">
                <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-3">Party XP Budgets</h3>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-surface-subtle p-2.5 rounded-lg border border-border-low-contrast">
                    <span className="font-label-sm text-secondary block">Easy</span>
                    <span className="font-label-bold text-on-surface">{result.party_budget.easy} XP</span>
                  </div>
                  <div className="bg-surface-subtle p-2.5 rounded-lg border border-border-low-contrast">
                    <span className="font-label-sm text-secondary block">Medium</span>
                    <span className="font-label-bold text-primary">{result.party_budget.medium} XP</span>
                  </div>
                  <div className="bg-surface-subtle p-2.5 rounded-lg border border-border-low-contrast">
                    <span className="font-label-sm text-secondary block">Hard</span>
                    <span className="font-label-bold text-tertiary">{result.party_budget.hard} XP</span>
                  </div>
                  <div className="bg-surface-subtle p-2.5 rounded-lg border border-border-low-contrast">
                    <span className="font-label-sm text-secondary block">Deadly</span>
                    <span className="font-label-bold text-error">{result.party_budget.deadly} XP</span>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              <div className="space-y-4">
                <h3 className="font-headline-sm text-on-surface font-bold">Suggested Encounters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.suggestions.map((s, idx) => (
                    <div key={idx} className="bg-surface border border-border-low-contrast rounded-xl p-4 flex flex-col justify-between hover:border-primary transition-colors">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className={`font-label-bold text-xs uppercase px-2.5 py-0.5 rounded-full ${
                            s.actual_difficulty === 'deadly' ? 'bg-error-container text-on-error-container' :
                            s.actual_difficulty === 'hard' ? 'bg-tertiary-fixed text-on-tertiary-fixed' :
                            s.actual_difficulty === 'medium' ? 'bg-primary-fixed text-on-primary-fixed' :
                            'bg-surface-variant text-on-surface-variant'
                          }`}>
                            {s.actual_difficulty}
                          </span>
                          <span className="font-label-sm text-secondary">
                            Adjusted: <strong>{s.adjusted_xp} XP</strong>
                          </span>
                        </div>

                        <div className="space-y-1">
                          {s.monsters.map((m, mIdx) => (
                            <div key={mIdx} className="flex justify-between font-body-md text-on-surface">
                              <span>{m.count}x {m.name}</span>
                              <span className="text-secondary">CR {m.cr} ({m.xp} XP ea.)</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border-low-contrast pt-3 mt-4 flex items-center justify-between">
                        <div className="text-xs text-secondary">
                          Total Monsters: <strong>{s.monster_count}</strong>
                        </div>
                        <button
                          onClick={() => handleAddToCombat(s)}
                          className="px-3 py-1.5 bg-primary-container text-on-primary-container font-label-bold text-xs rounded-lg hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">swords</span>
                          Start Combat
                        </button>
                      </div>
                    </div>
                  ))}

                  {result.suggestions.length === 0 && (
                    <div className="col-span-2 text-center py-10 bg-surface border border-border-low-contrast rounded-xl text-secondary">
                      Could not find monster combinations matching these filters. Try adjusting target difficulty or removing monster type constraints.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6">
              <span className="material-symbols-outlined text-6xl text-outline mb-4">gavel</span>
              <h3 className="font-label-bold text-on-surface text-lg">No Configuration Loaded</h3>
              <p className="font-body-md text-secondary max-w-xs mt-1">
                Configure your party size, average level, and desired encounter difficulty, then generate monster suggestions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
