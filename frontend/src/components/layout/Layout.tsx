import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { TopAppBar } from './TopAppBar';
import { DiceRoller } from './DiceRoller';
import { OfferDesk } from '../market/OfferDesk';
import { useCampaign } from '../../lib/useCampaign';
import { applyTheme, currentTheme, type Theme } from '../../lib/theme';

export function Layout() {
  const { pathname } = useLocation();
  const campaignId = pathname.match(/^\/campaign\/(\d+)/)?.[1];
  const { campaign, myCharacter, isGM, isFoundry } = useCampaign(campaignId);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('nav-collapsed') === '1'; } catch { return false; } });
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const fullBleed = /\/(table|chat)$/.test(pathname) || /^\/campaign\/\d+\/lore$/.test(pathname);

  useEffect(() => { try { localStorage.setItem('nav-collapsed', collapsed ? '1' : '0'); } catch { /* ignore */ } }, [collapsed]);

  const cycleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'contrast' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SideNav campaignId={campaignId} campaign={campaign} myCharacterId={myCharacter?.id} isGM={isGM} collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)} onCycleTheme={cycleTheme}
        themeIcon={theme === 'light' ? 'light_mode' : theme === 'contrast' ? 'contrast' : 'dark_mode'} />
      <div className={`flex min-h-screen flex-col pb-[66px] md:pb-0 ${collapsed ? 'md:ml-[68px]' : 'md:ml-[252px]'}`}>
        <TopAppBar campaign={campaign} isGM={isGM} />
        <main className={fullBleed ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pt-7'}>
          <Outlet />
        </main>
      </div>
      <BottomNav campaignId={campaignId} myCharacterId={myCharacter?.id} isGM={isGM} isFoundry={isFoundry} />
      {campaignId && <DiceRoller isGM={isGM} />}
      {campaignId && isGM && <OfferDesk campaignId={campaignId} />}
    </div>
  );
}
