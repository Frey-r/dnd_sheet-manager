import { NavLink, useParams, useLocation } from 'react-router-dom';
import type { UserRole } from '../../types';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  iconFilled?: boolean;
  gmOnly?: boolean;
  adminOnly?: boolean;
  disabled?: boolean;
}

function buildNavItems(campaignId?: string): NavItem[] {
  const c = campaignId ? `/campaign/${campaignId}` : '';
  const hasCampaign = !!campaignId;
  return [
    { to: '/campaigns', icon: 'groups', label: 'Campaigns' },
    { to: c || '/campaigns', icon: 'person', label: 'Character Hub', iconFilled: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/combat` : '/campaigns', icon: 'swords', label: 'Combat', gmOnly: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/npcs` : '/campaigns', icon: 'groups', label: 'NPCs', gmOnly: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/bestiary` : '/campaigns', icon: 'pets', label: 'Bestiary', gmOnly: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/maps` : '/campaigns', icon: 'map', label: 'Maps', gmOnly: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/events` : '/campaigns', icon: 'event_note', label: 'Events', gmOnly: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/notes` : '/campaigns', icon: 'edit_note', label: 'Notes', gmOnly: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/lore` : '/campaigns', icon: 'menu_book', label: 'Lore Editor', gmOnly: true, disabled: !hasCampaign },
    { to: c ? `${c}/gm/bot` : '/campaigns', icon: 'smart_toy', label: 'Bot Manager', gmOnly: true, disabled: !hasCampaign },
    { to: '/settings', icon: 'settings', label: 'Settings' },
  ];
}

interface SideNavProps {
  username?: string;
  campaignName?: string;
  version?: string;
  isGM?: boolean;
  userRole?: UserRole;
}

const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  dm: 'Dungeon Master',
  player: 'Jugador',
};

const roleBadgeClass: Record<UserRole, string> = {
  admin: 'bg-error-container text-on-error-container',
  dm: 'bg-primary-container text-on-primary-container',
  player: 'bg-surface-container text-on-surface-variant',
};

const avatarInitial: Record<UserRole, string> = {
  admin: 'A',
  dm: 'DM',
  player: 'P',
};

export function SideNav({ username = 'Guest', campaignName, version = 'v2.4.0', isGM = false, userRole = 'player' }: SideNavProps) {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const location = useLocation();
  const navItems = buildNavItems(campaignId);

  const filteredNav = navItems.filter((item) => {
    if (item.gmOnly && !isGM) return false;
    if (item.adminOnly && userRole !== 'admin') return false;
    return true;
  });

  return (
    <nav className="hidden md:flex flex-col h-full w-72 bg-surface-container-lowest border-r border-border-low-contrast shadow-md fixed left-0 top-0 z-40 overflow-y-auto p-4">
      <div className="mb-6 pb-4 border-b border-border-low-contrast">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-bold text-xs">
            {avatarInitial[userRole]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-label-bold text-on-surface truncate">{username}</div>
            {campaignName && (
              <div className="font-label-sm text-on-surface-variant truncate">{campaignName}</div>
            )}
            {!campaignId && (
              <div className="font-label-sm text-outline">Select a campaign</div>
            )}
          </div>
        </div>
        {/* Role badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${roleBadgeClass[userRole]}`}>
          {roleLabel[userRole]}
        </span>
        <div className="font-label-sm text-secondary mt-2">{version}</div>
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {filteredNav.map((item) => {
          const isActive = item.to !== '/' && location.pathname === item.to ||
            item.to !== '/' && location.pathname.startsWith(item.to + '/') ||
            item.to === '/' && location.pathname === '/';

          if (item.disabled) {
            return (
              <div
                key={item.to + item.label}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant/40 cursor-not-allowed select-none"
                title="Selecciona una campaña primero"
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-body-md">{item.label}</span>
                <span className="material-symbols-outlined text-xs ml-auto opacity-50">lock</span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-surface-container text-primary font-bold border-l-4 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-subtle'
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={item.iconFilled && isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="font-body-md">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
