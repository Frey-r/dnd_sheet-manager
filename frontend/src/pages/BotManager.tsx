import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export function BotManager() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [enabled, setEnabled] = useState(true);
  const [personality, setPersonality] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Bot Manager</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-10 max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-label-bold text-on-surface">Game Master Bot</h2>
              <p className="font-body-md text-on-surface-variant">Automatiza tareas repetitivas</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-14 h-7 rounded-full transition-colors relative ${enabled ? 'bg-success-active' : 'bg-surface-variant'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${enabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-label-bold text-on-surface mb-2 block">Personalidad del Bot</label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Define el tono, estilo y rol del bot como ayudante del GM..."
                rows={4}
                className="w-full bg-surface-subtle border border-border-low-contrast rounded-lg px-4 py-3 font-body-md resize-none outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between bg-surface-subtle border border-border-low-contrast rounded-lg p-4">
                <span className="font-body-md text-on-surface">Auto-roll for NPCs</span>
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-outline-variant text-primary" />
              </label>
              <label className="flex items-center justify-between bg-surface-subtle border border-border-low-contrast rounded-lg p-4">
                <span className="font-body-md text-on-surface">Loot Distribution</span>
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-outline-variant text-primary" />
              </label>
              <label className="flex items-center justify-between bg-surface-subtle border border-border-low-contrast rounded-lg p-4">
                <span className="font-body-md text-on-surface">Session Timers</span>
                <input type="checkbox" className="h-4 w-4 rounded border-outline-variant text-primary" />
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button className="flex-1 bg-primary-container text-on-primary-container font-label-bold py-3 rounded-lg hover:bg-surface-tint transition-colors">Probar Bot</button>
            <button onClick={handleSave} className="flex-1 bg-surface-container-high text-on-surface font-label-bold py-3 rounded-lg hover:bg-surface-variant transition-colors border border-border-low-contrast">
              {saved ? 'Guardado' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
