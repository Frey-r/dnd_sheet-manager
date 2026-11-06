import axios from 'axios';

export function getApiError(error: unknown, fallback = 'No se pudo completar la operación') {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === 'string') return data.error;
    if (error.code === 'ECONNABORTED') return 'La operación tardó demasiado; inténtalo de nuevo';
    if (!error.response) return 'No hay conexión con el servidor';
  }
  return fallback;
}
