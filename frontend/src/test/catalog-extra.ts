/* Extra catalogue fixtures for the creator fixes (contratos/T-6-creador-correcciones.md): two races of
   hairless families (Tabaxi: beast, Dragonborn: reptile) and Drow, whose family fixes a hair colour.
   RACES_EXTRA is the T-5 catalogue plus these three. */
import type { SRDRace } from '../types/srd';
import { RACES } from './catalog';

const race = (r: Pick<SRDRace, 'id' | 'name'> & Partial<SRDRace>): SRDRace => ({
  speed: 30, size: 'M', ability_bonuses: {}, traits: [], languages: ['Common'], subraces: [], description: '', is_srd: false, ...r,
});

export const TABAXI = race({ id: 31, name: "Tabaxi (Volo's Guide to Monsters)", source: 'VGM', ability_bonuses: { dex: 2, cha: 1 }, traits: [{ name: 'Feline Agility', description: 'Double your speed until the end of the turn.' }] });
export const DRAGONBORN = race({ id: 32, name: "Dragonborn (Player's Handbook)", source: 'PHB', ability_bonuses: { str: 2, cha: 1 }, traits: [{ name: 'Breath Weapon', description: 'Exhale destructive energy.' }] });
export const DROW = race({ id: 33, name: "Drow (Mordenkainen's Tome of Foes)", source: 'MTF', ability_bonuses: { dex: 2, cha: 1 }, traits: [{ name: 'Superior Darkvision', description: 'Darkvision out to 120 feet.' }] });

export const RACES_EXTRA: SRDRace[] = [...RACES, TABAXI, DRAGONBORN, DROW];
