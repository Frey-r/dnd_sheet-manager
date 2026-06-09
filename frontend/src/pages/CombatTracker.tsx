import { useParams, Link } from 'react-router-dom';

export function CombatTracker() {
  const { campaignId } = useParams();

  const combatants = [
    { name: 'Kaelen el Rápido', init: 18, hp: 45, maxHp: 45, type: 'Jugador', active: true },
    { name: 'Goblin Jefe', init: 15, hp: 12, maxHp: 30, type: 'Enemigo', active: false },
    { name: 'Lyra la Sabia', init: 12, hp: 22, maxHp: 28, type: 'Jugador', active: false },
    { name: 'Arquero Goblin', init: 8, hp: 7, maxHp: 7, type: 'Enemigo', active: false },
  ];

  const party = [
    { name: 'Kaelen', class: 'Pícaro', level: 4, hp: 45, maxHp: 45 },
    { name: 'Lyra', class: 'Mago', level: 4, hp: 22, maxHp: 28 },
    { name: 'Grok', class: 'Bárbaro', level: 4, hp: 8, maxHp: 55, danger: true },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center px-4 h-16 bg-surface border-b border-border-low-contrast sticky top-0 z-40 md:hidden">
        <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold">Combate</h1>
        <span className="font-label-bold text-primary">Ronda 4</span>
      </header>

      <header className="hidden md:flex justify-between items-center px-10 h-16 bg-surface border-b border-border-low-contrast sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <h1 className="font-headline-md text-on-surface font-bold">Campaign Console</h1>
          <nav className="flex gap-4">
            <Link to={`/campaign/${campaignId}/gm/combat`} className="font-label-bold text-primary bg-primary-fixed px-3 py-1 rounded">Combat</Link>
            <Link to={`/campaign/${campaignId}/gm/npcs`} className="font-label-bold text-on-surface-variant hover:text-on-surface px-3 py-1 rounded transition-colors">NPCs</Link>
            <Link to={`/campaign/${campaignId}/gm/party`} className="font-label-bold text-on-surface-variant hover:text-on-surface px-3 py-1 rounded transition-colors">Party</Link>
            <Link to={`/campaign/${campaignId}/gm/events`} className="font-label-bold text-on-surface-variant hover:text-on-surface px-3 py-1 rounded transition-colors">Events</Link>
          </nav>
        </div>
        <div className="text-on-surface-variant font-label-bold">Ronda 4</div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 max-w-7xl mx-auto w-full">
        <section className="flex gap-3 overflow-x-auto no-scrollbar pb-4">
          <button className="flex-none flex items-center gap-2 bg-primary-container text-on-primary-container px-4 py-3 rounded-lg font-label-bold hover:bg-surface-tint transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px]">casino</span>
            Tirada Secreta
          </button>
          <button className="flex-none flex items-center gap-2 bg-surface-container-lowest border border-border-low-contrast text-on-surface px-4 py-3 rounded-lg font-label-bold hover:bg-surface-subtle transition-colors">
            <span className="material-symbols-outlined text-[18px]">shuffle</span>
            Encuentro Aleatorio
          </button>
          <button className="flex-none flex items-center gap-2 bg-surface-container-lowest border border-border-low-contrast text-on-surface px-4 py-3 rounded-lg font-label-bold hover:bg-surface-subtle transition-colors">
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            Añadir Nota
          </button>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          <section className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <h2 className="font-headline-md text-on-surface">Orden de Iniciativa</h2>
              <span className="font-label-bold text-on-surface-variant uppercase">Ronda 4</span>
            </div>
            <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg overflow-hidden shadow-sm">
              {combatants.map((c) => (
                <div
                  key={c.name}
                  className={`p-4 flex items-center justify-between border-b border-border-low-contrast last:border-0 ${
                    c.active ? 'bg-surface-subtle border-l-4 border-l-primary' : 'hover:bg-surface-bright'
                  } transition-colors`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg border border-border-low-contrast flex items-center justify-center font-stat-number text-2xl font-bold ${
                      c.active ? 'bg-surface-container-high text-on-surface' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {c.init}
                    </div>
                    <div>
                      <h3 className="font-label-bold text-body-lg font-bold text-on-surface">
                        {c.name}
                        {c.active && (
                          <span className="ml-2 bg-primary text-on-primary text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-bl-lg font-label-bold">
                            Turno Actual
                          </span>
                        )}
                      </h3>
                      <p className="font-body-md text-label-sm flex items-center gap-1 mt-1">
                        <span className={`w-2 h-2 rounded-full inline-block ${c.type === 'Enemigo' ? 'bg-hp-danger' : 'bg-success-active'}`} />
                        {c.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 w-24">
                    <span className="font-label-bold text-label-sm text-on-surface">{c.hp} / {c.maxHp} PV</span>
                    <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${c.type === 'Enemigo' ? 'bg-hp-danger' : c.hp / c.maxHp > 0.7 ? 'bg-success-active' : 'bg-gm-amber'}`}
                        style={{ width: `${(c.hp / c.maxHp) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button className="w-full py-3 text-on-surface-variant font-label-bold text-label-sm hover:bg-surface-container transition-colors flex items-center justify-center gap-1 border border-dashed border-border-low-contrast rounded-b-lg">
                <span className="material-symbols-outlined text-[16px]">add</span> Añadir Combatiente
              </button>
            </div>
          </section>

          <section className="lg:col-span-5 flex flex-col gap-4">
            <h2 className="font-headline-md text-on-surface">Estado del Grupo</h2>
            <div className="grid grid-cols-2 gap-4">
              {party.map((m) => (
                <div key={m.name} className={`bg-surface-container-lowest border rounded-lg p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow ${m.danger ? 'border-hp-danger' : 'border-border-low-contrast'}`}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full bg-surface-container border border-border-low-contrast flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant">shield</span>
                    </div>
                    <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full font-label-bold text-[10px] uppercase">Nv {m.level}</span>
                  </div>
                  <div>
                    <h4 className="font-label-bold text-body-md font-bold text-on-surface truncate">{m.name}</h4>
                    <p className="font-body-md text-label-sm text-on-surface-variant">{m.class}</p>
                  </div>
                  <div className="mt-auto pt-2">
                    <div className="flex justify-between items-end mb-1">
                      <span className={`font-label-bold text-[10px] uppercase ${m.danger ? 'text-hp-danger font-bold' : 'text-on-surface-variant'}`}>
                        {m.danger ? '¡Peligro!' : 'Salud'}
                      </span>
                      <span className={`font-stat-number text-label-bold ${m.danger ? 'text-hp-danger' : 'text-success-active'}`}>{m.hp}</span>
                    </div>
                    <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.danger ? 'bg-hp-danger' : 'bg-success-active'}`} style={{ width: `${(m.hp / m.maxHp) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              <button className="bg-surface-container-lowest border border-dashed border-border-low-contrast rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:bg-surface-subtle transition-colors text-on-surface-variant min-h-[140px]">
                <span className="material-symbols-outlined text-[24px]">person_add</span>
                <span className="font-label-bold text-label-sm">Añadir Jugador</span>
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}