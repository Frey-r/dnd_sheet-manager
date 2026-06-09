import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../lib/hooks';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      login(res.data.user, res.data.token);
      navigate('/campaigns');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative items-center justify-center p-10 bg-surface-container-lowest border-r border-border-low-contrast">
        <div className="relative z-10 max-w-lg text-center md:text-left">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary text-5xl">hub</span>
            <span className="font-display-lg text-on-surface">Campaign Manager</span>
          </div>
          <h2 className="font-headline-lg text-on-surface mb-4">Gestión táctica, precisión total.</h2>
          <p className="font-body-lg text-on-surface-variant">
            Accede a tus datos de campaña, registros de combate y notas del DM en una plataforma diseñada para la eficiencia y la claridad.
          </p>
        </div>
      </div>

      <div className="w-full md:w-1/2 lg:w-[45%] flex flex-col justify-center px-4 py-12 md:px-10 lg:px-[10%] bg-surface">
        <div className="md:hidden flex items-center gap-2 mb-8">
          <span className="material-symbols-outlined text-primary text-4xl">hub</span>
          <span className="font-headline-md text-on-surface font-bold">Campaign Manager</span>
        </div>

        <div className="w-full max-w-md mx-auto md:mx-0">
          <h1 className="font-headline-lg text-on-surface mb-6">Bienvenido de nuevo</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block font-label-bold text-on-surface mb-1">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast px-4 py-3 font-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-0 outline-none rounded-t transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block font-label-bold text-on-surface mb-1">Contraseña</label>
              <div className="bg-surface-subtle border-0 border-b border-border-low-contrast focus-within:border-primary rounded-t transition-colors flex items-center px-4">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  required
                  className="w-full bg-transparent border-none outline-none py-3 font-body-md text-on-surface placeholder:text-outline"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-outline hover:text-on-surface-variant transition-colors">
                  <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && <div className="bg-error-container text-on-error-container px-4 py-2 rounded font-body-md text-sm">{error}</div>}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-outline-variant text-primary" />
                <span className="font-body-md text-on-surface-variant">Recordarme</span>
              </label>
              <a href="#" className="font-label-bold text-primary hover:underline">¿Olvidaste tu contraseña?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-6 bg-primary-container text-on-primary-container font-label-bold rounded-lg hover:bg-surface-tint transition-colors disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
              {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
            </button>
          </form>

          <p className="mt-6 font-body-md text-on-surface-variant text-center">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="font-label-bold text-primary hover:underline">Regístrate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
