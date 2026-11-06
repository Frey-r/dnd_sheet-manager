import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { getApiError } from '../services/errors';

type Actions = Record<string, boolean>;
interface BotSettings { enabled: boolean; personality: string; actions: Actions }

const MODULES: [string, string, string, string][] = [
  ['minion_rolls', 'casino', 'Auto-tiradas para esbirros', 'Tira ataque, daño e iniciativa de grupos de NPCs idénticos en un solo mensaje.'],
  ['loot_split', 'savings', 'Reparto equitativo de botín', 'Suma el tesoro del encuentro y propone un reparto por jugador.'],
  ['turn_timer', 'timer', 'Temporizador de turno', 'Avisa al jugador tras 90 s y al DM a los 3 minutos.'],
  ['pacing', 'notifications', 'Recordatorios de ritmo', 'Avisa cuando una escena se alarga o falta poco para terminar la sesión.'],
];

function parseActions(raw: unknown): Actions {
  if (raw && typeof raw === 'object') return raw as Actions;
  if (typeof raw === 'string') {
    for (const text of [raw, (() => { try { return atob(raw); } catch { return ''; } })()]) {
      try { const v = JSON.parse(text); if (v && typeof v === 'object') return v as Actions; } catch { /* next */ }
    }
  }
  return {};
}

export function BotManager() {
  const { campaignId = '' } = useParams();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['bot', campaignId],
    queryFn: async () => {
      const d = (await api.get(`/campaigns/${campaignId}/bot`)).data as Partial<BotSettings> & { actions?: unknown };
      return { enabled: Boolean(d.enabled), personality: String(d.personality ?? ''), actions: parseActions(d.actions) } as BotSettings;
    },
  });
  const [draft, setForm] = useState<BotSettings | null>(null);
  const form = draft ?? query.data ?? null;
  const [status, setStatus] = useState<{ text: string; bad?: boolean } | null>(null);

  const save = async () => {
    if (!form) return;
    try {
      await api.put(`/campaigns/${campaignId}/bot`, form);
      setStatus({ text: 'Configuración guardada.' });
      void qc.invalidateQueries({ queryKey: ['bot', campaignId] });
    } catch (e) { setStatus({ text: getApiError(e), bad: true }); }
    setTimeout(() => setStatus(null), 3500);
  };

  if (query.isError) return <p className="p-8 text-bad">{getApiError(query.error)}</p>;
  if (query.isLoading || !form) return <p className="p-8 text-muted">Cargando…</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grow"><h1 className="font-headline-lg">Bot asistente</h1>
          <p className="mt-1 text-muted">Un ayudante de mesa para las tareas mecánicas de la sesión.</p></div>
        <button type="button" className="mc-btn mc-btn-primary" onClick={save}>Guardar configuración</button>
      </div>
      {status && <div role="status" className={`rounded-lg border px-4 py-2.5 text-[13.5px] ${status.bad ? 'border-[color:var(--bad)] bg-bad-soft text-bad' : 'border-line-strong bg-card'}`}>{status.text}</div>}

      <section className="mc-card flex items-center gap-4 p-4">
        <span className={`grid h-12 w-12 place-items-center rounded-2xl border ${form.enabled ? 'border-[color:var(--ok)] bg-ok-soft text-ok' : 'border-line bg-card-2 text-faint'}`}><span className="material-symbols-outlined text-[28px]">smart_toy</span></span>
        <div className="grow"><b className="text-base">Cronista de la mesa</b><p className="text-[13px] text-muted">{form.enabled ? 'Activo en la campaña' : 'Inactivo: no intervendrá en la sesión'}</p></div>
        <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />Activo</label>
      </section>

      <section className="mc-card p-4">
        <label className="flex flex-col gap-2 text-[13.5px] font-semibold">Personalidad e instrucciones
          <textarea className="min-h-36 px-3 py-2.5 font-normal leading-relaxed" value={form.personality} maxLength={2000}
            placeholder="Ej.: Eres un escriba gnomo algo dramático que narra en tercera persona. Nunca reveles información que el DM no haya hecho pública."
            onChange={(e) => setForm({ ...form, personality: e.target.value })} /></label>
        <p className="mt-1 text-right font-mono text-xs text-muted">{form.personality.length} / 2000</p>
      </section>

      <section className="mc-card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Automatizaciones</h2>
        {MODULES.map(([key, icon, title, desc]) => (
          <label key={key} className="flex cursor-pointer items-start gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line bg-card-2"><span className="material-symbols-outlined text-[19px]">{icon}</span></span>
            <span className="grow"><b className="text-[14px]">{title}</b><p className="text-[12.5px] text-muted">{desc}</p></span>
            <input type="checkbox" className="mt-1" checked={Boolean(form.actions[key])} onChange={(e) => setForm({ ...form, actions: { ...form.actions, [key]: e.target.checked } })} />
          </label>
        ))}
      </section>
    </div>
  );
}
