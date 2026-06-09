import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../lib/hooks';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register({ username, email, password });
      login(res.data.user, res.data.token);
      navigate('/campaigns');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-1/2 relative items-center justify-center p-10 bg-surface-container-lowest border-r border-border-low-contrast">
        <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800)' }} />
        <div className="relative z-10 text-center max-w-md">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary text-5xl">hub</span>
            <span className="font-display-lg text-on-surface">Campaign Manager</span>
          </div>
          <p className="font-body-lg text-on-surface-variant">
            Precisión, stats y coordinación para campañas de alto nivel.
          </p>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex flex-col justify-center px-4 md:px-10 py-12 bg-surface">
        <div className="md:hidden flex items-center gap-2 mb-8">
          <span className="material-symbols-outlined text-primary text-4xl">hub</span>
          <span className="font-headline-md text-on-surface font-bold">Campaign Manager</span>
        </div>

        <div className="max-w-md w-full mx-auto">
          <h1 className="font-headline-lg text-on-surface mb-2">Crear Cuenta</h1>
          <p className="font-body-md text-on-surface-variant mb-6">Ingresa tus datos para establecer una nueva sesión.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block font-label-bold text-on-surface mb-1">Usuario</label>
              <div className="bg-surface-subtle border-0 border-b border-border-low-contrast focus-within:border-primary rounded-t transition-colors flex items-center px-4">
                <span className="material-symbols-outlined text-outline mr-2">person</span>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nombre de usuario"
                  required
                  className="w-full bg-transparent border-none outline-none py-3 font-body-md text-on-surface placeholder:text-outline"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block font-label-bold text-on-surface mb-1">Correo Electrónico</label>
              <div className="bg-surface-subtle border-0 border-b border-border-low-contrast focus-within:border-primary rounded-t transition-colors flex items-center px-4">
                <span className="material-symbols-outlined text-outline mr-2">mail</span>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  className="w-full bg-transparent border-none outline-none py-3 font-body-md text-on-surface placeholder:text-outline"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block font-label-bold text-on-surface mb-1">Contraseña</label>
              <div className="bg-surface-subtle border-0 border-b border-border-low-contrast focus-within:border-primary rounded-t transition-colors flex items-center px-4">
                <span className="material-symbols-outlined text-outline mr-2">lock</span>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="flex-1 bg-transparent border-none outline-none py-3 font-body-md text-on-surface placeholder:text-outline"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-outline hover:text-on-surface-variant transition-colors">
                  <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block font-label-bold text-on-surface mb-1">Confirmar Contraseña</label>
              <div className="bg-surface-subtle border-0 border-b border-border-low-contrast focus-within:border-primary rounded-t transition-colors flex items-center px-4">
                <span className="material-symbols-outlined text-outline mr-2">lock_reset</span>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  className="w-full bg-transparent border-none outline-none py-3 font-body-md text-on-surface placeholder:text-outline"
                />
              </div>
            </div>

            {error && <div className="bg-error-container text-on-error-container px-4 py-2 rounded font-body-md text-sm">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-on-primary-container font-label-bold py-4 rounded-lg hover:bg-surface-tint transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center font-body-md text-on-surface-variant">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-label-bold text-primary hover:underline">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
