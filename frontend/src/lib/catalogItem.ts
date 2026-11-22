import { entriesText } from './abilities';

/** 5etools type code without the source suffix ("M|XPHB" -> "M"). */
const typeCode = (value: unknown) => String(value ?? '').split('|')[0].trim().toUpperCase();

const DAMAGE: Record<string, string> = { S: 'cortante', P: 'perforante', B: 'contundente', A: 'ácido', C: 'frío', F: 'fuego', O: 'fuerza', L: 'relámpago', N: 'necrótico', I: 'veneno', Y: 'psíquico', R: 'radiante', T: 'trueno' };
const PROPERTY: Record<string, string> = { A: 'Munición', AF: 'Munición', BF: 'Pólvora', F: 'Sutil', H: 'Pesada', L: 'Ligera', LD: 'Recarga', R: 'Alcance', RLD: 'Recarga', S: 'Especial', T: 'Arrojadiza', '2H': 'A dos manos', V: 'Versátil' };

/** Inventory rarity value (`very_rare`, …) from a 5etools rarity ("very rare", "none", "artifact"). */
export function catalogRarity(value: unknown): string {
  const rarity = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['uncommon', 'rare', 'very_rare', 'legendary'].includes(rarity)) return rarity;
  if (rarity === 'artifact') return 'legendary';
  return 'common';
}

/** Inventory item_type from a 5etools item entry. */
export function catalogItemType(data: Record<string, unknown>): string {
  const code = typeCode(data.type);
  if (code === 'M' || code === 'R' || data.weapon === true) return 'weapon';
  if (['LA', 'MA', 'HA', 'S'].includes(code) || data.armor === true) return 'armor';
  if (code === 'P') return 'potion';
  if (code === 'SC') return 'scroll';
  if (code === 'A' || code === 'AF') return 'ammunition';
  if (catalogRarity(data.rarity) !== 'common') return 'magic_item';
  return 'gear';
}

/** Readable item text: weapon damage and properties, armor AC, then the entries. */
export function catalogItemDescription(data: Record<string, unknown>): string {
  const lines: string[] = [];
  if (data.dmg1) {
    const damage = `${String(data.dmg1)} ${DAMAGE[typeCode(data.dmgType)] ?? ''}`.trim();
    const properties = (Array.isArray(data.property) ? data.property : []).map((entry) => {
      const code = typeCode(typeof entry === 'object' && entry ? (entry as Record<string, unknown>).uid : entry);
      const label = PROPERTY[code] ?? code;
      return code === 'V' && data.dmg2 ? `${label} (${String(data.dmg2)})` : label;
    }).filter(Boolean);
    lines.push(`Daño: ${damage}${data.range ? ` · Alcance ${String(data.range)} pies` : ''}${properties.length ? ` · Propiedades: ${properties.join(', ')}` : ''}`);
  }
  if (data.ac != null) {
    const code = typeCode(data.type);
    const dex = code === 'LA' ? ' + DES' : code === 'MA' ? ' + DES (máx. 2)' : '';
    lines.push(`CA: ${code === 'S' ? '+' : ''}${String(data.ac)}${dex}${data.strength ? ` · FUE ${String(data.strength)}` : ''}${data.stealth ? ' · Desventaja en Sigilo' : ''}`);
  }
  const text = entriesText(data.entries ?? data.entry ?? '');
  if (text) lines.push(text);
  return lines.join('\n');
}
