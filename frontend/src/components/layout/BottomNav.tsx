import { useEffect, useState } from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import { characterApi } from '../../services/api';
import { useAuth } from '../../lib/hooks';

export function BottomNav() {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const location = useLocation();
  const { user, isDM } = useAuth();
  const [characterId, setCharacterId] = useState<string | number>('new');

  useEffect(() => {
    if (!campaignId || !user) return;
    characterApi.listByCampaign(campaignId)
      .then((res) => {
        const myChar = res.data?.find((ch: any) => ch.user_id === user.id);
        if (myChar) {
          setCharacterId(myChar.id);
        } else {
          setCharacterId('new');
        }
      })
      .catch(() => {
        setCharacterId('new');
      });
  }, [campaignId, user]);

  if (!campaignId) return null;

  const baseItems = [
    { to: `/campaign/${campaignId}`, icon: 'map', label: 'Plot' },
    { to: `/campaign/${campaignId}/character/${characterId}`, icon: 'person', label: 'Sheet', iconFilled: true },
    { to: `/campaign/${campaignId}/combat`, icon: 'swords', label: 'Combat' },
    { to: `/campaign/${campaignId}/chat`, icon: 'forum', label: 'Chat' },
    { to: `/campaign/${campaignId}/market`, icon: 'storefront', label: 'Market' },
  ];

  const gmItems = [
    { to: `/campaign/${campaignId}/gm`, icon: 'admin_panel_settings', label: 'GM', iconFilled: true },
  ];

  const navItems = isDM ? [...baseItems, ...gmItems] : baseItems;

  return (
    <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-xs py-sm bg-surface border-t border-border-low-contrast pb-safe md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center w-16 h-14 ${
              isActive
                ? 'bg-primary-container text-on-primary-container rounded-xl px-4 py-1 scale-95'
                : 'text-on-surface-variant hover:bg-surface-container-high rounded-lg px-3 py-1 transition-colors'
            }`}
          >
            <span
              className="material-symbols-outlined mb-1"
              style={{ fontVariationSettings: item.iconFilled && isActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
            <span className="font-label-sm">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
