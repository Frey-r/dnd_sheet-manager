import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { combatApi, noteApi } from '../services/api';
import { buildEncounter, searchMonsters } from '../services/srdService';
import { getApiError } from '../services/errors';
import { activeCombatantIndex } from '../lib/combat';
import { HPBar } from '../components/ui/HPBar';
import { ErrorState } from '../components/ui/Feedback';
import type { EncounterSuggestion } from '../types/srd';
import { vttApi } from '../services/vttApi';
import { useCampaign } from '../lib/useCampaign';
import { requestRoll } from '../lib/dice';
import { StatRollsPanel } from '../components/character/StatRollsPanel';

interface Combatant { id: number; name: string; initiative: number; hp: number; max_hp: number; is_player: boolean }
interface CombatState { round: number; turn: number; combatants: Combatant[] }

const TOOLS: [string, string, string, string][] = [
  ['table', 'grid_on', 'Mesa virtual', 'Escenas, fichas y niebla'],
  ['gm/combat', 'swords', 'Iniciativa', 'Turnos y PG'],
  ['gm/encounter-builder', 'bolt', 'Encuentros', 'Presupuesto de XP'],
  ['gm/party', 'groups', 'Grupo', 'XP, oro e inspiración'],
  ['gm/npcs', 'theater_comedy', 'NPCs', 'Elenco y secretos'],
  ['gm/bestiary', 'pets', 'Bestiario', 'Libros oficiales y homebrew'],
  ['gm/maps', 'map', 'Mapas', 'Galería de la campaña'],
  ['gm/events', 'calendar_month', 'Eventos', 'Sesiones y mundo'],
  ['gm/notes', 'edit_note', 'Notas', 'Privadas, sin IA'],
  ['gm/lore', 'history_edu', 'Editor de lore', 'Base del Oráculo'],
  ['gm/bot', 'smart_toy', 'Bot asistente', 'Automatizaciones'],
  ['chat', 'campaign', 'Avisos', 'Mensaje a la mesa'],
];

export function GMConsole() {
  const { campaignId = '' } = useParams();
  const { campaign, characters } = useCampaign(campaignId);
  const combat = useQuery({ queryKey: ['combat', campaignId], queryFn: async () => (await combatApi.getState(campaignId)).data as CombatState });
  const scene = useQuery({ queryKey: ['vtt-scenes', campaignId], queryFn: () => vttApi.scenes(campaignId) });
  const active = scene.data?.find((s) => s.is_active);
  const c = `/campaign/${campaignId}`;
  const alerts = characters.filter((ch) => ch.max_hp > 0 && (ch.current_hp <= 0 || ch.current_hp / ch.max_hp < 0.3));
  const fighters = combat.data?.combatants ?? [];
  const current = fighters[activeCombatantIndex(combat.data?.turn, fighters.length)];
  const client = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [encounter, setEncounter] = useState<EncounterSuggestion | null>(null);

  const quickNote = useMutation({
    mutationFn: () => {
      const text = noteText.trim();
      const firstLine = text.split(/\r?\n/)[0];
      return noteApi.create(campaignId, { title: firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine, content: text });
    },
    onSuccess: () => { setNoteText(''); setNotice({ text: 'Nota guardada.' }); void client.invalidateQueries({ queryKey: ['notes', campaignId] }); },
    onError: (reason) => setNotice({ text: getApiError(reason), bad: true }),
  });
  const randomEncounter = useMutation({
    mutationFn: async () => {
      const level = characters.length ? Math.max(1, Math.round(characters.reduce((sum, ch) => sum + ch.level, 0) / characters.length)) : 1;
      const result = await buildEncounter({ party_size: Math.max(1, characters.length), party_level: level, difficulty: 'medium' });
      if (!result.suggestions.length) throw new Error('No hay encuentros posibles para este grupo.');
      return result.suggestions[Math.floor(Math.random() * result.suggestions.length)];
    },
    onSuccess: (suggestion) => { setEncounter(suggestion); setNotice(null); },
    onError: (reason) => setNotice({ text: reason instanceof Error && !('response' in reason) ? reason.message : getApiError(reason, 'No se pudo generar el encuentro'), bad: true }),
  });
  const startEncounter = useMutation({
    mutationFn: async (suggestion: EncounterSuggestion) => {
      for (const item of suggestion.monsters) {
        const found = await searchMonsters({ query: item.name, limit: 1 });
        const hp = found.data?.[0]?.hp ?? 10;
        for (let i = 0; i < item.count; i++) {
          await combatApi.addCombatant(campaignId, { name: item.count > 1 ? `${item.name} ${i + 1}` : item.name, initiative: Math.floor(Math.random() * 20) + 1, hp, max_hp: hp, is_player: false });
        }
      }
    },
    onSuccess: () => { setEncounter(null); setNotice({ text: 'Encuentro añadido al combate.' }); void client.invalidateQueries({ queryKey: ['combat', campaignId] }); },
    onError: (reason) => setNotice({ text: getApiError(reason, 'No se pudo añadir el encuentro'), bad: true }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grow">
          <div className="mc-eyebrow flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-gold">shield_person</span>Dirección</div>
          <h1 className="font-headline-lg">Consola del DM</h1>
          <p className="mt-1 text-muted">Todo lo que necesitas para dirigir {campaign ? <b className="text-ink-2">{campaign.name}</b> : 'la sesión'} en una pantalla.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="mc-btn" onClick={() => requestRoll('1d20', 'Tirada secreta del DM', true)}><span className="material-symbols-outlined text-[18px]">visibility_off</span>Tirada secreta</button>
          <button type="button" className="mc-btn" disabled={randomEncounter.isPending} onClick={() => randomEncounter.mutate()}><span className="material-symbols-outlined text-[18px]">casino</span>{randomEncounter.isPending ? 'Generando…' : 'Encuentro aleatorio'}</button>
          <Link className="mc-btn" to={`${c}/gm/notes`}><span className="material-symbols-outlined text-[18px]">edit_note</span>Nota de sesión</Link>
          <Link className="mc-btn mc-btn-primary" to={`${c}/table`}><span className="material-symbols-outlined text-[18px]">grid_on</span>Abrir la mesa</Link>
        </div>
      </div>

      {notice && (notice.bad ? <ErrorState message={notice.text} /> : <div role="status" className="rounded-lg border border-line-strong bg-card px-4 py-2.5 text-[13.5px]">{notice.text}</div>)}
      {encounter && (
        <section className="mc-card flex flex-wrap items-center gap-3 p-4" aria-label="Encuentro aleatorio">
          <div className="grow">
            <div className="mc-eyebrow">Encuentro aleatorio · {encounter.actual_difficulty}</div>
            <p className="mt-1 text-[14px]">{encounter.monsters.map((m) => `${m.count}× ${m.name} (VD ${m.cr})`).join(', ')}</p>
            <p className="text-xs text-muted">{encounter.total_xp.toLocaleString()} XP · {encounter.monster_count} criaturas</p>
          </div>
          <button type="button" className="mc-btn" onClick={() => randomEncounter.mutate()} disabled={randomEncounter.isPending}>Otro</button>
          <button type="button" className="mc-btn mc-btn-primary" onClick={() => startEncounter.mutate(encounter)} disabled={startEncounter.isPending}>{startEncounter.isPending ? 'Añadiendo…' : 'Añadir al combate'}</button>
          <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setEncounter(null)}>Descartar</button>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <div className="mc-eyebrow mb-2.5 flex items-center gap-2">Estado del grupo
              {alerts.length > 0 && <span className="mc-badge ml-auto !bg-bad-soft !text-bad"><span className="material-symbols-outlined text-[14px]">warning</span>{alerts.length} en peligro</span>}</div>
            {characters.length === 0 ? (
              <div className="mc-card p-6 text-center text-muted">Aún no hay personajes. Comparte el código <b className="font-mono text-ink">{campaign?.join_code}</b> para que los jugadores se unan y creen el suyo.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {characters.map((ch) => {
                  const danger = ch.max_hp > 0 && (ch.current_hp <= 0 || ch.current_hp / ch.max_hp < 0.3);
                  return (
                    <Link key={ch.id} to={`${c}/character/${ch.id}`} className={`mc-card flex flex-col gap-3 p-3.5 transition-transform hover:-translate-y-0.5 ${danger ? '!border-[color:var(--bad)]' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-[13px] font-semibold text-accent">{ch.name.slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0 grow"><b className="block truncate">{ch.name}</b><small className="text-xs text-muted">{ch.race} · {ch.class} {ch.level}</small></div>
                        {danger && <span className="mc-badge !bg-bad-soft !text-bad">{ch.current_hp <= 0 ? 'Caído' : 'Crítico'}</span>}
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-muted"><span>PG</span><span><b className="font-mono text-ink">{ch.current_hp}</b> / {ch.max_hp}{ch.temp_hp ? <span className="text-info"> +{ch.temp_hp}</span> : null}</span></div>
                        <HPBar hp={ch.current_hp} max={ch.max_hp} label={`PV de ${ch.name}`} thin />
                      </div>
                      <div className="flex gap-4 text-xs text-muted"><span>CA <b className="font-mono text-ink">{ch.ac}</b></span></div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mc-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Iniciativa</h2>
              {fighters.length > 0 && <span className="mc-badge !bg-accent-soft !text-accent">Ronda {combat.data?.round || 1}</span>}
              <Link to={`${c}/gm/combat`} className="mc-btn mc-btn-sm ml-auto">Abrir rastreador<span className="material-symbols-outlined text-[16px]">chevron_right</span></Link>
            </div>
            {fighters.length === 0 ? (
              <p className="p-4 text-[13.5px] text-muted">No hay combate en curso. Añade fichas desde la mesa o el generador de encuentros.</p>
            ) : fighters.slice(0, 8).map((f) => (
              <div key={f.id} className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${current?.id === f.id ? 'bg-accent-soft' : ''}`}>
                <span className="w-7 font-mono font-semibold">{f.initiative}</span>
                <span className={`h-2 w-2 rounded-full ${f.is_player ? 'bg-ok' : 'bg-bad'}`} />
                <span className="grow truncate">{f.name}</span>
                <span className="font-mono text-xs text-muted">{f.hp}/{f.max_hp}</span>
                <HPBar hp={f.hp} max={f.max_hp} label={`PV de ${f.name}`} thin className="w-20" />
              </div>
            ))}
          </section>

          <section>
            <div className="mc-eyebrow mb-2.5">Herramientas de dirección</div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {TOOLS.map(([to, icon, title, desc]) => (
                <Link key={to} to={`${c}/${to}`} className="mc-card group flex items-center gap-3 p-3 transition-transform hover:-translate-y-0.5">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line bg-card-2 text-gold transition-colors group-hover:bg-gold group-hover:text-[color:var(--gold-ink)]"><span className="material-symbols-outlined text-[19px]">{icon}</span></span>
                  <span className="min-w-0"><b className="block truncate text-[13.5px]">{title}</b><small className="block truncate text-xs text-muted">{desc}</small></span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="mc-card p-4">
            <div className="mc-eyebrow">Mesa virtual</div>
            {active ? (
              <>
                <h3 className="mt-1 font-display text-xl">{active.name}</h3>
                <p className="text-[13px] text-muted">Escena activa · luz {active.ambient_light === 'dark' ? 'de oscuridad' : active.ambient_light === 'dim' ? 'tenue' : 'brillante'}{active.fog_enabled ? ' · niebla dinámica' : ''}</p>
              </>
            ) : <p className="mt-1 text-[13.5px] text-muted">No hay ninguna escena activa: los jugadores ven la mesa vacía.</p>}
            <Link to={`${c}/table`} className="mc-btn mt-3 w-full">{active ? 'Ir a la mesa' : 'Preparar una escena'}</Link>
          </section>
          <section className="mc-card p-4">
            <div className="mc-eyebrow">Invitar jugadores</div>
            <div className="mt-2 font-mono text-[32px] font-semibold tracking-[.18em]">{campaign?.join_code ?? '······'}</div>
            <p className="text-[12.5px] text-muted">Se introduce en «Mis campañas → Unirse con código».</p>
            <button type="button" className="mc-btn mt-3 w-full" onClick={() => campaign && navigator.clipboard?.writeText(campaign.join_code)}><span className="material-symbols-outlined text-[18px]">content_copy</span>Copiar código</button>
          </section>
          <section className="mc-card p-4">
            <div className="mc-eyebrow">Nota rápida</div>
            <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (noteText.trim()) quickNote.mutate(); }}>
              <textarea aria-label="Nota rápida" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Apunta algo de la sesión… (admite Markdown)" className="w-full rounded px-3 py-2 text-[13.5px]" />
              <button type="submit" className="mc-btn" disabled={!noteText.trim() || quickNote.isPending}>{quickNote.isPending ? 'Guardando…' : 'Guardar nota'}</button>
            </form>
          </section>
          <StatRollsPanel campaignId={campaignId} />
          <section className="mc-card p-4">
            <div className="mc-eyebrow">Modo de juego</div>
            <p className="mt-1 text-[13.5px]">{campaign?.game_mode === 'foundry' ? 'Foundry VTT (espejo sincronizado)' : 'Mesa local: la app es la fuente de verdad.'}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
