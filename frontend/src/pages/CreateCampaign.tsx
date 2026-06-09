import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { campaignApi } from '../services/api';
import { useToast } from '../lib/hooks';

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startLevel, setStartLevel] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await campaignApi.create({ name: name.trim(), description: description.trim() });
      addToast('success', `Campaña "${res.data.name}" creada`);
      navigate(`/campaign/${res.data.id}`);
    } catch {
      addToast('error', 'Error al crear la campaña');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4 md:px-10">
        <div className="flex items-center gap-4">
          <Link to="/campaigns" className="text-primary hover:bg-surface-container-low rounded-full p-2 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Crear Campaña</h1>
        </div>
        <button className="text-on-surface-variant hover:bg-surface-container-low rounded-full p-2 transition-colors">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 md:px-10 py-lg max-w-3xl mx-auto w-full space-y-lg">
        {/* Portada */}
        <section className="space-y-sm">
          <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Portada</h2>
          <div className="w-full aspect-[2/1] bg-surface-subtle border border-dashed border-border-low-contrast rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-low transition-colors group overflow-hidden relative">
            <span className="material-symbols-outlined text-outline text-4xl mb-2 group-hover:text-primary transition-colors">add_photo_alternate</span>
            <span className="font-body-md text-outline group-hover:text-primary transition-colors">Añadir Imagen de Portada</span>
          </div>
        </section>

        {/* Información Básica */}
        <section className="space-y-sm">
          <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Información Básica</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block font-body-md text-on-surface mb-1">Nombre de la Campaña</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Las Sombras de Barovia"
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-3 font-body-md rounded-t outline-none transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="desc" className="block font-body-md text-on-surface mb-1">Descripción del Mundo</label>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el entorno, la atmósfera y el lore inicial..."
                rows={4}
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-3 font-body-md rounded-t outline-none transition-colors resize-none"
              />
            </div>
          </div>
        </section>

        {/* Configuración */}
        <section className="space-y-sm">
          <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Configuración</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label htmlFor="start-level" className="block font-body-md text-on-surface mb-1">Nivel Inicial</label>
              <select
                id="start-level"
                value={startLevel}
                onChange={(e) => setStartLevel(Number(e.target.value))}
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-3 font-body-md rounded-t outline-none transition-colors"
              >
                <option value={1}>Nivel 1</option>
                <option value={2}>Nivel 2</option>
                <option value={3}>Nivel 3</option>
                <option value={5}>Nivel 5</option>
                <option value={10}>Nivel 10</option>
              </select>
            </div>
            <div>
              <label htmlFor="max-players" className="block font-body-md text-on-surface mb-1">Máximo de Jugadores</label>
              <input
                id="max-players"
                type="number"
                min={1}
                max={10}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-3 font-body-md rounded-t outline-none transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center justify-between py-4 border-b border-border-low-contrast">
            <div>
              <div className="font-body-md text-on-surface">Visibilidad</div>
              <div className="font-label-sm text-on-surface-variant">Hacer pública para encontrar jugadores</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
            </label>
          </div>
        </section>

        {/* Action Button */}
        <div className="pt-lg pb-20 md:pb-0">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="w-full bg-primary-container text-on-primary-container font-headline-md py-4 rounded-lg hover:opacity-90 transition-opacity flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{submitting ? 'Creando...' : 'Crear Campaña'}</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </main>
    </div>
  );
}
