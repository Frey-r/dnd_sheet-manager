/* Class colour → aura around the avatar (the class never changes clothing). */
import { hashString, hslToHex } from './color';

const CLASS_COLORS: [RegExp, string][] = [
  [/barbarian|b[aá]rbaro/, '#e04a3a'],
  [/bard|bardo/, '#e86ab0'],
  [/cleric|cl[eé]rigo/, '#f2d050'],
  [/druid|druida/, '#5ab04a'],
  [/fighter|guerrero/, '#a8b4c4'],
  [/monk|monje/, '#5ac9e0'],
  [/paladin|palad[ií]n/, '#fff2b0'],
  [/ranger|explorador|guardabosques/, '#8aa83a'],
  [/rogue|p[ií]caro/, '#6a4a9a'],
  [/sorcerer|hechicero/, '#f08a3a'],
  [/warlock|brujo/, '#a04ad0'],
  [/wizard|mago/, '#4a7ae0'],
  [/artificer|art[ií]fice/, '#c97a4a'],
  [/blood ?hunter|cazador de sangre/, '#a01a2a'],
  [/psion|mystic|m[ií]stico/, '#d070e0'],
];

/** Aura colour for a class name (EN/ES); homebrew classes get a stable colour from their name. */
export function auraForClass(className: string | null | undefined): string | null {
  const name = (className ?? '').trim().toLowerCase();
  if (!name) return null;
  for (const [re, color] of CLASS_COLORS) if (re.test(name)) return color;
  return hslToHex(hashString(name) % 360, 0.65, 0.58);
}
