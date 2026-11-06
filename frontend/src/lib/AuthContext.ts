import { createContext } from 'react';
import type { User, UserRole } from '../types';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  role: UserRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDM: boolean;
  isPlayer: boolean;
  login: (user: User, token: string, refreshToken?: string, remember?: boolean) => void;
  logout: () => void;
  setUser: (user: User) => void;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
