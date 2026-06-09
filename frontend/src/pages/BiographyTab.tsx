import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { characterApi } from '../services/api';
import type { Character } from '../types';

export function BiographyTab() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const [character, setCharacter] = useState<Character | null>(null);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState({
    personality_traits: '', ideals: '', bonds: '', flaws: '', backstory_text: '', notes: '',
  });

  useEffect(() => {
    if (!characterId) return;
    characterApi.get(characterId).then(r => {
      setCharacter(r.data);
      const c = r.data;
      setBio({
        personality_traits: c.personality_traits || '',
        ideals: c.ideals || '',
        bonds: c.bonds || '',
        flaws: c.flaws || '',
        backstory_text: c.backstory_text || '',
        notes: c.notes || '',
      });
    }).catch(() => {});
  }, [characterId]);

  const handleSave = async () => {
    if (!characterId) return;
    setSaving(true);
    try {
      await characterApi.update(characterId, bio);
    } catch { /* silent fail */ }
    setSaving(false);
  };

  if (!character) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Bio</h1>
        </div>
      </header>

      <nav className="bg-surface border-b border-border-low-contrast sticky top-16 z-30">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-4">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Stats</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/spells`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Spells</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/inventory`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Inventory</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/bio`} className="py-3 border-b-2 border-primary text-primary font-label-bold whitespace-nowrap">Bio</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/features`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Features</Link>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
            <span className="font-label-sm text-secondary uppercase">Alignment</span>
            <div className="font-headline-md text-primary-container mt-1">{character.alignment || 'Unknown'}</div>
          </div>
          <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
            <span className="font-label-sm text-secondary uppercase">Background</span>
            <div className="font-headline-md text-on-surface mt-1">{character.background || 'None'}</div>
          </div>
        </section>

        {(['personality_traits','ideals','bonds','flaws'] as const).map((field) => (
          <div key={field} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 focus-within:border-primary-container transition-colors">
            <label className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-2 block capitalize">{field.replace('_', ' ')}</label>
            <textarea
              value={bio[field]}
              onChange={(e) => setBio(prev => ({ ...prev, [field]: e.target.value }))}
              className="w-full bg-transparent border-none resize-none font-body-md text-on-surface outline-none"
              rows={2}
            />
          </div>
        ))}

        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 focus-within:border-primary-container transition-colors">
          <label className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Backstory</label>
          <textarea
            value={bio.backstory_text}
            onChange={(e) => setBio(prev => ({ ...prev, backstory_text: e.target.value }))}
            className="w-full bg-transparent border-none resize-none font-body-md text-on-surface outline-none"
            rows={6}
            placeholder="Escribe la historia de tu personaje..."
          />
        </div>

        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 focus-within:border-primary-container transition-colors">
          <label className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Notes</label>
          <textarea
            value={bio.notes}
            onChange={(e) => setBio(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full bg-transparent border-none resize-none font-body-md text-on-surface outline-none"
            rows={4}
            placeholder="Notas adicionales..."
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary-container text-on-primary-container font-label-bold py-3 rounded-lg hover:bg-surface-tint transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </main>
    </div>
  );
}
