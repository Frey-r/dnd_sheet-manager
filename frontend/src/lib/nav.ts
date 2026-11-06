/* Campaign navigation model shared by the sidebar and the mobile menu. */
export interface NavEntry { to: string; icon: string; label: string; end?: boolean }

export function campaignNav(campaignId: string, myCharacterId: number | undefined, isGM: boolean, isFoundry: boolean) {
  const c = `/campaign/${campaignId}`;
  const play: NavEntry[] = [
    { to: c, icon: 'home', label: 'Hub de campaña', end: true },
    { to: `${c}/table`, icon: 'grid_on', label: 'Mesa virtual' },
    ...(myCharacterId || !isGM ? [{ to: myCharacterId ? `${c}/character/${myCharacterId}` : `${c}/character/new`, icon: 'badge', label: myCharacterId ? 'Mi hoja de personaje' : 'Crear personaje' }] : []),
    { to: isGM ? `${c}/gm/combat` : `${c}/encounter`, icon: 'swords', label: 'Iniciativa' },
    { to: `${c}/lore`, icon: 'auto_awesome', label: 'Oráculo de lore' },
    { to: `${c}/chat`, icon: 'forum', label: 'Mensajería' },
    { to: `${c}/market`, icon: 'storefront', label: 'Mercado' },
    { to: `${c}/trade`, icon: 'swap_horiz', label: 'Intercambios' },
    { to: `${c}/reference`, icon: 'menu_book', label: 'Compendio' },
  ];
  const gm: NavEntry[] = isGM ? [
    { to: `${c}/gm`, icon: 'shield_person', label: 'Consola del DM', end: true },
    { to: `${c}/gm/party`, icon: 'groups', label: 'Grupo' },
    { to: `${c}/gm/encounter-builder`, icon: 'bolt', label: 'Generador de encuentros' },
    { to: `${c}/gm/npcs`, icon: 'theater_comedy', label: 'NPCs' },
    { to: `${c}/gm/bestiary`, icon: 'pets', label: 'Bestiario' },
    { to: `${c}/gm/maps`, icon: 'map', label: 'Mapas' },
    { to: `${c}/gm/events`, icon: 'calendar_month', label: 'Eventos' },
    { to: `${c}/gm/notes`, icon: 'edit_note', label: 'Notas' },
    { to: `${c}/gm/lore`, icon: 'history_edu', label: 'Editor de lore' },
    { to: `${c}/gm/bot`, icon: 'smart_toy', label: 'Bot asistente' },
    ...(isFoundry ? [{ to: `${c}/combat`, icon: 'link', label: 'Foundry VTT' }] : []),
  ] : [];
  return { play, gm };
}
