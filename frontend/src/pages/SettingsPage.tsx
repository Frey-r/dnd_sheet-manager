import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { getApiError } from '../services/errors';
import { useAuth } from '../lib/hooks';
import { applyTheme, currentTheme, type Theme } from '../lib/theme';

const ROLE: Record<string, string> = { admin: 'Administrador', dm: 'Dungeon Master', player: 'Jugador' };
const input = 'h-10 w-full px-3';

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-6 last:border-b-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
      <div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-1 text-[13px] text-muted">{desc}</p></div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [totp, setTotp] = useState<{ secret: string; url: string } | null>(null);
  const [code, setCode] = useState('');
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const say = (text: string, bad = false) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 4000); };

  const saveProfile = async () => {
    const avatar = avatarUrl.trim();
    if (avatar && !/^(https?:\/\/|\/)/i.test(avatar)) return say('La URL del avatar debe empezar por http://, https:// o /.', true);
    try {
      await authApi.updateProfile({ username: username.trim(), avatar_url: avatar });
      if (user) setUser({ ...user, username: username.trim(), avatar_url: avatar });
      say('Perfil guardado.');
    } catch (e) { say(getApiError(e), true); }
  };
  const changePassword = async () => {
    if (pw.next.length < 8) return say('La nueva contraseña debe tener al menos 8 caracteres.', true);
    if (pw.next !== pw.confirm) return say('Las contraseñas no coinciden.', true);
    try {
      await authApi.changePassword({ current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      say('Contraseña actualizada.');
    } catch (e) { say(getApiError(e), true); }
  };
  const setup2FA = async () => {
    try { const r = await authApi.setup2FA(); setTotp({ secret: r.data.secret, url: r.data.otpauth_url }); } catch (e) { say(getApiError(e), true); }
  };
  const toggle2FA = async (enable: boolean) => {
    try {
      await (enable ? authApi.enable2FA(code) : authApi.disable2FA(code));
      if (user) setUser({ ...user, totp_enabled: enable });
      setTotp(null); setCode('');
      say(enable ? 'Verificación en dos pasos activada.' : 'Verificación en dos pasos desactivada.');
    } catch (e) { say(getApiError(e), true); }
  };
  const pickTheme = (t: Theme) => { applyTheme(t); setTheme(t); };

  const themes: [Theme, string, string, string, string][] = [
    ['dark', 'Oscuro', '#0c0d10', '#1d2026', '#ff6a3d'],
    ['light', 'Claro', '#f4f2ee', '#e7e3db', '#d6421a'],
    ['contrast', 'Alto contraste', '#000000', '#2a2a2a', '#ffb000'],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-headline-lg">Ajustes</h1>
      <p className="mt-1 text-muted">Tu identidad en la mesa, la seguridad de tu cuenta y las preferencias de este dispositivo.</p>
      {msg && <div role="status" className={`mt-4 rounded-lg border px-4 py-2.5 text-[13.5px] ${msg.bad ? 'border-[color:var(--bad)] bg-bad-soft text-bad' : 'border-line-strong bg-card'}`}>{msg.text}</div>}

      <Section title="Perfil" desc="Así te ven el DM y el resto de jugadores.">
        <div className="flex items-center gap-4">
          {user?.avatar_url ? <img src={user.avatar_url} alt="Tu avatar" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft font-display text-2xl font-semibold text-accent">{(user?.username ?? '?').slice(0, 2).toUpperCase()}</span>}
          <div className="grid grow gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Nombre de usuario<input className={input} value={username} onChange={(e) => setUsername(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Correo (solo lectura)<input className={`${input} text-muted`} value={user?.email ?? ''} readOnly /></label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2 sm:col-span-2">URL del avatar (opcional)<input className={input} type="url" inputMode="url" placeholder="https://…" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} /></label>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3"><span className="mc-badge">{ROLE[user?.role ?? 'player']}</span>
          <button type="button" className="mc-btn mc-btn-primary ml-auto" onClick={saveProfile} disabled={!username.trim() || (username.trim() === user?.username && avatarUrl.trim() === (user?.avatar_url ?? ''))}>Guardar cambios</button></div>
      </Section>

      <Section title="Contraseña" desc="Mínimo 8 caracteres. Cerrará tus otras sesiones.">
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={input} type="password" placeholder="Actual" aria-label="Contraseña actual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          <input className={input} type="password" placeholder="Nueva" aria-label="Nueva contraseña" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          <input className={input} type="password" placeholder="Repetir nueva" aria-label="Repetir nueva contraseña" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
        </div>
        <button type="button" className="mc-btn mt-3" onClick={changePassword} disabled={!pw.current || !pw.next}>Cambiar contraseña</button>
      </Section>

      <Section title="Verificación en dos pasos" desc="Un código de tu app de autenticación al iniciar sesión.">
        {user?.totp_enabled ? (
          <div className="flex flex-wrap items-center gap-2"><span className="mc-badge !bg-ok-soft !text-ok">Activada</span>
            <input className="h-9 w-32 px-3 font-mono" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" aria-label="Código de verificación" />
            <button type="button" className="mc-btn mc-btn-danger" onClick={() => toggle2FA(false)} disabled={code.length < 6}>Desactivar</button></div>
        ) : totp ? (
          <div className="flex flex-col gap-2 text-[13.5px]">
            <p>Añade esta clave en tu app (Google Authenticator, Aegis, 1Password…):</p>
            <code className="break-all rounded-md border border-line bg-card-2 p-2 font-mono">{totp.secret}</code>
            <div className="flex flex-wrap gap-2"><input className="h-9 w-32 px-3 font-mono" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" aria-label="Código de verificación" />
              <button type="button" className="mc-btn mc-btn-primary" onClick={() => toggle2FA(true)} disabled={code.length < 6}>Activar</button></div>
          </div>
        ) : <button type="button" className="mc-btn" onClick={setup2FA}>Configurar</button>}
      </Section>

      <Section title="Apariencia" desc="Alto contraste para mesas con poca luz o proyector. Se guarda en este dispositivo.">
        <div className="grid grid-cols-3 gap-3">
          {themes.map(([id, name, bg, sb, ac]) => (
            <button key={id} type="button" onClick={() => pickTheme(id)} aria-pressed={theme === id}
              className={`rounded-xl border p-2 text-left transition-transform hover:-translate-y-0.5 ${theme === id ? 'border-accent shadow-[0_0_0_1px_var(--accent)]' : 'border-line'}`}>
              <div className="mb-2 grid h-16 grid-cols-[26%_1fr] gap-1 rounded-lg p-1.5" style={{ background: bg }}>
                <i className="rounded" style={{ background: sb }} />
                <span className="flex flex-col gap-1"><i className="h-2.5 w-2/5 rounded" style={{ background: ac }} /><i className="h-2 rounded" style={{ background: sb }} /><i className="h-2 w-3/4 rounded" style={{ background: sb }} /></span>
              </div>
              <b className="px-0.5 text-[13px]">{name}</b>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sesión" desc="Cierra la sesión en este dispositivo y la conexión en tiempo real.">
        <button type="button" className="mc-btn" onClick={() => { logout(); navigate('/login'); }}><span className="material-symbols-outlined text-[18px]">logout</span>Cerrar sesión</button>
      </Section>
    </div>
  );
}
