import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import { AuthContext } from './AuthContext';
import { authApi } from '../services/api';
import { clearAuth, getAuthToken, getStoredUser, saveAuth } from '../services/authStorage';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(getStoredUser);
  const [token, setToken] = useState<string | null>(getAuthToken);
  const logout = useCallback(() => {
    const refreshToken = sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');
    if (refreshToken) void authApi.logout(refreshToken).catch(() => undefined);
    clearAuth();
    setUserState(null);
    setToken(null);
  }, []);
  useEffect(() => {
    const handleExpired = () => { clearAuth(); setUserState(null); setToken(null); };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);
  const value = useMemo(() => {
    const role = user?.role ?? 'player';
    return {
      user, token, role,
      isAuthenticated: Boolean(token), isAdmin: role === 'admin', isDM: role === 'admin' || role === 'dm', isPlayer: role === 'player',
      login: (nextUser: User, nextToken: string, refreshToken = '', remember = true) => {
        saveAuth(nextUser, nextToken, refreshToken, remember);
        setUserState(nextUser); setToken(nextToken);
      },
      logout,
      setUser: (nextUser: User) => {
        setUserState(nextUser);
        const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(nextUser));
      },
    };
  }, [user, token, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
