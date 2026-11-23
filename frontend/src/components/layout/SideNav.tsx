import { NavLink } from 'react-router-dom';
import type { CampaignSummary } from '../../lib/useCampaign';
import { campaignNav, type NavEntry } from '../../lib/nav';

function Item({ entry }: { entry: NavEntry }) {
  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      title={entry.label}
      className={({ isActive }) => `group relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13.5px] font-medium whitespace-nowrap transition-colors ${
        isActive ? 'bg-card-2 text-ink' : 'text-ink-2 hover:bg-card-2 hover:text-ink'}`}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-2.5 top-[7px] bottom-[7px] w-[3px] rounded-r bg-accent" />}
          <span className={`material-symbols-outlined text-[19px] ${isActive ? 'text-accent' : 'text-muted'}`}>{entry.icon}</span>
          <span className="nav-label">{entry.label}</span>
        </>
      )}
    </NavLink>
  );
}

function Label({ children, gm }: { children: React.ReactNode; gm?: boolean }) {
  return (
    <div className="nav-label flex items-center gap-1.5 px-2.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[.06em] text-faint">
      {children}{gm && <span className="rounded-full bg-gold-soft px-1.5 text-[10px] text-gold">DM</span>}
    </div>
  );
}

interface SideNavProps {
  campaignId?: string;
  campaign?: CampaignSummary;
  myCharacterId?: number;
  isGM: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCycleTheme: () => void;
  themeIcon: string;
}

export function SideNav({ campaignId, campaign, myCharacterId, isGM, collapsed, onToggleCollapse, onCycleTheme, themeIcon }: SideNavProps) {
  const nav = campaignId ? campaignNav(campaignId, myCharacterId, isGM, campaign?.game_mode === 'foundry') : null;
  return (
    <aside className={`hidden md:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-line bg-bg-elev transition-[width] ${collapsed ? 'w-[68px] sidenav-collapsed' : 'w-[252px]'}`}>
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accent text-accent-ink">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth={2} strokeLinejoin="round"><path d="M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3z" /><path d="M12 2.5 7.5 15h9z" /></svg>
        </span>
        <b className="nav-label whitespace-nowrap text-[15px] font-semibold tracking-tight">Mesa de Ceniza <span className="font-medium text-muted">· D&amp;D</span></b>
      </div>
      {campaign && (
        <NavLink to="/campaigns" title="Cambiar de campaña" className="mx-3 mb-1 mt-3 flex items-center gap-2.5 rounded-lg border border-line bg-card p-2.5 transition-colors hover:border-line-strong hover:bg-card-2">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-md bg-accent-soft font-display text-[15px] font-semibold text-accent">{campaign.name.slice(0, 1)}</span>
          <span className="nav-label min-w-0">
            <b className="block truncate text-[13px] font-semibold">{campaign.name}</b>
            <small className="text-xs text-muted">{isGM ? 'Diriges' : 'Juegas'} · {campaign.game_mode === 'foundry' ? 'Foundry' : 'Mesa local'}</small>
          </span>
        </NavLink>
      )}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        {nav ? (
          <>
            <Label>Partida</Label>
            {nav.play.map((e) => <Item key={e.to} entry={e} />)}
            {nav.gm.length > 0 && <><Label gm>Dirección</Label>{nav.gm.map((e) => <Item key={e.to} entry={e} />)}</>}
            <Label>Cuenta</Label>
          </>
        ) : <Label>General</Label>}
        <Item entry={{ to: '/campaigns', icon: 'dashboard', label: 'Mis campañas', end: true }} />
        <Item entry={{ to: '/settings', icon: 'settings', label: 'Ajustes y perfil' }} />
        {!campaignId && (
          <p className="nav-label mx-1 mt-4 rounded-lg border border-dashed border-line-strong p-3 text-[12.5px] text-muted">Entra a una campaña para ver la mesa, tu hoja y las herramientas de juego.</p>
        )}
      </nav>
      <div className="flex gap-1.5 border-t border-line p-2.5">
        <button type="button" onClick={onToggleCollapse} className="mc-btn mc-btn-ghost mc-btn-sm mc-btn-icon" aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'}>
          <span className="material-symbols-outlined text-[19px]">{collapsed ? 'left_panel_open' : 'left_panel_close'}</span>
        </button>
        <button type="button" onClick={onCycleTheme} className="mc-btn mc-btn-ghost mc-btn-sm mc-btn-icon" aria-label="Cambiar tema">
          <span className="material-symbols-outlined text-[19px]">{themeIcon}</span>
        </button>
      </div>
    </aside>
  );
}
