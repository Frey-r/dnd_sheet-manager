import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { campaignNav } from '../../lib/nav';

export function BottomNav({ campaignId, myCharacterId, isGM, isFoundry }: { campaignId?: string; myCharacterId?: number; isGM: boolean; isFoundry: boolean }) {
  const [open, setOpen] = useState(false);
  if (!campaignId) return null;
  const nav = campaignNav(campaignId, myCharacterId, isGM, isFoundry);
  const c = `/campaign/${campaignId}`;
  const items = [
    { to: c, icon: 'home', label: 'Hub', end: true },
    { to: `${c}/table`, icon: 'grid_on', label: 'Mesa' },
    isGM ? { to: `${c}/gm`, icon: 'shield_person', label: 'Consola', end: true } : { to: nav.play[2].to, icon: 'badge', label: 'Hoja' },
    { to: `${c}/chat`, icon: 'forum', label: 'Chat' },
  ];
  const link = 'flex flex-col items-center justify-center gap-1 text-[11px] font-medium';
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-[66px] grid-cols-5 border-t border-line bg-[color-mix(in_srgb,var(--bg-elev)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `${link} ${isActive ? 'text-accent' : 'text-muted'}`}>
            <span className="material-symbols-outlined text-[21px]">{i.icon}</span>{i.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setOpen(true)} className={`${link} text-muted`}><span className="material-symbols-outlined text-[21px]">menu</span>Más</button>
      </nav>
      {open && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg p-4 pb-24 md:hidden" role="dialog" aria-label="Menú">
          <div className="mb-3 flex items-center"><b className="text-lg">Menú</b><button type="button" onClick={() => setOpen(false)} className="mc-btn mc-btn-ghost mc-btn-icon ml-auto" aria-label="Cerrar menú"><span className="material-symbols-outlined">close</span></button></div>
          {[['Partida', nav.play], ['Dirección', nav.gm], ['Cuenta', [{ to: '/campaigns', icon: 'dashboard', label: 'Mis campañas', end: true }, { to: '/settings', icon: 'settings', label: 'Ajustes y perfil' }]]].map(([title, list]) =>
            (list as typeof nav.play).length ? (
              <div key={title as string} className="mb-3">
                <div className="mc-eyebrow px-3 py-2">{title as string}</div>
                {(list as typeof nav.play).map((e) => (
                  <NavLink key={e.to} to={e.to} end={e.end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] ${isActive ? 'bg-card-2 text-ink' : 'text-ink-2'}`}>
                    <span className="material-symbols-outlined text-muted">{e.icon}</span>{e.label}
                  </NavLink>
                ))}
              </div>
            ) : null)}
        </div>
      )}
    </>
  );
}
