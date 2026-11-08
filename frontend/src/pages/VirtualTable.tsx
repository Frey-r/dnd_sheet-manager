import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TableCanvas, type Tool } from '../components/vtt/TableCanvas';
import { vttApi, vttPlayApi, type SceneLight, type VTTObject, type VTTScene, type VTTToken, type Wall, type Zone } from '../services/vttApi';
import { CombatHud, Joystick, MilestonesPanel, ObjectEditor, ZonesPanel } from '../components/vtt/PlayLayer';
import { useExplorationMovement } from '../lib/useExplorationMovement';
import { useRealtimeSend } from '../lib/RealtimeContext';
import { campaignApi, combatApi } from '../services/api';
import { searchMonsters } from '../services/srdService';
import { useAuth } from '../lib/hooks';
import { useCampaign } from '../lib/useCampaign';
import { LIGHT_PRESETS } from '../lib/vision';
import { getApiError as getErrorMessage } from '../services/errors';
import { ShopView } from '../components/market/ShopView';

interface Member { user_id: number; username: string; role: string }

const TOOLS: { id: Tool; icon: string; label: string; gm?: boolean }[] = [
  { id: 'select', icon: 'pan_tool_alt', label: 'Mover y seleccionar' },
  { id: 'ruler', icon: 'straighten', label: 'Medir distancia' },
  { id: 'wall', icon: 'horizontal_rule', label: 'Dibujar muros (clic a clic; doble clic termina)', gm: true },
  { id: 'door', icon: 'door_front', label: 'Colocar puerta (dos clics)', gm: true },
  { id: 'light', icon: 'lightbulb', label: 'Colocar luz (20/20 pies)', gm: true },
  { id: 'erase', icon: 'ink_eraser', label: 'Borrar muro, puerta, luz o zona', gm: true },
  { id: 'zone', icon: 'pentagon', label: 'Zona de encuentro (clic por vértice, doble clic cierra)', gm: true },
  { id: 'object', icon: 'inventory_2', label: 'Colocar objeto interactivo', gm: true },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">{label}{children}</label>;
}
const inputCls = 'h-9 w-full px-2.5 text-[13.5px]';

export function VirtualTable() {
  const { campaignId = '' } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isGM, characters, loading, myCharacter } = useCampaign(campaignId);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sceneId, setSceneId] = useState<number | null>(null);
  const [previewUser, setPreviewUser] = useState<number | 0>(0);
  const [panel, setPanel] = useState<'scene' | 'tokens' | 'play'>('tokens');
  const [panelOpen, setPanelOpen] = useState(true);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const flash = (text: string, bad = false) => { setNotice({ text, bad }); setTimeout(() => setNotice(null), 3500); };

  // ---------- Data ----------
  const scenesQ = useQuery({ queryKey: ['vtt-scenes', campaignId], queryFn: () => vttApi.scenes(campaignId), enabled: isGM });
  const activeQ = useQuery({ queryKey: ['vtt-active', campaignId], queryFn: () => vttApi.active(campaignId), enabled: !loading && !isGM });
  const currentSceneId = isGM ? sceneId ?? scenesQ.data?.find((s) => s.is_active)?.id ?? scenesQ.data?.[0]?.id ?? null : null;
  const sceneQ = useQuery({ queryKey: ['vtt-scene', campaignId, currentSceneId], queryFn: () => vttApi.scene(campaignId, currentSceneId!), enabled: isGM && currentSceneId !== null });
  const members = useQuery({ queryKey: ['members', campaignId], queryFn: async () => ((await campaignApi.members(campaignId)).data ?? []) as Member[], enabled: isGM });
  const scene: VTTScene | null | undefined = isGM ? sceneQ.data : activeQ.data;
  const sceneKey = isGM ? ['vtt-scene', campaignId, currentSceneId] : ['vtt-active', campaignId];
  const tokens = useMemo(() => scene?.tokens ?? [], [scene]);
  const selected = tokens.find((t) => t.id === selectedId) ?? null;

  const patchScene = (fn: (s: VTTScene) => VTTScene) => qc.setQueryData<VTTScene | null>(sceneKey, (s) => (s ? fn(s) : s));

  // Live token moves from other users (vtt.md §7).
  useEffect(() => {
    const onEvent = (e: Event) => {
      const msg = (e as CustomEvent<{ type?: string; payload?: { data?: { scene_id: number; token_id: number; x: number; y: number } } }>).detail;
      if (msg?.type !== 'vtt.token.moved' || !msg.payload?.data) return;
      const d = msg.payload.data;
      for (const key of [['vtt-active', campaignId], ['vtt-scene', campaignId, d.scene_id]]) {
        qc.setQueryData<VTTScene | null>(key, (s) => (s && s.id === d.scene_id ? { ...s, tokens: s.tokens?.map((t) => (t.id === d.token_id ? { ...t, x: d.x, y: d.y } : t)) } : s));
      }
    };
    window.addEventListener('realtime', onEvent);
    return () => window.removeEventListener('realtime', onEvent);
  }, [campaignId, qc]);

  // ---------- Mutations ----------
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveScene = (data: Partial<VTTScene>) => {
    if (!scene) return;
    patchScene((s) => ({ ...s, ...data }));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      vttApi.updateScene(campaignId, scene.id, data).catch((err) => { flash(getErrorMessage(err), true); void qc.invalidateQueries({ queryKey: sceneKey }); });
    }, 350);
  };
  const onWalls = (walls: Wall[]) => saveScene({ walls });
  const onLights = (lights: SceneLight[]) => saveScene({ lights });

  const onMove = (token: VTTToken, x: number, y: number) => {
    const combat = combatOf(token.id);
    if (combat) {
      vttPlayApi.combatMove(campaignId, combat.id, token.id, x, y)
        .then((r) => { patchScene((s2) => ({ ...s2, tokens: s2.tokens?.map((t) => (t.id === token.id ? { ...t, x: r.x, y: r.y } : t)) })); refreshPlay(); })
        .catch((err) => flash(getErrorMessage(err), true));
      return;
    }
    restMove(token, x, y);
  };
  const restMove = (token: VTTToken, x: number, y: number) => {
    patchScene((s) => ({ ...s, tokens: s.tokens?.map((t) => (t.id === token.id ? { ...t, x, y } : t)) }));
    vttApi.moveToken(campaignId, token.id, x, y)
      .then((r) => patchScene((s) => ({ ...s, tokens: s.tokens?.map((t) => (t.id === token.id ? { ...t, x: r.x, y: r.y } : t)) })))
      .catch((err) => {
        patchScene((s) => ({ ...s, tokens: s.tokens?.map((t) => (t.id === token.id ? { ...t, x: token.x, y: token.y } : t)) }));
        const msg = getErrorMessage(err);
        flash(msg.includes('wall') ? 'Un muro bloquea ese movimiento.' : msg.includes('own') ? 'Solo puedes mover tus propias fichas.' : msg, true);
      });
  };

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['vtt-scenes', campaignId] }); void qc.invalidateQueries({ queryKey: sceneKey }); };
  const createScene = useMutation({
    mutationFn: () => vttApi.createScene(campaignId, { name: `Escena ${(scenesQ.data?.length ?? 0) + 1}` }),
    onSuccess: (s) => { setSceneId(s.id); setPanel('scene'); refresh(); },
    onError: (e) => flash(getErrorMessage(e), true),
  });
  const activate = useMutation({ mutationFn: (id: number) => vttApi.activate(campaignId, id), onSuccess: () => { refresh(); flash('Escena activa: los jugadores ya la ven.'); }, onError: (e) => flash(getErrorMessage(e), true) });
  const deleteScene = useMutation({ mutationFn: (id: number) => vttApi.deleteScene(campaignId, id), onSuccess: () => { setSceneId(null); refresh(); }, onError: (e) => flash(getErrorMessage(e), true) });
  const addToken = useMutation({
    mutationFn: (data: Partial<VTTToken> & { monster_id?: number }) => {
      const center = scene ? { x: scene.width_px / 2, y: scene.height_px / 2 } : {};
      return vttApi.createToken(campaignId, scene!.id, { ...center, ...data });
    },
    onSuccess: (t) => { setSelectedId(t.id); refresh(); },
    onError: (e) => flash(getErrorMessage(e), true),
  });
  const updateToken = (id: number, data: Partial<VTTToken> & { clear_owner?: boolean }) => {
    patchScene((s) => ({ ...s, tokens: s.tokens?.map((t) => (t.id === id ? { ...t, ...data } : t)) }));
    vttApi.updateToken(campaignId, id, data).catch((err) => { flash(getErrorMessage(err), true); refresh(); });
  };
  const deleteToken = (id: number) => { setSelectedId(null); vttApi.deleteToken(campaignId, id).then(refresh).catch((e) => flash(getErrorMessage(e), true)); };

  const uploadMap = async (file: File) => {
    try {
      const url = await vttApi.upload(campaignId, file);
      const img = new Image();
      img.onload = () => saveScene({ map_url: url, width_px: img.naturalWidth, height_px: img.naturalHeight });
      img.src = url;
      flash('Mapa subido.');
    } catch (err) { flash(getErrorMessage(err), true); }
  };

  const addToInitiative = (t: VTTToken) => {
    const initiative = 1 + Math.floor(Math.random() * 20);
    combatApi.addCombatant(campaignId, { name: t.name, hp: t.hp || 1, max_hp: t.max_hp || 1, initiative, character_id: t.character_id ?? undefined, is_player: t.kind === 'pc' })
      .then(() => flash(`${t.name} entra en la iniciativa (${initiative}).`))
      .catch((e) => flash(getErrorMessage(e), true));
  };

  // ---------- Vision ----------
  const viewers: VTTToken[] | null = useMemo(() => {
    if (!scene?.fog_enabled) return null;
    if (isGM) return previewUser ? tokens.filter((t) => t.owner_user_id === previewUser) : null;
    return tokens.filter((t) => t.owner_user_id === user?.id);
  }, [scene?.fog_enabled, isGM, previewUser, tokens, user?.id]);
  const owners = useMemo(() => [...new Set(tokens.map((t) => t.owner_user_id).filter((v): v is number => Boolean(v)))], [tokens]);
  const nameOf = (uid: number) => members.data?.find((m) => m.user_id === uid)?.username ?? `Usuario ${uid}`;

  // ---------- Monster search ----------
  const [q, setQ] = useState('');
  const monsters = useQuery({ queryKey: ['vtt-monsters', q], queryFn: () => searchMonsters({ query: q, limit: 8 }), enabled: isGM && q.trim().length >= 2 });

  // ---------- Modes: objects, combats, milestones, movement (vtt-modes.md) ----------
  const send = useRealtimeSend();
  const shownSceneId = scene?.id;
  const objectsQ = useQuery({ queryKey: ['vtt-objects', campaignId, shownSceneId], queryFn: () => vttPlayApi.objects(campaignId, shownSceneId!), enabled: Boolean(shownSceneId) && scene?.mode !== 'narrative' });
  const combatsQ = useQuery({ queryKey: ['vtt-combats', campaignId, shownSceneId], queryFn: () => vttPlayApi.combats(campaignId, shownSceneId!), enabled: Boolean(shownSceneId) && scene?.mode !== 'narrative' });
  const milestonesQ = useQuery({ queryKey: ['milestones', campaignId], queryFn: () => vttPlayApi.milestones(campaignId), enabled: isGM });
  const objects = useMemo(() => objectsQ.data ?? [], [objectsQ.data]);
  const combats = useMemo(() => combatsQ.data ?? [], [combatsQ.data]);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [openShopId, setOpenShopId] = useState<number | null>(null);
  const [combatPick, setCombatPick] = useState<number[]>([]);
  const [joy, setJoy] = useState({ x: 0, y: 0 });
  const myTokenIds = useMemo(() => new Set(tokens.filter((t) => t.owner_user_id === user?.id).map((t) => t.id)), [tokens, user?.id]);
  const combatOf = (tokenId: number) => combats.find((c) => c.combatants.some((cb) => cb.token_id === tokenId));
  const myCombat = isGM ? combats[0] : combats.find((c) => c.combatants.some((cb) => myTokenIds.has(cb.token_id)));
  const explorer = useMemo(() => {
    if (isGM || !scene || scene.mode !== 'exploration') return null;
    const own = tokens.filter((t) => t.owner_user_id === user?.id && !combats.some((c) => c.combatants.some((cb) => cb.token_id === t.id)));
    return own.find((t) => t.id === selectedId) ?? own[0] ?? null;
  }, [isGM, scene, tokens, user?.id, combats, selectedId]);
  useExplorationMovement({
    scene, token: explorer, enabled: Boolean(explorer), joystick: joy,
    onStep: (x, y) => {
      if (!explorer) return;
      patchScene((sc) => ({ ...sc, tokens: sc.tokens?.map((t) => (t.id === explorer.id ? { ...t, x, y } : t)) }));
      send('vtt.move', { token_id: explorer.id, x, y });
    },
  });
  const refreshPlay = () => { void qc.invalidateQueries({ queryKey: ['vtt-objects', campaignId] }); void qc.invalidateQueries({ queryKey: ['vtt-combats', campaignId] }); };
  const combatAction = (combatId: number, a: 'next' | 'end' | 'pause' | 'extend' | 'dash') =>
    vttPlayApi.combatAction(campaignId, combatId, a).then(refreshPlay).catch((e) => flash(getErrorMessage(e), true));
  const placeObject = (x: number, y: number) => {
    if (!scene) return;
    vttPlayApi.createObject(campaignId, scene.id, { name: 'Cofre', icon: 'inventory_2', x, y, loot_kind: 'fixed', loot: { gold: 0, items: [] } })
      .then((o) => { setSelectedObjectId(o.id); setPanel('play'); setTool('select'); refreshPlay(); })
      .catch((e) => flash(getErrorMessage(e), true));
  };
  const saveObject = (o: VTTObject, data: Partial<VTTObject>) => {
    qc.setQueryData<VTTObject[]>(['vtt-objects', campaignId, shownSceneId], (list) => list?.map((x) => (x.id === o.id ? { ...x, ...data } : x)));
    vttPlayApi.updateObject(campaignId, o.id, data).catch((e) => { flash(getErrorMessage(e), true); refreshPlay(); });
  };
  const interact = (o: VTTObject) => vttPlayApi.interact(campaignId, o.id)
    .then((r) => { if (r.shop_id) { setOpenShopId(r.shop_id); return; } flash(`${r.message}${r.roll ? ` · ${r.roll}` : ''}${r.loot ? ` · Obtienes: ${r.loot}` : ''}`, !r.success); refreshPlay(); })
    .catch((e) => flash(getErrorMessage(e), true));
  const onZones = (zones: Zone[]) => saveScene({ zones });
  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? null;

  // ---------- Render ----------
  if (loading || (isGM ? scenesQ.isLoading : activeQ.isLoading)) return <div className="grid flex-1 place-items-center text-muted">Cargando la mesa…</div>;

  if (!isGM && !scene) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <div className="mc-card max-w-md p-8 text-center">
          <span className="material-symbols-outlined text-[40px] text-muted">grid_on</span>
          <h1 className="mt-2 text-lg font-semibold">La mesa está vacía</h1>
          <p className="mt-1 text-muted">Tu DM todavía no ha activado ninguna escena. En cuanto lo haga aparecerá aquí sin recargar.</p>
        </div>
      </div>
    );
  }

  if (!isGM && scene?.mode === 'narrative') {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-black" style={{ height: 'calc(100dvh - 56px)' }}>
        {scene.map_url ? <img src={scene.map_url} alt={scene.name} className="max-h-full max-w-full object-contain" /> : <p className="text-muted">{scene.name}</p>}
      </div>
    );
  }

  const myTokens = tokens.filter((t) => t.owner_user_id === user?.id);
  const sceneList = scenesQ.data ?? [];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row" style={{ height: 'calc(100dvh - 56px)' }}>
      {openShopId && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Tienda"
          onClick={(e) => { if (e.target === e.currentTarget) setOpenShopId(null); }}>
          <div className="mc-card max-h-[85vh] w-full max-w-3xl overflow-y-auto p-5 shadow-[var(--shadow-3)]">
            <ShopView campaignId={campaignId} shopId={openShopId} characterId={myCharacter?.id} onClose={() => setOpenShopId(null)} />
          </div>
        </div>
      )}
      <div className="relative min-h-[55vh] flex-1">
        {scene ? (
          <TableCanvas scene={scene} tokens={tokens} isGM={isGM} userId={user?.id ?? 0} viewers={viewers} tool={tool}
            selectedId={selectedId} onSelect={setSelectedId} onMove={onMove} onWalls={onWalls} onLights={onLights}
            objects={scene.mode === 'narrative' ? [] : objects} combats={combats} selectedObjectId={selectedObjectId} onSelectObject={setSelectedObjectId}
            onPlaceObject={placeObject} onZones={onZones} characters={characters} />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="mc-card max-w-md p-8">
              <span className="material-symbols-outlined text-[40px] text-muted">add_photo_alternate</span>
              <h1 className="mt-2 text-lg font-semibold">Crea tu primera escena</h1>
              <p className="mt-1 text-muted">Sube un mapa, ajusta la cuadrícula y coloca las fichas. Los jugadores verán la escena que actives.</p>
              <button type="button" className="mc-btn mc-btn-primary mt-4" onClick={() => createScene.mutate()}>Nueva escena</button>
            </div>
          </div>
        )}
        {scene && (
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-col overflow-hidden rounded-lg border border-line-strong bg-card shadow-[var(--shadow-2)] sm:flex-row">
              {TOOLS.filter((t) => !t.gm || isGM).map((t) => (
                <button key={t.id} type="button" title={t.label} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}
                  className={`grid h-9 w-9 place-items-center border-line ${tool === t.id ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-card-2'}`}>
                  <span className="material-symbols-outlined text-[19px]">{t.icon}</span>
                </button>
              ))}
            </div>
            <span className="hidden rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-2 shadow-[var(--shadow-1)] sm:inline-flex sm:items-center sm:gap-1.5">
              <span className="material-symbols-outlined text-[15px]">{scene.ambient_light === 'dark' ? 'dark_mode' : scene.ambient_light === 'dim' ? 'brightness_5' : 'light_mode'}</span>
              {scene.name}{isGM && !scene.is_active && <b className="text-warn"> · no activa</b>}
            </span>
          </div>
        )}
        {myCombat && (isGM || !explorer) && (
          <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2">
            <CombatHud combat={myCombat} tokens={tokens} userId={user?.id ?? 0} isGM={isGM} onAction={(a) => combatAction(myCombat.id, a)} />
          </div>
        )}
        {explorer && (
          <div className="absolute bottom-4 left-4 z-10 flex items-end gap-3">
            <div className="md:hidden"><Joystick onChange={setJoy} /></div>
            <div className="hidden rounded-lg border border-line bg-card px-3 py-2 text-xs text-muted shadow-[var(--shadow-2)] md:block">Mueve a <b className="text-ink">{explorer.name}</b> con <span className="font-mono">WASD</span> o flechas</div>
          </div>
        )}
        {!isGM && selectedObject && (
          <div className="absolute bottom-[4.25rem] right-4 z-10 mc-card max-w-[calc(100%-2rem)] flex items-center gap-3 px-3 py-2 shadow-[var(--shadow-3)]">
            <span className="material-symbols-outlined text-gold">{selectedObject.icon}</span>
            <div className="text-[13px]"><b>{selectedObject.name}</b>{selectedObject.check && <div className="text-xs text-muted">Prueba de {selectedObject.check.skill} (CD {selectedObject.check.dc})</div>}</div>
            <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" disabled={selectedObject.depleted || selectedObject.attempted} onClick={() => interact(selectedObject)}>
              {selectedObject.depleted ? 'Vacío' : selectedObject.attempted ? 'Ya lo intentaste' : 'Interactuar'}</button>
          </div>
        )}
        {notice && (
          <div role="status" className={`absolute left-1/2 top-3 -translate-x-1/2 rounded-lg border px-3.5 py-2 text-[13px] shadow-[var(--shadow-3)] ${notice.bad ? 'border-bad bg-[color:var(--surface)] text-bad' : 'border-line-strong bg-card text-ink'}`}>{notice.text}</div>
        )}
        {!isGM && scene?.fog_enabled && myTokens.length === 0 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-lg border border-line-strong bg-card px-4 py-2.5 text-center text-[13px] text-ink-2 shadow-[var(--shadow-2)]">No tienes ninguna ficha en esta escena: pídele a tu DM que coloque la tuya para ver la mesa.</div>
        )}
        <button type="button" onClick={() => setPanelOpen((o) => !o)} className="mc-btn mc-btn-sm absolute right-3 top-3 shadow-[var(--shadow-2)]" aria-expanded={panelOpen}>
          <span className="material-symbols-outlined text-[18px]">{panelOpen ? 'right_panel_close' : 'right_panel_open'}</span><span className="hidden sm:inline">Panel</span>
        </button>
      </div>

      {panelOpen && (
        <aside className="max-h-[45vh] w-full overflow-y-auto border-t border-line bg-bg-elev md:max-h-none md:w-[340px] md:border-l md:border-t-0">
          {isGM ? (
            <>
              <div className="sticky top-0 z-10 flex gap-1 border-b border-line bg-bg-elev p-2">
                <div className="mc-seg w-full">
                  <button type="button" className="flex-1 justify-center" aria-pressed={panel === 'tokens'} onClick={() => setPanel('tokens')}>Fichas</button>
                  <button type="button" className="flex-1 justify-center" aria-pressed={panel === 'scene'} onClick={() => setPanel('scene')}>Escena</button>
                  <button type="button" className="flex-1 justify-center" aria-pressed={panel === 'play'} onClick={() => setPanel('play')}>Juego</button>
                </div>
              </div>

              <section className="border-b border-line p-4">
                <div className="mb-2 flex items-center justify-between"><span className="mc-eyebrow">Escenas</span>
                  <button type="button" className="mc-btn mc-btn-sm" onClick={() => createScene.mutate()}><span className="material-symbols-outlined text-[16px]">add</span>Nueva</button></div>
                <div className="flex flex-col gap-1">
                  {sceneList.map((s) => (
                    <div key={s.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${s.id === currentSceneId ? 'bg-card-2' : 'hover:bg-card'}`}>
                      <button type="button" className="min-w-0 flex-1 truncate text-left text-[13.5px]" onClick={() => { setSceneId(s.id); setSelectedId(null); }}>{s.name}</button>
                      {s.is_active ? <span className="mc-badge !bg-ok-soft !text-ok">Activa</span>
                        : <button type="button" className="mc-btn mc-btn-sm" onClick={() => activate.mutate(s.id)}>Activar</button>}
                    </div>
                  ))}
                  {!sceneList.length && <p className="text-[13px] text-muted">Aún no hay escenas.</p>}
                </div>
              </section>

              {scene && panel === 'scene' && (
                <section className="flex flex-col gap-3 p-4">
                  <Field label="Nombre"><input className={inputCls} value={scene.name} onChange={(e) => saveScene({ name: e.target.value })} /></Field>
                  <Field label="Mapa (PNG, JPG o WebP, máx. 15 MB)">
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="text-[12.5px] text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-card-2 file:px-3 file:py-1.5 file:text-ink" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMap(f); }} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Celda (px)"><input type="number" min={10} max={400} className={inputCls} value={scene.grid_size_px} onChange={(e) => saveScene({ grid_size_px: Number(e.target.value) || 70 })} /></Field>
                    <Field label="Pies por celda"><input type="number" min={1} className={inputCls} value={scene.feet_per_cell} onChange={(e) => saveScene({ feet_per_cell: Number(e.target.value) || 5 })} /></Field>
                    <Field label="Desfase X"><input type="number" className={inputCls} value={scene.grid_offset_x} onChange={(e) => saveScene({ grid_offset_x: Number(e.target.value) || 0 })} /></Field>
                    <Field label="Desfase Y"><input type="number" className={inputCls} value={scene.grid_offset_y} onChange={(e) => saveScene({ grid_offset_y: Number(e.target.value) || 0 })} /></Field>
                    <Field label="Ancho (px)"><input type="number" className={inputCls} value={scene.width_px} onChange={(e) => saveScene({ width_px: Number(e.target.value) || scene.width_px })} /></Field>
                    <Field label="Alto (px)"><input type="number" className={inputCls} value={scene.height_px} onChange={(e) => saveScene({ height_px: Number(e.target.value) || scene.height_px })} /></Field>
                  </div>
                  <Field label="Luz ambiental">
                    <div className="mc-seg">
                      {([['bright', 'Brillante'], ['dim', 'Tenue'], ['dark', 'Oscuridad']] as const).map(([v, l]) => (
                        <button key={v} type="button" className="flex-1 justify-center" aria-pressed={scene.ambient_light === v} onClick={() => saveScene({ ambient_light: v })}>{l}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Modo del mapa">
                    <div className="mc-seg">
                      {([['narrative', 'Narrativo'], ['exploration', 'Exploración'], ['combat', 'Combate']] as const).map(([v, l]) => (
                        <button key={v} type="button" className="flex-1 justify-center" aria-pressed={scene.mode === v} onClick={() => saveScene({ mode: v })}>{l}</button>
                      ))}
                    </div>
                  </Field>
                  {scene.mode === 'exploration' && (
                    <Field label={`Ritmo de exploración ×${scene.exploration_pace} (un asalto de 6 s dura ${(6 / scene.exploration_pace).toFixed(1)} s reales)`}>
                      <input type="range" min={1} max={4} step={0.5} value={scene.exploration_pace} onChange={(e) => saveScene({ exploration_pace: Number(e.target.value) })} />
                    </Field>
                  )}
                  <label className="flex items-center justify-between text-[13.5px]">Niebla de guerra dinámica<input type="checkbox" checked={scene.fog_enabled} onChange={(e) => saveScene({ fog_enabled: e.target.checked })} /></label>
                  <p className="text-xs text-muted">{scene.walls.length} muros · {scene.walls.filter((w) => w.door).length} puertas · {scene.lights.length} luces. Con «Mover» haz clic en una puerta para abrirla o cerrarla.</p>
                  <div className="flex gap-2 border-t border-line pt-3">
                    {!scene.is_active && <button type="button" className="mc-btn mc-btn-primary flex-1" onClick={() => activate.mutate(scene.id)}>Mostrar a jugadores</button>}
                    <button type="button" className="mc-btn mc-btn-danger" onClick={() => { if (confirm(`¿Eliminar la escena «${scene.name}» y sus fichas?`)) deleteScene.mutate(scene.id); }}>Eliminar</button>
                  </div>
                </section>
              )}

              {scene && panel === 'tokens' && (
                <section className="flex flex-col gap-4 p-4">
                  <div>
                    <span className="mc-eyebrow">Ver como</span>
                    <select className={`${inputCls} mt-1`} value={previewUser} onChange={(e) => setPreviewUser(Number(e.target.value))} disabled={!scene.fog_enabled}>
                      <option value={0}>DM (todo visible)</option>
                      {owners.map((u) => <option key={u} value={u}>{nameOf(u)}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="mc-eyebrow">Añadir ficha</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {characters.filter((c) => !tokens.some((t) => t.character_id === c.id)).map((c) => (
                        <button key={c.id} type="button" className="mc-btn mc-btn-sm" onClick={() => addToken.mutate({ character_id: c.id, name: c.name, hp: c.current_hp, max_hp: c.max_hp, ac: c.ac })}>
                          <span className="material-symbols-outlined text-[16px]">person_add</span>{c.name}</button>
                      ))}
                      <button type="button" className="mc-btn mc-btn-sm" onClick={() => addToken.mutate({ name: 'NPC', kind: 'npc', color: '#4b6aa3' })}><span className="material-symbols-outlined text-[16px]">add</span>NPC rápido</button>
                    </div>
                    <input className={`${inputCls} mt-2`} placeholder="Buscar monstruo del bestiario…" value={q} onChange={(e) => setQ(e.target.value)} />
                    {q.trim().length >= 2 && (
                      <div className="mt-1 overflow-hidden rounded-md border border-line">
                        {(monsters.data?.data ?? []).map((m) => (
                          <button key={m.id} type="button" className="flex w-full items-center gap-2 border-b border-line px-2.5 py-2 text-left text-[13px] last:border-b-0 hover:bg-card-2"
                            onClick={() => addToken.mutate({ monster_id: m.id, name: m.name, kind: 'monster' })}>
                            <span className="grow">{m.name}</span><span className="font-mono text-xs text-muted">CR {m.cr}</span>
                          </button>
                        ))}
                        {monsters.isFetching && <p className="px-2.5 py-2 text-xs text-muted">Buscando…</p>}
                        {!monsters.isFetching && !(monsters.data?.data ?? []).length && <p className="px-2.5 py-2 text-xs text-muted">Sin resultados.</p>}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="mc-eyebrow">En la escena ({tokens.length})</span>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {tokens.map((t) => (
                        <button key={t.id} type="button" onClick={() => setSelectedId(t.id)} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${t.id === selectedId ? 'bg-card-2' : 'hover:bg-card'}`}>
                          <span className="h-3 w-3 flex-none rounded-full" style={{ background: t.color }} />
                          <span className="grow truncate">{t.name}</span>
                          {t.hidden && <span className="material-symbols-outlined text-[16px] text-muted" title="Oculta">visibility_off</span>}
                          {t.max_hp > 0 && <span className="font-mono text-xs text-muted">{t.hp}/{t.max_hp}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selected && (
                    <div className="mc-card flex flex-col gap-2.5 p-3">
                      <div className="flex items-center gap-2"><b className="grow truncate">{selected.name}</b>
                        <button type="button" className="mc-btn mc-btn-sm" onClick={() => addToInitiative(selected)} title="Añadir a la iniciativa"><span className="material-symbols-outlined text-[16px]">swords</span></button>
                        <button type="button" className="mc-btn mc-btn-sm mc-btn-danger" onClick={() => deleteToken(selected.id)} aria-label="Eliminar ficha"><span className="material-symbols-outlined text-[16px]">delete</span></button></div>
                      <Field label="Nombre"><input className={inputCls} value={selected.name} onChange={(e) => updateToken(selected.id, { name: e.target.value })} /></Field>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="PG"><input type="number" className={inputCls} value={selected.hp} disabled={!!selected.character_id} onChange={(e) => updateToken(selected.id, { hp: Number(e.target.value) })} /></Field>
                        <Field label="PG máx."><input type="number" className={inputCls} value={selected.max_hp} disabled={!!selected.character_id} onChange={(e) => updateToken(selected.id, { max_hp: Number(e.target.value) })} /></Field>
                        <Field label="CA"><input type="number" className={inputCls} value={selected.ac} onChange={(e) => updateToken(selected.id, { ac: Number(e.target.value) })} /></Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Tamaño (celdas)">
                          <select className={inputCls} value={selected.size_cells} onChange={(e) => updateToken(selected.id, { size_cells: Number(e.target.value) })}>
                            {[[0.5, 'Diminuto'], [1, 'Pequeño/Mediano'], [2, 'Grande'], [3, 'Enorme'], [4, 'Gargantuesco']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </Field>
                        <Field label="Color"><input type="color" className="h-9 w-full rounded-md border border-line-strong bg-bg-elev" value={selected.color} onChange={(e) => updateToken(selected.id, { color: e.target.value })} /></Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Visión en la oscuridad (pies)"><input type="number" min={0} step={5} className={inputCls} value={selected.darkvision_ft} onChange={(e) => updateToken(selected.id, { darkvision_ft: Number(e.target.value) })} /></Field>
                        <Field label="Vista ciega (pies)"><input type="number" min={0} step={5} className={inputCls} value={selected.blindsight_ft} onChange={(e) => updateToken(selected.id, { blindsight_ft: Number(e.target.value) })} /></Field>
                        <Field label="Alcance de visión (0 = sin límite)"><input type="number" min={0} step={5} className={inputCls} value={selected.vision_ft} onChange={(e) => updateToken(selected.id, { vision_ft: Number(e.target.value) })} /></Field>
                        <Field label="Fuente de luz">
                          <select className={inputCls} value={`${selected.light_bright_ft}/${selected.light_dim_ft}`} onChange={(e) => { const [b, d] = e.target.value.split('/').map(Number); updateToken(selected.id, { light_bright_ft: b, light_dim_ft: d }); }}>
                            {LIGHT_PRESETS.map(([l, b, d]) => <option key={l} value={`${b}/${d}`}>{l}</option>)}
                            {!LIGHT_PRESETS.some(([, b, d]) => b === selected.light_bright_ft && d === selected.light_dim_ft) && <option value={`${selected.light_bright_ft}/${selected.light_dim_ft}`}>{selected.light_bright_ft}/{selected.light_dim_ft}</option>}
                          </select>
                        </Field>
                      </div>
                      <Field label="Controlada por">
                        <select className={inputCls} value={selected.owner_user_id ?? 0} onChange={(e) => { const v = Number(e.target.value); updateToken(selected.id, v ? { owner_user_id: v } : { clear_owner: true, owner_user_id: null }); }}>
                          <option value={0}>Solo el DM</option>
                          {(members.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.username}</option>)}
                        </select>
                      </Field>
                      <label className="flex items-center justify-between text-[13.5px]">Oculta a los jugadores<input type="checkbox" checked={selected.hidden} onChange={(e) => updateToken(selected.id, { hidden: e.target.checked })} /></label>
                    </div>
                  )}
                </section>
              )}
              {scene && panel === 'play' && (
                <section className="flex flex-col gap-5 p-4">
                  <div>
                    <span className="mc-eyebrow">Combates activos ({combats.length})</span>
                    {combats.map((c) => (
                      <div key={c.id} className="mt-1.5 flex items-center gap-2 text-[13px]">
                        <span className="material-symbols-outlined text-[18px] text-bad">swords</span>
                        <span className="grow truncate">{c.combatants.map((x) => x.name).join(', ')}</span>
                        <button type="button" className="mc-btn mc-btn-sm mc-btn-danger" onClick={() => combatAction(c.id, 'end')}>Terminar</button>
                      </div>
                    ))}
                    <p className="mt-2 text-xs text-muted">Iniciar un encuentro con las fichas marcadas:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tokens.map((t) => {
                        const on = combatPick.includes(t.id);
                        return <button key={t.id} type="button" onClick={() => setCombatPick(on ? combatPick.filter((x) => x !== t.id) : [...combatPick, t.id])}
                          className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'}`}>{t.name}</button>;
                      })}
                    </div>
                    <button type="button" className="mc-btn mc-btn-sm mt-2" disabled={!combatPick.length} onClick={() => vttPlayApi.startCombat(campaignId, scene.id, combatPick).then(() => { setCombatPick([]); refreshPlay(); }).catch((e) => flash(getErrorMessage(e), true))}>
                      <span className="material-symbols-outlined text-[16px]">swords</span>Iniciar encuentro</button>
                  </div>
                  <ZonesPanel zones={scene.zones ?? []} tokens={tokens} onChange={onZones} />
                  <MilestonesPanel milestones={milestonesQ.data ?? []}
                    onCreate={(n) => vttPlayApi.createMilestone(campaignId, n).then(() => qc.invalidateQueries({ queryKey: ['milestones', campaignId] }))}
                    onToggle={(m) => vttPlayApi.updateMilestone(campaignId, m).then(() => qc.invalidateQueries({ queryKey: ['milestones', campaignId] }))} />
                  <div>
                    <span className="mc-eyebrow">Objetos ({objects.length})</span>
                    <p className="mt-1 text-xs text-muted">Herramienta «Objeto» para colocarlos; clic sobre uno para editarlo.</p>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {objects.map((o) => (
                        <button key={o.id} type="button" onClick={() => setSelectedObjectId(o.id)} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${o.id === selectedObjectId ? 'bg-card-2' : 'hover:bg-card'}`}>
                          <span className="material-symbols-outlined text-[17px] text-gold">{o.icon}</span><span className="grow truncate">{o.name}</span>
                          {o.depleted && <span className="mc-badge">Vacío</span>}{(o.discover_dc ?? 0) > 0 && <span className="mc-badge">CD {o.discover_dc}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedObject && (
                    <ObjectEditor key={selectedObject.id} obj={selectedObject} milestones={milestonesQ.data ?? []}
                      onSave={(d) => saveObject(selectedObject, d)}
                      onDelete={() => vttPlayApi.deleteObject(campaignId, selectedObject.id).then(() => { setSelectedObjectId(null); refreshPlay(); })}
                      onReset={() => vttPlayApi.resetObject(campaignId, selectedObject.id).then(() => { flash('Objeto repuesto.'); refreshPlay(); })} />
                  )}
                </section>
              )}
            </>
          ) : (
            <section className="flex flex-col gap-4 p-4">
              <div><span className="mc-eyebrow">Escena</span><h2 className="font-display text-xl">{scene?.name}</h2>
                <p className="text-[13px] text-muted">Luz {scene?.ambient_light === 'dark' ? 'de oscuridad' : scene?.ambient_light === 'dim' ? 'tenue' : 'brillante'} · {scene?.feet_per_cell} pies por casilla</p></div>
              {myTokens.map((t) => (
                <div key={t.id} className="mc-card flex flex-col gap-2 p-3">
                  <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: t.color }} /><b className="grow">{t.name}</b><span className="font-mono text-sm">{t.hp}/{t.max_hp} PG</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-card-3"><div className="h-full rounded-full" style={{ width: `${t.max_hp ? Math.max(0, Math.min(100, (t.hp / t.max_hp) * 100)) : 0}%`, background: t.max_hp && t.hp / t.max_hp < 0.3 ? 'var(--bad)' : t.max_hp && t.hp / t.max_hp < 0.6 ? 'var(--warn)' : 'var(--ok)' }} /></div>
                  <p className="text-xs text-muted">
                    CA {t.ac}{t.darkvision_ft ? ` · Visión en la oscuridad ${t.darkvision_ft} pies` : ''}{t.blindsight_ft ? ` · Vista ciega ${t.blindsight_ft} pies` : ''}{t.light_bright_ft ? ` · Luz ${t.light_bright_ft}/${t.light_dim_ft} pies` : ''}
                  </p>
                </div>
              ))}
              {scene?.mode === 'exploration' && myTokens.map((t) => (
                <label key={`sneak-${t.id}`} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-[13.5px]">
                  <span><b>Sigilo</b> · {t.name}<small className="block text-xs text-muted">Mitad de velocidad; tiras Sigilo en secreto al entrar en la vista de un enemigo.</small></span>
                  <input type="checkbox" checked={t.sneaking} onChange={(e) => vttPlayApi.sneak(campaignId, t.id, e.target.checked).then(() => qc.invalidateQueries({ queryKey: sceneKey }))} />
                </label>
              ))}
              <div className="text-[13px] text-muted">
                <p><b className="text-ink-2">Explorar:</b> WASD o flechas (joystick en el móvil) a la velocidad de tu hoja. En combate, arrastra tu ficha en tu turno.</p>
                <p className="mt-1.5"><b className="text-ink-2">Objetos:</b> acércate (5 pies), tócalo y pulsa «Interactuar».</p>
                <p className="mt-1.5"><b className="text-ink-2">Medir:</b> herramienta de regla; cada diagonal cuenta 5 pies.</p>
                <p className="mt-1.5"><b className="text-ink-2">Niebla:</b> solo ves lo que tus fichas ven según la luz y su visión; lo ya explorado queda en penumbra.</p>
              </div>
            </section>
          )}
        </aside>
      )}
    </div>
  );
}
