import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { campaignApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ErrorState } from '../components/ui/Feedback';

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gameMode, setGameMode] = useState<'local' | 'foundry'>('local');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await campaignApi.create({ name: name.trim(), description: description.trim(), game_mode: gameMode });
      navigate(`/campaign/${response.data.id}`);
    } catch (reason) {
      setError(getApiError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center px-4 md:px-10 gap-3">
      <Link to="/campaigns" aria-label="Volver" className="text-primary p-2"><span className="material-symbols-outlined">arrow_back</span></Link>
      <h1 className="font-headline-md font-bold">Crear campaña</h1>
    </header>
    <main className="px-4 md:px-10 py-8 max-w-3xl mx-auto">
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4">
          <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Información básica</h2>
          <label className="block font-body-md">Nombre de la campaña
            <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Las Sombras de Barovia" className="mt-1 w-full bg-surface-subtle border border-border-low-contrast px-4 py-3 rounded-lg" autoFocus />
          </label>
          <label className="block font-body-md">Descripción del mundo
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Entorno, atmósfera y punto de partida…" rows={5} maxLength={10000} className="mt-1 w-full bg-surface-subtle border border-border-low-contrast px-4 py-3 rounded-lg resize-none" />
          </label>
        </section>
        <section className="space-y-3">
          <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Modo de juego</h2>
          <label className={`block border rounded-xl p-4 cursor-pointer ${gameMode === 'local' ? 'border-primary bg-primary/5' : 'border-border-low-contrast'}`}>
            <input type="radio" name="game-mode" value="local" checked={gameMode === 'local'} onChange={() => setGameMode('local')} className="mr-2" />
            <span className="font-label-bold">Local</span>
            <span className="block text-sm text-secondary mt-1">Personajes, inventario y combate se gestionan y sincronizan en esta aplicación.</span>
          </label>
          <label className={`block border rounded-xl p-4 cursor-pointer ${gameMode === 'foundry' ? 'border-primary bg-primary/5' : 'border-border-low-contrast'}`}>
            <input type="radio" name="game-mode" value="foundry" checked={gameMode === 'foundry'} onChange={() => setGameMode('foundry')} className="mr-2" />
            <span className="font-label-bold">Foundry VTT</span>
            <span className="block text-sm text-secondary mt-1">Foundry controla el estado de juego. Requiere configurar el relay y Foundry antes de sincronizar.</span>
          </label>
        </section>
        <button type="submit" disabled={!name.trim() || submitting} className="w-full bg-primary-container text-on-primary-container font-headline-md py-4 rounded-lg disabled:opacity-50">
          {submitting ? 'Creando…' : 'Crear campaña'}
        </button>
      </form>
    </main>
  </div>;
}
