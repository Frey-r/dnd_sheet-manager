import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export function MapDetail() {
  const { campaignId } = useParams();
  const [layersOpen, setLayersOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <header className="bg-surface border-b border-border-low-contrast flex items-center justify-between px-4 md:px-10 w-full h-16 z-50 shrink-0">
        <Link to={`/campaign/${campaignId}/gm/maps`} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-primary">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-lg text-primary font-bold text-center flex-1">Valle de Barovia</h1>
        <div className="flex gap-2">
          <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-primary">
            <span className="material-symbols-outlined">share</span>
          </button>
          <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-primary">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-surface-subtle">
        <div className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing">
          <img
            className="w-full h-full object-cover origin-center"
            src="https://picsum.photos/seed/barovia/1200/800"
            alt="Valle de Barovia"
            style={{ transform: 'scale(1.1)' }}
          />

          {/* Map Pins */}
          <div className="absolute top-[40%] left-[60%] flex flex-col items-center cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-primary-container border-2 border-surface flex items-center justify-center shadow-md z-10 hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-on-primary-container text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
            </div>
            <div className="mt-1 px-2 py-1 bg-surface/90 backdrop-blur-sm border border-border-low-contrast rounded font-label-sm text-on-surface whitespace-nowrap">
              Castillo Ravenloft
            </div>
          </div>
          <div className="absolute top-[60%] left-[30%] flex flex-col items-center cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-gm-amber border-2 border-surface flex items-center justify-center shadow-md z-10 hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-on-surface text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            </div>
            <div className="mt-1 px-2 py-1 bg-surface/90 backdrop-blur-sm border border-border-low-contrast rounded font-label-sm text-on-surface whitespace-nowrap">
              Pueblo de Barovia
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute right-4 md:right-10 top-4 md:top-10 flex flex-col gap-sm bg-surface border border-border-low-contrast rounded-lg shadow-sm p-1 z-20">
          <button className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded transition-colors">
            <span className="material-symbols-outlined">add</span>
          </button>
          <div className="w-full h-px bg-border-low-contrast" />
          <button className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded transition-colors">
            <span className="material-symbols-outlined">remove</span>
          </button>
        </div>

        {/* Layer Controls */}
        <div className="absolute left-4 md:left-10 top-4 md:top-10 z-20">
          <button
            onClick={() => setLayersOpen(!layersOpen)}
            className="bg-surface border border-border-low-contrast rounded-full shadow-sm px-4 py-2 flex items-center gap-sm font-label-bold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined">layers</span>
            Capas
          </button>
          {layersOpen && (
            <div className="absolute top-full left-0 mt-sm bg-surface border border-border-low-contrast rounded-lg shadow-md w-48 overflow-hidden">
              <label className="flex items-center justify-between p-md hover:bg-surface-container-low cursor-pointer border-b border-border-low-contrast">
                <span className="font-body-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-sm">grid_on</span>
                  Cuadrícula
                </span>
                <input type="checkbox" className="h-4 w-4 rounded border-outline-variant text-primary" />
              </label>
              <label className="flex items-center justify-between p-md hover:bg-surface-container-low cursor-pointer border-b border-border-low-contrast">
                <span className="font-body-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-sm">cloud</span>
                  Niebla
                </span>
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-outline-variant text-primary" />
              </label>
              <label className="flex items-center justify-between p-md hover:bg-surface-container-low cursor-pointer">
                <span className="font-body-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-sm">location_on</span>
                  Marcadores
                </span>
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-outline-variant text-primary" />
              </label>
            </div>
          )}
        </div>

        {/* Bottom Sheet */}
        <div
          className={`absolute bottom-0 left-0 w-full bg-surface border-t border-border-low-contrast shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-xl z-30 transition-transform duration-300 ${sheetExpanded ? 'translate-y-0' : 'translate-y-[85%]'}`}
        >
          <div className="w-full flex justify-center py-sm cursor-pointer" onClick={() => setSheetExpanded(!sheetExpanded)}>
            <div className="w-12 h-1 bg-outline-variant rounded-full" />
          </div>
          <div className="px-4 md:px-10 pb-10">
            <div className="flex justify-between items-start mb-sm">
              <div>
                <div className="font-label-bold text-secondary uppercase tracking-wider mb-xs">Ubicación Actual</div>
                <h2 className="font-headline-md font-bold text-on-surface">Pueblo de Barovia</h2>
              </div>
              <button className="bg-primary-container text-on-primary-container px-4 py-2 rounded font-label-bold hover:bg-primary transition-colors">
                Editar
              </button>
            </div>
            <p className="font-body-md text-on-surface-variant mb-lg max-w-3xl">
              Un lugar sombrío bajo la sombra del Castillo Ravenloft. Las calles están embarradas y los rostros de los habitantes reflejan una desesperanza perpetua.
            </p>
            <div className="border-t border-border-low-contrast pt-md">
              <h3 className="font-label-bold text-on-surface mb-md">Puntos de Interés</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                <div className="flex items-start gap-md p-md bg-surface-subtle border border-border-low-contrast rounded-lg hover:border-primary-container transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded bg-surface border border-border-low-contrast flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">storefront</span>
                  </div>
                  <div>
                    <div className="font-label-bold text-on-surface">Taberna Sangre de Vida</div>
                    <div className="font-label-sm text-on-surface-variant mt-xs">El único lugar con calor en el pueblo.</div>
                  </div>
                </div>
                <div className="flex items-start gap-md p-md bg-surface-subtle border border-border-low-contrast rounded-lg hover:border-primary-container transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded bg-surface border border-border-low-contrast flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">church</span>
                  </div>
                  <div>
                    <div className="font-label-bold text-on-surface">Iglesia de Barovia</div>
                    <div className="font-label-sm text-on-surface-variant mt-xs">Hogar del Padre Donavich.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
