import { useState, useCallback, useContext } from 'react';
import { AuthContext } from './AuthContext';

type ToastType = 'success' | 'error' | 'info' | 'trade' | 'message';
interface Toast { id: string; type: ToastType; message: string }

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((previous) => [...previous, { id, type, message }]);
    setTimeout(() => setToasts((previous) => previous.filter((toast) => toast.id !== id)), 5000);
  }, []);
  const removeToast = useCallback((id: string) => setToasts((previous) => previous.filter((toast) => toast.id !== id)), []);
  return { toasts, addToast, removeToast };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
