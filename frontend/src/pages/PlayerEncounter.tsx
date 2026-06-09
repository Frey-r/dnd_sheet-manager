import { useParams, Link } from 'react-router-dom';

export function PlayerEncounter() {
  const { campaignId } = useParams();

  const combatants = [
    { name: 'Grommet', hp: 45, maxHp: 68, active: true, type: 'player', avatar: 'https://picsum.photos/seed/grommet/80/80' },
    { name: 'Beholder', hp: 144, maxHp: 180, active: false, type: 'enemy' },
    { name: 'Valerius', hp: 18, maxHp: 55, active: false, type: 'player', avatar: 'https://picsum.photos/seed/valerius/80/80' },
  ];

  const log = [
    { actor: 'Beholder', action: 'usó Rayo Ocular contra', target: 'Valerius', time: 'Hace 1 min', type: 'enemy' },
    { actor: 'Grommet', action: 'golpeó a', target: 'Beholder', detail: 'por 12 de daño', time: 'Hace 2 mins', type: 'player' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex items-center justify-between px-4 h-14 w-full">
        <button className="p-2 rounded-full hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined text-primary">menu</span>
        </button>
        <h1 className="font-headline-md text-primary font-bold">Round 4 &bull; Turn: Grommet</h1>
        <button className="p-2 rounded-full hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined text-primary">settings</span>
        </button>
      </header>

      <main className="flex-1 mt-14 mb-[88px] w-full max-w-4xl mx-auto px-4 py-lg overflow-y-auto">
        <section className="mb-lg">
          <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-sm">Iniciativa</h2>
          <div className="flex gap-sm overflow-x-auto no-scrollbar pb-xs snap-x snap-mandatory">
            {combatants.map((c) => (
              <div
                key={c.name}
                className={`snap-start shrink-0 w-32 bg-surface-container-lowest border rounded-lg p-sm relative ${
                  c.active
                    ? 'border-primary-container ring-2 ring-primary-container ring-offset-1 ring-offset-background'
                    : 'border-border-low-contrast opacity-90'
                }`}
              >
                {c.active && (
                  <div className="absolute -top-2 -right-2 bg-primary-container text-on-primary-container text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                    Turno
                  </div>
                )}
                <div className="flex items-center gap-xs mb-1">
                  <div className={`w-8 h-8 rounded-full overflow-hidden border border-border-low-contrast flex items-center justify-center ${
                    c.type === 'enemy' ? 'bg-error-container' : 'bg-surface-container-high'
                  }`}>
                    {c.type === 'enemy' ? (
                      <span className="material-symbols-outlined text-on-error-container text-[18px]">visibility</span>
                    ) : (
                      <img className="w-full h-full object-cover" src={c.avatar} alt={c.name} />
                    )}
                  </div>
                  <span className={`font-label-bold truncate ${c.type === 'enemy' ? 'text-error' : ''}`}>{c.name}</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full ${c.type === 'enemy' ? 'bg-error' : c.hp / c.maxHp > 0.5 ? 'bg-success-active' : 'bg-gm-amber'}`}
                    style={{ width: `${(c.hp / c.maxHp) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-on-surface-variant mt-1 text-right">{c.hp}/{c.maxHp}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-lg">
          <div className="bg-surface-container-lowest border border-border-low-contrast rounded-xl shadow-sm overflow-hidden">
            <div className="bg-surface-subtle p-md border-b border-border-low-contrast flex justify-between items-center">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full border-2 border-primary-container overflow-hidden">
                  <img className="w-full h-full object-cover" src="https://picsum.photos/seed/grommet/100/100" alt="Grommet" />
                </div>
                <div>
                  <h3 className="font-headline-md">Grommet</h3>
                  <p className="font-label-sm text-on-surface-variant">Guerrero Enano &bull; Lvl 5</p>
                </div>
              </div>
              <div className="bg-primary-fixed text-on-primary-fixed-variant px-3 py-1 rounded-full flex items-center gap-1 border border-primary-fixed-dim">
                <span className="material-symbols-outlined text-[14px]">flare</span>
                <span className="font-label-sm font-bold">Bendecido</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border-low-contrast">
              <div className="p-md flex flex-col items-center justify-center bg-surface-container-lowest">
                <span className="material-symbols-outlined text-hp-danger mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                <div className="font-stat-number text-on-background flex items-baseline gap-1">
                  45<span className="font-headline-md text-on-surface-variant">/68</span>
                </div>
                <div className="font-label-sm text-on-surface-variant uppercase tracking-wider mt-1">Puntos de Golpe</div>
                <div className="w-3/4 h-1 bg-surface-container-high rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-success-active" style={{ width: '66%' }} />
                </div>
              </div>
              <div className="p-md flex flex-col items-center justify-center bg-surface-container-lowest">
                <span className="material-symbols-outlined text-primary mb-1">security</span>
                <div className="font-stat-number text-on-background">18</div>
                <div className="font-label-sm text-on-surface-variant uppercase tracking-wider mt-1">Clase de Armadura</div>
                <div className="text-[10px] text-on-surface-variant mt-2 text-center bg-surface-subtle px-2 py-1 rounded">Cota de Malla + Escudo</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-sm">
            <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Registro de Combate</h2>
            <button className="font-label-sm text-primary flex items-center gap-1">
              Ver Todo <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
          </div>
          <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-2 flex flex-col gap-1">
            {log.map((entry, i) => (
              <div key={i} className="p-2 rounded bg-surface-container-lowest border border-border-low-contrast flex gap-3 items-start relative overflow-hidden">
                {entry.type === 'player' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-success-active" />}
                <span className={`material-symbols-outlined mt-0.5 text-[18px] ${entry.type === 'enemy' ? 'text-error' : 'text-success-active'}`}>
                  {entry.type === 'enemy' ? 'visibility' : 'swords'}
                </span>
                <div className="pl-1">
                  <p className="font-body-md text-on-background">
                    <span className={`font-bold ${entry.type === 'enemy' ? 'text-error' : ''}`}>{entry.actor}</span> {entry.action} <span className="font-bold">{entry.target}</span>
                    {entry.detail && <> <span className="font-bold text-primary">{entry.detail}</span></>}.</p>
                  <span className="font-label-sm text-on-surface-variant">{entry.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 pb-safe h-16 bg-surface border-t border-border-low-contrast shadow-sm rounded-t-xl">
        <Link to={`/campaign/${campaignId}`} className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-lg px-3 py-1">
          <span className="material-symbols-outlined">swords</span>
          <span className="font-label-sm mt-1">Ataques</span>
        </Link>
        <Link to={`/campaign/${campaignId}/character/0/spells`} className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1 hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined">magic_button</span>
          <span className="font-label-sm mt-1">Hechizos</span>
        </Link>
        <Link to={`/campaign/${campaignId}/character/0/inventory`} className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1 hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined">backpack</span>
          <span className="font-label-sm mt-1">Objetos</span>
        </Link>
        <Link to={`/campaign/${campaignId}/gm/combat`} className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1 hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined">bolt</span>
          <span className="font-label-sm mt-1">Acciones</span>
        </Link>
      </nav>
    </div>
  );
}
