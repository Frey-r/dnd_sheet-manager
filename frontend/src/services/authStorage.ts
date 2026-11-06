import type { User } from '../types';

export function getAuthToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}
export function getRefreshToken() {
  return sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');
}
export function getStoredUser(): User | null {
  const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}
export function saveAuth(user: User, token: string, refreshToken: string, remember: boolean) {
  clearAuth();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem('user', JSON.stringify(user));
  storage.setItem('token', token);
  storage.setItem('refresh_token', refreshToken);
}
export function clearAuth() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('user');
    storage.removeItem('token');
    storage.removeItem('refresh_token');
  }
}
