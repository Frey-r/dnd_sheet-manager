import { useParams, Link } from 'react-router-dom';

export function NPCDetail() {
  const { campaignId } = useParams();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface-container-lowest border-b border-border-low-contrast flex items-center justify-between px-4 h-16 w-full">
        <Link to={`/campaign/${campaignId}/gm/npcs`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold">Strahd von Zarovich</h1>
        <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">edit</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 md:px-10 py-lg grid grid-cols-1 lg:grid-cols-12 gap-lg md:gap-xl">
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col gap-lg">
          <section className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-lg flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-surface-variant/40 to-transparent" />
            <div className="w-32 h-32 rounded-full border-4 border-surface-container-lowest shadow-sm z-10 overflow-hidden bg-surface-container-highest mb-md">
              <img className="w-full h-full object-cover" src="https://picsum.photos/seed/strahd/200/200" alt="Strahd" />
            </div>
            <h2 className="font-headline-lg text-on-surface font-bold z-10">Strahd von Zarovich</h2>
            <p className="font-body-md text-secondary mt-xs z-10 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              Noble Vampire
            </p>
            <div className="flex flex-wrap gap-2 mt-md justify-center z-10">
              <span className="px-3 py-1 bg-surface-subtle border border-border-low-contrast rounded-full font-label-bold text-[11px] text-on-surface uppercase tracking-wider">Undead</span>
              <span className="px-3 py-1 bg-surface-subtle border border-border-low-contrast rounded-full font-label-bold text-[11px] text-on-surface uppercase tracking-wider">Medium</span>
              <span className="px-3 py-1 bg-surface-subtle border border-border-low-contrast rounded-full font-label-bold text-[11px] text-on-surface uppercase tracking-wider">CR 15</span>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-sm">
            <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-md flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-outline mb-xs">shield</span>
              <span className="font-stat-number font-bold text-on-surface leading-none">16</span>
              <span className="font-label-bold text-[10px] text-secondary uppercase tracking-widest mt-1">Armor Class</span>
            </div>
            <div className="bg-surface-container-lowest border border-hp-danger/20 rounded-lg p-md flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-hp-danger/5" />
              <span className="material-symbols-outlined text-hp-danger mb-xs z-10">favorite</span>
              <span className="font-stat-number font-bold text-hp-danger leading-none z-10">144</span>
              <span className="font-label-bold text-[10px] text-hp-danger uppercase tracking-widest mt-1 z-10">Hit Points</span>
            </div>
            <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-md flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-outline mb-xs">speed</span>
              <span className="font-stat-number font-bold text-on-surface leading-none">30<span className="text-sm font-body-md text-secondary ml-1">ft</span></span>
              <span className="font-label-bold text-[10px] text-secondary uppercase tracking-widest mt-1">Speed</span>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-md">
            <h3 className="font-label-bold text-secondary uppercase tracking-widest border-b border-border-low-contrast pb-2 mb-md">Attributes</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: 'STR', score: 18, mod: '+4', highlight: false },
                { name: 'DEX', score: 18, mod: '+4', highlight: false },
                { name: 'CON', score: 18, mod: '+4', highlight: false },
                { name: 'INT', score: 20, mod: '+5', highlight: true },
                { name: 'WIS', score: 15, mod: '+2', highlight: false },
                { name: 'CHA', score: 18, mod: '+4', highlight: false },
              ].map((stat) => (
                <div key={stat.name} className={`rounded border p-2 flex flex-col items-center justify-center ${
                  stat.highlight
                    ? 'bg-surface-subtle border-primary/20 relative overflow-hidden'
                    : 'bg-surface-subtle border-border-low-contrast/50'
                }`}>
                  {stat.highlight && <div className="absolute top-0 right-0 w-8 h-8 bg-primary/5 rounded-bl-full" />}
                  <span className={`font-label-bold text-[10px] uppercase ${stat.highlight ? 'text-primary' : 'text-secondary'}`}>{stat.name}</span>
                  <span className={`font-headline-md font-bold my-1 ${stat.highlight ? 'text-primary' : 'text-on-surface'}`}>{stat.score}</span>
                  <span className={`rounded text-[11px] font-bold px-2 py-0.5 ${
                    stat.highlight
                      ? 'bg-primary/10 border border-primary/20 text-primary'
                      : 'bg-surface-container border border-border-low-contrast text-on-surface'
                  }`}>{stat.mod}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 flex flex-col gap-lg">
          <section className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-lg">
            <div className="flex items-center gap-2 mb-md pb-2 border-b border-border-low-contrast">
              <span className="material-symbols-outlined text-secondary">psychology</span>
              <h3 className="font-label-bold text-secondary uppercase tracking-widest">Traits &amp; Abilities</h3>
            </div>
            <div className="flex flex-col divide-y divide-border-low-contrast">
              {[
                { name: 'Regeneration', tag: 'Passive', tagClass: 'bg-success-active/10 text-success-active', desc: 'Strahd regains 20 hit points at the start of his turn if he has at least 1 hit point and isn\'t in sunlight or running water.' },
                { name: 'Legendary Resistance', tag: '3/Day', tagClass: 'bg-surface-container border border-border-low-contrast text-on-surface', desc: 'If Strahd fails a saving throw, he can choose to succeed instead.' },
                { name: 'Shapechanger', tag: 'Action', tagClass: 'bg-primary/10 text-primary', desc: 'Strahd can use his action to polymorph into a Tiny bat, a Medium wolf, or a Medium cloud of mist.' },
              ].map((trait) => (
                <div key={trait.name} className="py-sm">
                  <h4 className="font-label-bold text-on-surface mb-1 flex items-center gap-2">
                    {trait.name}
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${trait.tagClass}`}>{trait.tag}</span>
                  </h4>
                  <p className="font-body-md text-on-surface-variant">{trait.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-lg">
            <div className="flex items-center justify-between mb-md pb-2 border-b border-border-low-contrast">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">swords</span>
                <h3 className="font-label-bold text-secondary uppercase tracking-widest">Actions</h3>
              </div>
              <span className="text-[12px] text-secondary font-body-md">Multiattack: Unarmed Strike, Bite</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-md hover:border-outline-variant transition-colors cursor-pointer">
                <h4 className="font-label-bold text-on-surface mb-2">Bite (Bat or Vampire Form)</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-surface-container border border-border-low-contrast rounded px-2 py-1 text-[12px] font-bold text-on-surface">+9 to hit</span>
                  <span className="bg-surface-container border border-border-low-contrast rounded px-2 py-1 text-[12px] font-bold text-on-surface">Reach 5 ft</span>
                </div>
                <p className="font-body-md text-on-surface-variant">
                  <span className="font-bold text-on-surface">Hit:</span> 7 (1d6 + 4) piercing damage plus 10 (3d6) necrotic damage.
                </p>
              </div>
              <div className="bg-surface-subtle border border-border-low-contrast rounded-lg p-md hover:border-outline-variant transition-colors cursor-pointer">
                <h4 className="font-label-bold text-on-surface mb-2">Charm</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-primary/10 border border-primary/20 text-primary rounded px-2 py-1 text-[12px] font-bold">DC 17 WIS Save</span>
                  <span className="bg-surface-container border border-border-low-contrast rounded px-2 py-1 text-[12px] font-bold text-on-surface">30 ft</span>
                </div>
                <p className="font-body-md text-on-surface-variant">
                  Strahd targets one humanoid he can see within 30 feet. The target must succeed on a DC 17 Wisdom saving throw or be charmed.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-lg">
            <div className="flex items-center gap-2 mb-md pb-2 border-b border-border-low-contrast">
              <span className="material-symbols-outlined text-secondary">history_edu</span>
              <h3 className="font-label-bold text-secondary uppercase tracking-widest">Lore &amp; GM Notes</h3>
            </div>
            <p className="font-body-md text-on-surface-variant leading-relaxed">
              Master of Castle Ravenloft and the darklord of Barovia. He is a tragic and ruthless figure, bound to his land by dark powers. In combat, he relies on hit-and-run tactics, phasing through the walls of his castle to regenerate.
            </p>
          </section>

          <div className="flex flex-col sm:flex-row gap-sm mt-md">
            <button className="flex-1 h-12 rounded-lg bg-primary-container text-on-primary font-label-bold flex items-center justify-center gap-2 hover:bg-surface-tint transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[20px]">add</span> Añadir a Combate
            </button>
            <button className="flex-1 h-12 rounded-lg bg-surface-container-highest text-on-surface font-label-bold flex items-center justify-center gap-2 hover:bg-surface-variant transition-colors border border-border-low-contrast">
              <span className="material-symbols-outlined text-[20px]">edit</span> Editar NPC
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
