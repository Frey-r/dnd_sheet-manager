import { useState, useCallback } from 'react';
import type { UserRole } from '../types';

type ToastType = 'success' | 'error' | 'info' | 'trade' | 'message';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

interface StoredUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export function useAuth() {
  const [user, setUser] = useState<StoredUser | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  const login = useCallback((userData: StoredUser, authToken: string) => {
    // Ensure we always have a role, defaulting to 'player' for legacy tokens
    const userWithRole: StoredUser = { ...userData, role: userData.role ?? 'player' };
    setUser(userWithRole);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userWithRole));
    localStorage.setItem('token', authToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  const role: UserRole = user?.role ?? 'player';

  return {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
    role,
    isAdmin: role === 'admin',
    isDM: role === 'admin' || role === 'dm',   // admin can do everything a DM can
    isPlayer: role === 'player',
  };
}
