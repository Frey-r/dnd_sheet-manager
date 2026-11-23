import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loreApi } from '../services/api';
import { useCampaign } from '../lib/useCampaign';
import { getApiError } from '../services/errors';
import type { LoreEntry } from '../types';

type Tier = LoreEntry['lore_tier'];
type Filter = Tier | 'all';

const TIERS: { value: Tier; label: string; hint: string; tone: string }[] = [
  { value: 'campaign_plot', label: 'Trama', hint: 'Lo ven todos los jugadores.', tone: 'text-accent' },
  { value: 'character_lore', label: 'Personaje', hint: 'Solo lo ve el dueño del personaje elegido.', tone: 'text-ok' },
  { value: 'gm_hidden_lore', label: 'Oculto', hint: 'Solo lo ves tú. El Oráculo no se lo revela a los jugadores.', tone: 'text-gold' },
];
const tierInfo = (t: Tier) => TIERS.find((x) => x.value === t) ?? TIERS[0];

interface Draft { id?: number; title: string; content_text: string; lore_tier: Tier; chapter_order: number; character_id?: number }
const emptyDraft = (tier: Tier = 'campaign_plot'): Draft => ({ title: '', content_text: '', lore_tier: tier, chapter_order: 0 });

const field = 'w-full rounded-lg border border-line bg-card-2 px-3 text-[14px] outline-none focus:border-accent';

export function LoreEditor() {
  const { campaignId = '' } = useParams<{ campaignId: string }>();
  const qc = useQueryClient();
  const { characters } = useCampaign(campaignId);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [probe, setProbe] = useState({ open: false, query: '', scope: 'campaign_plot' as Tier });

  const lore = useQuery({
    queryKey: ['lore', campaignId],
    queryFn: async () => ((await loreApi.list(campaignId)).data ?? []) as LoreEntry[],
    enabled: Boolean(campaignId),
  });
  const entries = useMemo(() => lore.data ?? [], [lore.data]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => filter === 'all' || e.lore_tier === filter)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.content_text.toLowerCase().includes(q))
      .sort((a, b) => a.chapter_order - b.chapter_order || a.title.localeCompare(b.title));
  }, [entries, filter, search]);

  const flash = (ok: boolean, text: string) => { setNotice({ ok, text }); setTimeout(() => setNotice(null), 3500); };
  const errorText = (e: unknown) => getApiError(e, 'No se pudo guardar');
  const test = useMutation({
    mutationFn: async () => (await loreApi.search(campaignId, probe.query.trim(), probe.scope)).data as { answer: string; sources: string[] | null },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const body = { title: d.title.trim(), content_text: d.content_text, lore_tier: d.lore_tier, chapter_order: Number(d.chapter_order) || 0 };
      if (d.id) return (await loreApi.update(campaignId, d.id, body)).data as LoreEntry;
      return (await loreApi.create(campaignId, { ...body, character_id: d.lore_tier === 'character_lore' ? d.character_id : undefined })).data as LoreEntry;
    },
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ['lore', campaignId] });
      setDraft({ id: saved.id, title: saved.title, content_text: saved.content_text, lore_tier: saved.lore_tier, chapter_order: saved.chapter_order, character_id: saved.character_id ?? undefined });
      flash(true, 'Entrada guardada');
    },
    onError: (e) => flash(false, errorText(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => loreApi.delete(campaignId, id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['lore', campaignId] }); setDraft(null); flash(true, 'Entrada eliminada'); },
    onError: (e) => flash(false, errorText(e)),
  });

  const edit = (e: LoreEntry) => setDraft({ id: e.id, title: e.title, content_text: e.content_text, lore_tier: e.lore_tier, chapter_order: e.chapter_order, character_id: e.character_id ?? undefined });
  const charName = (id?: number) => characters.find((c) => c.id === id)?.name;
  const needsCharacter = draft?.lore_tier === 'character_lore' && !draft.id && !draft.character_id;
  const canSave = Boolean(draft && draft.content_text.trim() && !needsCharacter && !save.isPending);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mc-eyebrow">Dirección</div>
          <h1 className="font-display text-[28px] leading-tight">Lore de la campaña</h1>
          <p className="mt-1 text-[14px] text-muted">Lo que escribas aquí es lo que consulta el Oráculo, según quién pregunte.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="mc-btn" aria-expanded={probe.open} onClick={() => setProbe({ ...probe, open: !probe.open })}>
            <span className="material-symbols-outlined text-[18px]">manage_search</span>Probar búsqueda
          </button>
          <button type="button" className="mc-btn mc-btn-primary" onClick={() => setDraft(emptyDraft(filter === 'all' ? 'campaign_plot' : filter))}>
            <span className="material-symbols-outlined text-[18px]">add</span>Nueva entrada
          </button>
        </div>
      </header>

      {probe.open && (
        <form className="mc-card flex flex-col gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (probe.query.trim()) test.mutate(); }}>
          <h2 className="text-sm font-semibold">Probar búsqueda del Oráculo</h2>
          <div className="flex flex-wrap gap-2">
            <input className={`${field} h-10 min-w-[200px] flex-1`} aria-label="Pregunta de prueba" placeholder="¿Qué sabe el Oráculo sobre…?" value={probe.query} onChange={(e) => setProbe({ ...probe, query: e.target.value })} />
            <select className={`${field} h-10 w-auto`} aria-label="Ámbito" value={probe.scope} onChange={(e) => setProbe({ ...probe, scope: e.target.value as Tier })}>
              {TIERS.filter((t) => t.value !== 'character_lore').map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button type="submit" className="mc-btn mc-btn-primary" disabled={!probe.query.trim() || test.isPending}>{test.isPending ? 'Buscando…' : 'Buscar'}</button>
          </div>
          {test.isError && <p role="alert" className="text-[13px] text-bad">{getApiError(test.error, 'La búsqueda falló')}</p>}
          {test.data && (
            <div className="rounded-lg border border-line bg-card-2 p-3 text-[13.5px]">
              <p className="whitespace-pre-wrap">{test.data.answer || 'Sin respuesta.'}</p>
              {(test.data.sources ?? []).length > 0 && <p className="mt-2 text-xs text-muted">Fuentes: {(test.data.sources ?? []).join(', ')}</p>}
            </div>
          )}
        </form>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* List */}
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mc-seg" role="group" aria-label="Filtrar por visibilidad">
              <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todo <span className="text-faint">{entries.length}</span></button>
              {TIERS.map((t) => (
                <button key={t.value} type="button" aria-pressed={filter === t.value} onClick={() => setFilter(t.value)}>
                  {t.label} <span className="text-faint">{entries.filter((e) => e.lore_tier === t.value).length}</span>
                </button>
              ))}
            </div>
            <input className={`${field} h-9 min-w-[160px] flex-1`} placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {lore.isLoading && <div className="mc-card p-6 text-center text-muted">Cargando…</div>}
          {lore.isError && <div className="mc-card p-6 text-center text-bad">No se pudo cargar el lore.</div>}
          {!lore.isLoading && !lore.isError && shown.length === 0 && (
            <div className="mc-card flex flex-col items-center gap-3 p-8 text-center">
              <span className="material-symbols-outlined text-[32px] text-faint">history_edu</span>
              <p className="text-muted">{entries.length ? 'Ninguna entrada coincide.' : 'Aún no hay lore. Empieza por la trama principal.'}</p>
              {!entries.length && <button type="button" className="mc-btn" onClick={() => setDraft(emptyDraft())}>Escribir la primera entrada</button>}
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {shown.map((e) => {
              const t = tierInfo(e.lore_tier);
              const active = draft?.id === e.id;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => edit(e)}
                    className={`mc-card w-full p-3.5 text-left transition-colors hover:border-line-strong ${active ? 'border-accent' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{e.chapter_order ? <span className="mr-1.5 font-mono text-faint">{e.chapter_order}.</span> : null}{e.title || 'Sin título'}</div>
                        <p className="mt-1 line-clamp-2 text-[13px] text-muted">{e.content_text}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`mc-badge ${t.tone}`}>{t.label}{e.lore_tier === 'character_lore' && charName(e.character_id) ? ` · ${charName(e.character_id)}` : ''}</span>
                        <span className={`mc-badge ${e.is_vectorized ? 'text-ok' : 'text-warn'}`} title={e.is_vectorized ? 'El Oráculo ya puede encontrar esta entrada' : 'Pendiente de vectorizar: el Oráculo aún no la encuentra por significado'}>
                          <span className="material-symbols-outlined text-[14px]">{e.is_vectorized ? 'check_circle' : 'hourglass_top'}</span>{e.is_vectorized ? 'Vectorizada' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Editor */}
        <section className="min-w-0">
          {!draft ? (
            <div className="mc-card flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center text-muted">
              <span className="material-symbols-outlined text-[28px] text-faint">edit_note</span>
              Elige una entrada para editarla o crea una nueva.
            </div>
          ) : (
            <form className="mc-card flex flex-col gap-4 p-5 lg:sticky lg:top-20"
              onSubmit={(e) => { e.preventDefault(); if (canSave) save.mutate(draft); }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[20px]">{draft.id ? 'Editar entrada' : 'Nueva entrada'}</h2>
                {draft.id && <span className="text-xs text-muted">{entries.find((x) => x.id === draft.id)?.is_vectorized ? 'Vectorizada' : 'Vectorización pendiente'}</span>}
                <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => setDraft(null)}>Cerrar</button>
              </div>

              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Título
                <input className={`${field} h-10`} value={draft.title} maxLength={200} placeholder="La caída de Dunmar"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>

              <div className="flex flex-col gap-1.5 text-[13px] font-medium">
                Visibilidad
                <div className="mc-seg self-start" role="group" aria-label="Visibilidad">
                  {TIERS.map((t) => (
                    <button key={t.value} type="button" aria-pressed={draft.lore_tier === t.value}
                      disabled={Boolean(draft.id) && (t.value === 'character_lore') !== (draft.lore_tier === 'character_lore')}
                      onClick={() => setDraft({ ...draft, lore_tier: t.value })}>{t.label}</button>
                  ))}
                </div>
                <span className="font-normal text-muted">{tierInfo(draft.lore_tier).hint}</span>
              </div>

              {draft.lore_tier === 'character_lore' && (
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Personaje
                  <select className={`${field} h-10`} value={draft.character_id ?? ''} disabled={Boolean(draft.id)}
                    onChange={(e) => setDraft({ ...draft, character_id: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="">Elige un personaje…</option>
                    {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!characters.length && <span className="font-normal text-warn">La campaña aún no tiene personajes.</span>}
                </label>
              )}

              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Contenido
                <textarea className={`${field} min-h-[260px] resize-y py-2.5 leading-relaxed`} value={draft.content_text}
                  placeholder="Escribe la historia, los secretos, los nombres…"
                  onChange={(e) => setDraft({ ...draft, content_text: e.target.value })} />
              </label>

              <label className="flex w-40 flex-col gap-1.5 text-[13px] font-medium">
                Orden (capítulo)
                <input type="number" min={0} className={`${field} h-10`} value={draft.chapter_order}
                  onChange={(e) => setDraft({ ...draft, chapter_order: Number(e.target.value) })} />
              </label>

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <button type="submit" className="mc-btn mc-btn-primary" disabled={!canSave}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
                {draft.id && (
                  <button type="button" className="mc-btn mc-btn-danger" disabled={remove.isPending}
                    onClick={() => { if (window.confirm(`¿Eliminar "${draft.title || 'esta entrada'}"?`)) remove.mutate(draft.id!); }}>
                    Eliminar
                  </button>
                )}
                {needsCharacter && <span className="text-[13px] text-warn">Elige el personaje.</span>}
                {notice && <span role="status" className={`ml-auto text-[13px] ${notice.ok ? 'text-ok' : 'text-bad'}`}>{notice.text}</span>}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
