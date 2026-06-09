import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useAuth } from '../../lib/hooks';

export function Layout() {
  const { user, isDM, role } = useAuth();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <SideNav
        username={user?.username || 'Guest'}
        version="v2.4.0"
        userRole={role}
        isGM={isDM}
      />
      <div className="flex-1 md:ml-72 flex flex-col min-h-screen pb-20 md:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}