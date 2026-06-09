import { useParams, Link } from 'react-router-dom';

export function GMConsole() {
  const { campaignId } = useParams();

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      {/* TopAppBar */}
      <header className="bg-surface sticky top-0 z-40 flex justify-between items-center px-4 h-16 md:hidden border-b border-border-low-contrast">
        <div className="flex items-center gap-2">
          <Link to={`/campaign/${campaignId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface">Campaign Console</h1>
        </div>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-surface-container">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      {/* Desktop Nav */}
      <header className="hidden md:flex bg-surface-container-lowest sticky top-0 z-40 justify-between items-center px-10 h-16 border-b border-border-low-contrast -mx-4 md:-mx-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-container overflow-hidden border border-border-low-contrast flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
          </div>
        </div>
        <div className="flex-1 text-center">
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">Campaign Console</h1>
        </div>
        <nav className="flex items-center gap-2 lg:gap-4 flex-wrap">
          <Link to={`/campaign/${campaignId}/gm/combat`} className="font-label-bold text-label-bold text-primary font-bold px-3 py-1 rounded bg-primary-fixed bg-opacity-20">Combat</Link>
          <Link to={`/campaign/${campaignId}/gm/npcs`} className="font-label-bold text-label-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded transition-colors">NPCs</Link>
          <Link to={`/campaign/${campaignId}/gm/party`} className="font-label-bold text-label-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded transition-colors">Party</Link>
          <Link to={`/campaign/${campaignId}/gm/bestiary`} className="font-label-bold text-label-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded transition-colors">Bestiary</Link>
          <Link to={`/campaign/${campaignId}/gm/spells-srd`} className="font-label-bold text-label-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded transition-colors">Spells SRD</Link>
          <Link to={`/campaign/${campaignId}/gm/encounter-builder`} className="font-label-bold text-label-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-3 py-1 rounded transition-colors">Builder</Link>
        </nav>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-surface-container">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      <main className="flex-1 px-4 md:px-10 max-w-7xl mx-auto w-full flex flex-col gap-6 md:gap-8 py-4">
        {/* Quick Actions */}
        <section className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0">
          <button className="flex-none flex items-center gap-2 bg-primary-container text-on-primary-container px-4 py-3 rounded-lg font-label-bold text-label-bold hover:bg-surface-tint transition-colors active:scale-95 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">casino</span>
            Tirada Secreta
          </button>
          <Link
            to={`/campaign/${campaignId}/gm/encounter-builder`}
            className="flex-none flex items-center gap-2 bg-surface-container-lowest border border-border-low-contrast text-on-surface px-4 py-3 rounded-lg font-label-bold text-label-bold hover:bg-surface-subtle transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            Encounter Builder
          </Link>
          <button className="flex-none flex items-center gap-2 bg-surface-container-lowest border border-border-low-contrast text-on-surface px-4 py-3 rounded-lg font-label-bold text-label-bold hover:bg-surface-subtle transition-colors active:scale-95">
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            Añadir Nota
          </button>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          {/* Left Column - Initiative Order */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex justify-between items-end mb-2">
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Orden de Iniciativa</h2>
              <span className="font-label-bold text-label-sm text-on-surface-variant uppercase tracking-wider">Ronda 4</span>
            </div>
            <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg overflow-hidden flex flex-col shadow-sm">
              {/* Active Turn */}
              <div className="p-4 bg-surface-subtle border-l-4 border-l-primary border-b border-b-border-low-contrast relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 bg-primary text-on-primary rounded-bl-lg font-label-bold text-[10px] uppercase tracking-widest z-10 shadow-sm">
                  Turno Actual
                </div>
                <div className="flex items-center justify-between z-10 relative">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high border border-border-low-contrast flex items-center justify-center font-stat-number text-stat-number text-on-surface">18</div>
                    <div>
                      <h3 className="font-label-bold text-body-lg font-bold text-on-surface">Kaelen el Rápido</h3>
                      <p className="font-body-md text-label-sm text-on-surface-variant flex items-center gap-1 mt-1">
                        <span className="w-2 h-2 rounded-full bg-success-active inline-block" />
                        Pícaro (Jugador)
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 w-24">
                    <span className="font-label-bold text-label-sm text-on-surface">45 / 45 PV</span>
                    <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-success-active w-full" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Next in line */}
              <div className="p-4 border-b border-b-border-low-contrast hover:bg-surface-bright transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-lg bg-surface-container border border-border-low-contrast flex items-center justify-center font-stat-number text-[20px] font-bold text-on-surface-variant">15</div>
                  <div>
                    <h3 className="font-label-bold text-body-md font-bold text-on-surface">Goblin Jefe</h3>
                    <p className="font-body-md text-label-sm text-hp-danger flex items-center gap-1 mt-1">
                      <span className="w-2 h-2 rounded-full bg-hp-danger inline-block" />
                      Enemigo
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 w-24">
                  <span className="font-label-bold text-label-sm text-on-surface">12 / 30 PV</span>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-hp-danger w-[40%]" />
                  </div>
                </div>
              </div>
              <div className="p-4 border-b border-b-border-low-contrast hover:bg-surface-bright transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-lg bg-surface-container border border-border-low-contrast flex items-center justify-center font-stat-number text-[20px] font-bold text-on-surface-variant">12</div>
                  <div>
                    <h3 className="font-label-bold text-body-md font-bold text-on-surface">Lyra la Sabia</h3>
                    <p className="font-body-md text-label-sm text-on-surface-variant flex items-center gap-1 mt-1">
                      <span className="w-2 h-2 rounded-full bg-success-active inline-block" />
                      Mago (Jugador)
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 w-24">
                  <span className="font-label-bold text-label-sm text-on-surface">22 / 28 PV</span>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-gm-amber w-[78%]" />
                  </div>
                </div>
              </div>
              <div className="p-4 hover:bg-surface-bright transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-lg bg-surface-container border border-border-low-contrast flex items-center justify-center font-stat-number text-[20px] font-bold text-on-surface-variant">08</div>
                  <div>
                    <h3 className="font-label-bold text-body-md font-bold text-on-surface">Arquero Goblin</h3>
                    <p className="font-body-md text-label-sm text-hp-danger flex items-center gap-1 mt-1">
                      <span className="w-2 h-2 rounded-full bg-hp-danger inline-block" />
                      Enemigo
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 w-24">
                  <span className="font-label-bold text-label-sm text-on-surface">7 / 7 PV</span>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-success-active w-full" />
                  </div>
                </div>
              </div>
              <button className="w-full py-3 border border-border-low-contrast rounded-lg text-on-surface-variant font-label-bold text-label-sm hover:bg-surface-container transition-colors flex items-center justify-center gap-1 mt-2">
                <span className="material-symbols-outlined text-[16px]">add</span> Añadir Combatiente
              </button>
            </div>
          </section>

          {/* Right Column - Party Status */}
          <section className="lg:col-span-5 flex flex-col gap-4 mt-0 lg:mt-0">
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Estado del Grupo</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'Kaelen', class: 'Pícaro', level: 4, hp: 45, maxHp: 45, danger: false },
                { name: 'Lyra', class: 'Mago', level: 4, hp: 22, maxHp: 28, danger: false },
                { name: 'Grok', class: 'Bárbaro', level: 4, hp: 8, maxHp: 55, danger: true },
              ].map((member, i) => (
                <div key={i} className={`bg-surface-container-lowest border rounded-lg p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow ${member.danger ? 'border-hp-danger' : 'border-border-low-contrast'}`}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border border-border-low-contrast flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant">shield</span>
                    </div>
                    <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full font-label-bold text-[10px] tracking-wider uppercase">Nv {member.level}</span>
                  </div>
                  <div>
                    <h4 className="font-label-bold text-body-md font-bold text-on-surface truncate">{member.name}</h4>
                    <p className="font-body-md text-label-sm text-on-surface-variant">{member.class}</p>
                  </div>
                  <div className="mt-auto pt-2">
                    <div className="flex justify-between items-end mb-1">
                      <span className={`font-label-bold text-[10px] uppercase ${member.danger ? 'text-hp-danger font-bold' : 'text-on-surface-variant'}`}>
                        {member.danger ? '¡Peligro!' : 'Salud'}
                      </span>
                      <span className={`font-stat-number text-label-bold ${member.danger ? 'text-hp-danger' : 'text-success-active'}`}>{member.hp}</span>
                    </div>
                    <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${member.danger ? 'bg-hp-danger' : 'bg-success-active'}`} style={{ width: `${(member.hp / member.maxHp) * 100}%` }} />
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

      {/* BottomNav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-20 bg-surface-container-lowest border-t border-border-low-contrast shadow-sm">
        <Link to={`/campaign/${campaignId}/gm/combat`} className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-lg px-3 py-1 scale-95 w-16">
          <span className="material-symbols-outlined text-[24px] mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>swords</span>
          <span className="font-label-bold text-[10px] leading-tight tracking-wide">Combat</span>
        </Link>
        <Link to={`/campaign/${campaignId}/gm/npcs`} className="flex flex-col items-center justify-center text-on-secondary-container px-3 py-1 hover:bg-surface-subtle rounded-lg w-16">
          <span className="material-symbols-outlined text-[24px] mb-1">groups</span>
          <span className="font-label-bold text-[10px] leading-tight tracking-wide">NPCs</span>
        </Link>
        <Link to={`/campaign/${campaignId}/gm/party`} className="flex flex-col items-center justify-center text-on-secondary-container px-3 py-1 hover:bg-surface-subtle rounded-lg w-16">
          <span className="material-symbols-outlined text-[24px] mb-1">monitoring</span>
          <span className="font-label-bold text-[10px] leading-tight tracking-wide">Party</span>
        </Link>
        <Link to={`/campaign/${campaignId}/gm/events`} className="flex flex-col items-center justify-center text-on-secondary-container px-3 py-1 hover:bg-surface-subtle rounded-lg w-16">
          <span className="material-symbols-outlined text-[24px] mb-1">event_note</span>
          <span className="font-label-bold text-[10px] leading-tight tracking-wide">Events</span>
        </Link>
      </nav>
    </div>
  );
}