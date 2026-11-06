import { Link, useLocation } from 'react-router-dom';
import { useRealtime } from '../../lib/RealtimeContext';
import { useAuth } from '../../lib/hooks';
import type { CampaignSummary } from '../../lib/useCampaign';

const SECTION: [RegExp, string][] = [
  [/\/table$/, 'Mesa virtual'], [/\/character\/new$/, 'Nuevo personaje'], [/\/character\/\d+\/spells$/, 'Conjuros'],
  [/\/character\/\d+\/inventory$/, 'Inventario'], [/\/character\/\d+\/features$/, 'Rasgos'], [/\/character\/\d+\/bio$/, 'Biografía'],
  [/\/character\/\d+$/, 'Hoja de personaje'], [/\/encounter$/, 'Iniciativa'], [/\/gm\/combat$/, 'Rastreador de combate'],
  [/\/combat$/, 'Foundry VTT'], [/\/\d+\/lore$/, 'Oráculo de lore'], [/\/chat$/, 'Mensajería'], [/\/market$/, 'Mercado'],
  [/\/trade$/, 'Intercambios'], [/\/reference$/, 'Compendio'], [/\/gm$/, 'Consola del DM'], [/\/gm\/party$/, 'Grupo'],
  [/\/gm\/encounter-builder$/, 'Generador de encuentros'], [/\/gm\/npcs/, 'NPCs'], [/\/gm\/bestiary/, 'Bestiario'],
  [/\/gm\/maps/, 'Mapas'], [/\/gm\/events$/, 'Eventos'], [/\/gm\/notes$/, 'Notas'], [/\/gm\/lore$/, 'Editor de lore'],
  [/\/gm\/bot$/, 'Bot asistente'], [/\/gm\/spells-srd$/, 'Conjuros SRD'], [/^\/campaigns\/new$/, 'Nueva campaña'],
  [/^\/campaigns$/, 'Mis campañas'], [/^\/settings$/, 'Ajustes'],
];

const WS: Record<string, [string, string]> = {
  connected: ['Conectado', 'bg-ok shadow-[0_0_0_3px_var(--ok-soft)]'],
  connecting: ['Reconectando…', 'bg-warn shadow-[0_0_0_3px_var(--warn-soft)] animate-[blink_1s_infinite]'],
  disconnected: ['Desconectado', 'bg-bad shadow-[0_0_0_3px_var(--bad-soft)]'],
};

export function TopAppBar({ campaign, isGM }: { campaign?: CampaignSummary; isGM: boolean }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const status = useRealtime();
  const section = SECTION.find(([re]) => re.test(pathname))?.[1];
  const [wsLabel, wsDot] = WS[status] ?? WS.disconnected;
  const roleLabel = campaign ? (isGM ? ['Dungeon Master', 'text-gold'] : ['Jugador', 'text-[color:var(--ok)]']) : user?.role === 'admin' ? ['Admin', 'text-bad'] : user?.role === 'dm' ? ['Dungeon Master', 'text-gold'] : ['Jugador', 'text-[color:var(--ok)]'];
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--bg)_84%,transparent)] px-4 backdrop-blur-md md:px-6">
      <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
        {campaign && <><Link to={`/campaign/${campaign.id}`} className="hidden truncate hover:text-ink sm:inline">{campaign.name}</Link>{section && <span className="hidden text-faint sm:inline">/</span>}</>}
        {section && <b className="truncate font-semibold text-ink">{section}</b>}
        {!section && campaign && <b className="truncate font-semibold text-ink sm:hidden">{campaign.name}</b>}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {campaign && (
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink-2" title="Conexión en tiempo real">
            <span className={`h-[7px] w-[7px] rounded-full ${wsDot}`} /><span className="hidden sm:inline">{wsLabel}</span>
          </span>
        )}
        <Link to="/settings" className="flex items-center gap-2 rounded-full border border-line bg-card py-[3px] pl-[3px] pr-2.5 transition-colors hover:border-line-strong">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{(user?.username || '?').slice(0, 2).toUpperCase()}</span>
          <span className="hidden leading-tight sm:block">
            <b className="block text-[12.5px] font-semibold">{user?.username}</b>
            <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${roleLabel[1]}`}>{roleLabel[0]}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
