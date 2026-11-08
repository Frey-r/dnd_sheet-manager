/* Maps catalogue race names (EN + ES, every source) to a visual family
   (openspec/specs/character-appearance.md, "Race families"). */
import type { HeadType, Part, RaceOption, RaceVisual, Size } from './types';
import type { SkinKey } from './palettes';

/** "Elf (Player's Handbook (2024))" → { base: "Elf", source: "Player's Handbook (2024)" } */
export function splitSource(name: string) {
  const m = name.match(/^(.*?)\s*\(((?:[^()]|\([^()]*\))*)\)\s*$/);
  return m ? { base: m[1].trim(), source: m[2].trim() } : { base: name.trim(), source: '' };
}

const opt = (label: string, ...parts: Part[]): RaceOption => ({ label, parts });

interface Def {
  key: string;
  label: string;
  match: RegExp;
  size: Size;
  head?: HeadType;
  hair?: boolean;
  skin: SkinKey;
  base?: Part[];
  options?: RaceOption[];
  accentLabel?: string;
  defaults?: RaceVisual['defaults'];
}

const HUMAN_OPTIONS = [opt('Natural'), opt('Pecas', 'freckles'), opt('Cicatriz', 'scar'), opt('Tatuaje', 'tattoo')];
const BEAST = { head: 'beast' as const, hair: false, accentLabel: 'Color de manchas' };
const BIRD = { head: 'beak' as const, hair: false, accentLabel: 'Color de plumas' };

/** Order matters: specific names first ("half-elf" before "elf", "deep gnome" before "gnome"). */
const DEFS: Def[] = [
  // ── Mixed ancestry first ──
  { key: 'half-elf', label: 'Semielfo', match: /half[- ]?(elf|moon elf|sun elf|wood elf|aquatic elf)|semielf|mezzelf|khoravar/, size: 'M', skin: 'elf',
    options: [opt('Orejas cortas', 'ears-elf-short'), opt('Orejas hacia atrás', 'ears-swept'), opt('Pecas', 'ears-elf-short', 'freckles'), opt('Marca', 'ears-elf-short', 'mark')] },
  { key: 'half-drow', label: 'Semidrow', match: /half[- ]?drow/, size: 'M', skin: 'drow', defaults: { hairColor: '#f2f2f2' },
    options: [opt('Orejas cortas', 'ears-elf-short'), opt('Orejas hacia atrás', 'ears-swept')] },
  { key: 'half-orc', label: 'Semiorco', match: /half[- ]?orc|semiorc/, size: 'M', skin: 'orc',
    options: [opt('Colmillos', 'fangs'), opt('Colmillos grandes', 'tusks'), opt('Cicatriz', 'fangs', 'scar'), opt('Tatuaje', 'fangs', 'tattoo')] },
  { key: 'half-dwarf', label: 'Semienano', match: /half[- ]?dwar|mezzi-nani/, size: 'M', skin: 'human',
    options: [opt('Barba corta', 'beard-short'), opt('Patillas', 'sideburns'), opt('Natural')] },

  // ── Elves ──
  { key: 'drow', label: 'Drow', match: /drow|elfo oscuro|dark elf/, size: 'M', skin: 'drow', defaults: { hairColor: '#f2f2f2', eyes: '#c0392b' },
    options: [opt('Orejas largas', 'ears-elf'), opt('Orejas hacia atrás', 'ears-swept'), opt('Marcas', 'ears-elf', 'tattoo')] },
  { key: 'shadar-kai', label: 'Shadar-kai', match: /shadar/, size: 'M', skin: 'undead', defaults: { hairColor: '#1d1a18' },
    options: [opt('Orejas largas', 'ears-elf'), opt('Tatuajes', 'ears-elf', 'tattoo'), opt('Sombra', 'ears-swept', 'shadow')] },
  { key: 'sea-elf', label: 'Elfo marino', match: /sea elf|elfo marino|aquatic elf/, size: 'M', skin: 'sea',
    options: [opt('Aletas', 'ears-elf', 'fins'), opt('Branquias', 'ears-swept', 'gills'), opt('Manchas', 'ears-elf', 'spots')] },
  { key: 'astral-elf', label: 'Elfo astral', match: /astral elf|elfo astral/, size: 'M', skin: 'pale', defaults: { eyes: '#9ad0e0' },
    options: [opt('Ojos estelares', 'ears-elf', 'glow-eyes'), opt('Orejas hacia atrás', 'ears-swept', 'glow-eyes'), opt('Marca', 'ears-elf', 'mark')] },
  { key: 'elf', label: 'Elfo', match: /\belf|elfo|elfi|eladrin|eldori|sylvan|feyblood/, size: 'M', skin: 'elf',
    options: [opt('Orejas largas', 'ears-elf'), opt('Orejas hacia atrás', 'ears-swept'), opt('Orejas cortas', 'ears-elf-short'), opt('Marcas feéricas', 'ears-elf', 'tattoo')] },

  // ── Small folk ──
  { key: 'deep-gnome', label: 'Gnomo de las profundidades', match: /deep gnome|svirfnebl|gnomo de las prof/, size: 'S', skin: 'undead', defaults: { hair: 0 },
    options: [opt('Orejas grandes', 'ears-gnome'), opt('Cicatriz', 'ears-gnome', 'scar')] },
  { key: 'autognome', label: 'Autognomo', match: /autognom/, size: 'S', hair: false, skin: 'metal', accentLabel: 'Color de detalles',
    options: [opt('Placas', 'ears-gnome', 'plates'), opt('Visor', 'plates', 'visor'), opt('Gema', 'plates', 'gem')] },
  { key: 'gnome', label: 'Gnomo', match: /gnom|gnomo/, size: 'S', skin: 'human',
    options: [opt('Orejas grandes', 'ears-gnome'), opt('Pecas', 'ears-gnome', 'freckles'), opt('Barba', 'ears-gnome', 'beard-short')] },
  { key: 'halfling', label: 'Mediano', match: /halfling|mediano|hobbit|kender|kithkin|quickstep|lotol/, size: 'S', skin: 'human',
    options: [opt('Natural'), opt('Pecas', 'freckles'), opt('Patillas', 'sideburns')] },
  { key: 'derro', label: 'Derro', match: /derro/, size: 'S', skin: 'pale', defaults: { hairColor: '#f2f2f2', hair: 8 },
    options: [opt('Ojos pálidos', 'glow-eyes'), opt('Cicatriz', 'scar')] },

  // ── Dwarves ──
  { key: 'duergar', label: 'Duergar', match: /duergar/, size: 'D', skin: 'undead', defaults: { hair: 0 },
    options: [opt('Barba corta', 'beard-short'), opt('Barba completa', 'beard-full'), opt('Cicatriz', 'beard-short', 'scar')] },
  { key: 'dwarf', label: 'Enano', match: /dwar|enan|nani/, size: 'D', skin: 'human',
    options: [opt('Barba completa', 'beard-full'), opt('Barba trenzada', 'beard-braided'), opt('Barba corta', 'beard-short'), opt('Sin barba')] },

  // ── Fiends, celestials, planar ──
  { key: 'tiefling', label: 'Tiflin', match: /tiefling|tiflin|malebranche|profondi|cursed-blood/, size: 'M', skin: 'tiefling', base: ['tail-devil'],
    defaults: { eyes: '#c9a227', hairColor: '#1d1a18' },
    options: [opt('Cuernos curvos', 'horns-curved'), opt('Cuernos de carnero', 'horns-ram'), opt('Cuernos rectos', 'horns-straight'), opt('Cuernos hacia atrás', 'horns-back')] },
  { key: 'impling', label: 'Diablillo', match: /impling/, size: 'S', skin: 'tiefling', base: ['tail-devil', 'wings-bat'],
    options: [opt('Cuernitos', 'horns-nubs'), opt('Cuernos curvos', 'horns-curved')] },
  { key: 'aasimar', label: 'Aasimar', match: /aasimar|nephilim|luma|scion/, size: 'M', skin: 'human', defaults: { eyes: '#f2f2f2', hairColor: '#e8d8a8' },
    options: [opt('Halo', 'halo'), opt('Ojos radiantes', 'glow-eyes'), opt('Halo y ojos', 'halo', 'glow-eyes'), opt('Alas', 'wings-feather')] },
  { key: 'genasi-fire', label: 'Genasi de fuego', match: /fire genasi|genasi de fuego|flamekin|coalder|kilnkin/, size: 'M', hair: false, skin: 'genasi',
    accentLabel: 'Color elemental', defaults: { skin: '#d9542c', hairColor: '#f08a3a', feature: 0, eyes: '#f2f2f2' },
    options: [opt('Fuego', 'flame-hair'), opt('Agua', 'water-hair'), opt('Tierra', 'stone-hair'), opt('Aire', 'air-hair')] },
  { key: 'genasi-water', label: 'Genasi de agua', match: /water genasi|genasi de agua/, size: 'M', hair: false, skin: 'genasi',
    accentLabel: 'Color elemental', defaults: { skin: '#3f7fbf', hairColor: '#5fb3c9', feature: 1 },
    options: [opt('Fuego', 'flame-hair'), opt('Agua', 'water-hair'), opt('Tierra', 'stone-hair'), opt('Aire', 'air-hair')] },
  { key: 'genasi-earth', label: 'Genasi de tierra', match: /earth genasi|genasi de tierra|rimekin/, size: 'M', hair: false, skin: 'genasi',
    accentLabel: 'Color elemental', defaults: { skin: '#8a7350', hairColor: '#6b6b6b', feature: 2 },
    options: [opt('Fuego', 'flame-hair'), opt('Agua', 'water-hair'), opt('Tierra', 'stone-hair'), opt('Aire', 'air-hair')] },
  { key: 'genasi', label: 'Genasi', match: /genasi|jinnborn|primordial/, size: 'M', hair: false, skin: 'genasi',
    accentLabel: 'Color elemental', defaults: { skin: '#a8c6dc', hairColor: '#f2f2f2', feature: 3 },
    options: [opt('Fuego', 'flame-hair'), opt('Agua', 'water-hair'), opt('Tierra', 'stone-hair'), opt('Aire', 'air-hair')] },
  { key: 'gith', label: 'Gith', match: /gith/, size: 'M', skin: 'gith', base: ['ears-swept'],
    options: [opt('Natural'), opt('Tatuaje', 'tattoo'), opt('Cicatriz', 'scar')] },

  // ── Dragons & reptiles ──
  { key: 'kobold', label: 'Kobold', match: /kobold/, size: 'S', head: 'reptile', hair: false, skin: 'dragon', base: ['tail-reptile'], accentLabel: 'Color de cresta',
    options: [opt('Cuernitos', 'horns-nubs'), opt('Gola', 'frill'), opt('Espinas', 'spines')] },
  { key: 'dragonborn', label: 'Dracónido', match: /dragonborn|draconid|dracónid|draconblood|ravenite|vor'tai/, size: 'M', head: 'reptile', hair: false, skin: 'dragon', accentLabel: 'Color de cresta',
    defaults: { eyes: '#c9a227', hairColor: '#d9a441' },
    options: [opt('Cuernos', 'horns-back'), opt('Gola', 'frill'), opt('Espinas', 'spines'), opt('Gema', 'horns-back', 'gem')] },
  { key: 'tortle', label: 'Tortle', match: /tortle|tortuga/, size: 'M', head: 'reptile', hair: false, skin: 'reptile', base: ['shell'], accentLabel: 'Color de caparazón', defaults: { hairColor: '#6b4a33' },
    options: [opt('Liso'), opt('Manchas', 'spots'), opt('Rayas', 'stripes')] },
  { key: 'lizardfolk', label: 'Hombre lagarto', match: /lizard|lagart|saurian|subek|salari|naga|satarre/, size: 'M', head: 'reptile', hair: false, skin: 'reptile', base: ['tail-reptile'], accentLabel: 'Color de cresta', defaults: { hairColor: '#b5452c', eyes: '#c9a227' },
    options: [opt('Cresta', 'crest'), opt('Espinas', 'spines'), opt('Gola', 'frill')] },
  { key: 'yuan-ti', label: 'Yuan-ti', match: /yuan|medusa/, size: 'M', skin: 'reptile', defaults: { eyes: '#c9a227' },
    options: [opt('Escamas', 'spots', 'fangs'), opt('Rayas', 'stripes', 'fangs'), opt('Ojos de serpiente', 'glow-eyes', 'fangs')] },

  // ── Beasts ──
  { key: 'leonin', label: 'Leonino', match: /leonin|leonino/, size: 'L', ...BEAST, skin: 'fur', base: ['ears-cat', 'mane', 'tail-cat'],
    defaults: { skin: '#d4b483', hairColor: '#8a5a2a' }, accentLabel: 'Color de melena',
    options: [opt('Natural'), opt('Cicatriz', 'scar'), opt('Bigotes', 'whiskers')] },
  { key: 'tabaxi', label: 'Tabaxi', match: /tabaxi|catfolk|grimalkin|felin|gato/, size: 'M', ...BEAST, skin: 'fur', base: ['ears-cat', 'tail-cat'], defaults: { skin: '#e0a040', hairColor: '#6b3e1f', eyes: '#4a8a4a' },
    options: [opt('Manchas', 'spots'), opt('Rayas', 'stripes'), opt('Liso'), opt('Bigotes', 'whiskers')] },
  { key: 'harengon', label: 'Harengon', match: /harengon|lupin|jerbeen|rabbit|conejo/, size: 'S', ...BEAST, skin: 'fur', base: ['tail-stub'],
    options: [opt('Orejas altas', 'ears-rabbit'), opt('Orejas caídas', 'ears-floppy'), opt('Manchas', 'ears-rabbit', 'spots')] },
  { key: 'rodent', label: 'Roedor', match: /\brat|mouse|nezumi|mousquet|possum|ratatosk|erina|hedgehog|erizo/, size: 'S', ...BEAST, skin: 'fur', base: ['ears-mouse', 'tail-rat'], defaults: { skin: '#b8b8b8', eyes: '#2b2b2b' },
    options: [opt('Bigotes', 'whiskers'), opt('Manchas', 'whiskers', 'spots'), opt('Cicatriz', 'whiskers', 'scar')] },
  { key: 'raccoon', label: 'Mapache', match: /mapach|raccoon/, size: 'S', ...BEAST, skin: 'fur', base: ['ears-bear', 'tail-fox', 'stripes'], defaults: { skin: '#b8b8b8', hairColor: '#3a3a3a' },
    options: [opt('Natural'), opt('Bigotes', 'whiskers')] },
  { key: 'fox', label: 'Zorruno', match: /vulpin|phaenec|fox|zorro|kitsune|yokai/, size: 'M', ...BEAST, skin: 'fur', base: ['ears-fox', 'tail-fox'],
    defaults: { skin: '#c9823a' }, options: [opt('Natural'), opt('Manchas', 'spots'), opt('Bigotes', 'whiskers')] },
  { key: 'gnoll', label: 'Gnoll', match: /gnoll|khenra|hyena|hiena|chazrac/, size: 'L', ...BEAST, skin: 'fur', base: ['ears-dog', 'tail-stub'], defaults: { skin: '#d4b483', hairColor: '#3a3a3a', eyes: '#c9a227' },
    options: [opt('Manchas', 'spots'), opt('Rayas', 'stripes'), opt('Colmillos', 'fangs')] },
  { key: 'bear', label: 'Osuno', match: /bear|oso|squatch|bugbear|guul'dar/, size: 'L', ...BEAST, skin: 'fur', base: ['ears-bear'],
    defaults: { skin: '#6b4a33' }, options: [opt('Natural'), opt('Colmillos', 'fangs'), opt('Cicatriz', 'scar')] },
  { key: 'minotaur', label: 'Minotauro', match: /minotaur|minotauro|tuss|ramag/, size: 'L', ...BEAST, skin: 'fur', base: ['ears-floppy', 'tail-horse'],
    defaults: { skin: '#6b4a33' }, options: [opt('Cuernos de toro', 'horns-bull'), opt('Cuernos curvos', 'horns-curved'), opt('Cuernos rectos', 'horns-straight')] },
  { key: 'cervan', label: 'Cérvido', match: /cervan|deer|ciervo|alseid/, size: 'M', ...BEAST, skin: 'fur', base: ['ears-floppy', 'tail-stub'], defaults: { skin: '#c9823a', hairColor: '#f2e6d0' },
    options: [opt('Astas', 'horns-antlers'), opt('Manchas', 'spots'), opt('Astas y manchas', 'horns-antlers', 'spots')] },
  { key: 'loxodon', label: 'Loxodon', match: /loxodon|giff|elephant|elefante/, size: 'L', head: 'elephant', hair: false, skin: 'elephant', accentLabel: 'Color de tatuaje',
    options: [opt('Natural'), opt('Colmillos', 'trunk-tusks'), opt('Tatuaje', 'tattoo')] },

  // ── Birds ──
  { key: 'owlin', label: 'Owlin', match: /owlin|strig|búho|buho/, size: 'M', ...BIRD, skin: 'feather', base: ['wings-feather', 'ears-cat'],
    defaults: { skin: '#6b4a2e', eyes: '#c9a227' }, options: [opt('Plumaje liso'), opt('Moteado', 'spots'), opt('Penacho', 'crest')] },
  { key: 'kenku', label: 'Kenku', match: /kenku|raven|corvum|tengu|cuervo/, size: 'M', ...BIRD, skin: 'feather', defaults: { skin: '#3a3a44' },
    options: [opt('Plumaje liso'), opt('Penacho', 'crest'), opt('Alas', 'wings-feather')] },
  { key: 'aarakocra', label: 'Aarakocra', match: /aarakocra|\baven\b|avia|gallus|raptor|bird|\bave\b/, size: 'M', ...BIRD, skin: 'feather', base: ['wings-feather'],
    defaults: { skin: '#b03a2e' }, options: [opt('Penacho', 'crest'), opt('Plumaje liso'), opt('Moteado', 'spots')] },

  // ── Aquatic & amphibians ──
  { key: 'fishfolk', label: 'Pez', match: /locathah|sahuagin|kuo|sea spawn|finfolk|nautilid|cnidaran|deep one/, size: 'M', head: 'fish', hair: false, skin: 'sea', base: ['fins'], accentLabel: 'Color de aletas', defaults: { hairColor: '#e07a2e' },
    options: [opt('Aletas'), opt('Branquias', 'gills'), opt('Manchas', 'spots')] },
  { key: 'triton', label: 'Tritón', match: /triton|tritón|merfolk|sirena|siren|astral merfolk/, size: 'M', skin: 'sea',
    options: [opt('Aletas', 'fins'), opt('Branquias', 'fins', 'gills'), opt('Escamas', 'fins', 'spots')] },
  { key: 'frog', label: 'Batracio', match: /grung|bullywug|frog|rana/, size: 'S', head: 'frog', hair: false, skin: 'amphibian', accentLabel: 'Color de manchas', defaults: { hairColor: '#1d1a18' },
    options: [opt('Liso'), opt('Manchas', 'spots'), opt('Rayas', 'stripes')] },

  // ── Constructs, undead, odd bodies ──
  { key: 'warforged', label: 'Forjado', match: /warforged|forjado|gearforged|automaton|ashenforged|promethean|bloodwork/, size: 'M', hair: false, skin: 'metal', base: ['plates'], accentLabel: 'Color de runas',
    defaults: { eyes: '#9ad0e0' }, options: [opt('Placas'), opt('Visor', 'visor'), opt('Gema', 'gem'), opt('Runas', 'tattoo')] },
  { key: 'puppet', label: 'Marioneta', match: /marionette|geppettin|manikin|plushie|bisque|wicker/, size: 'S', hair: true, skin: 'wood', base: ['stitches'],
    options: [opt('Costuras'), opt('Pecas', 'freckles'), opt('Marca', 'mark')] },
  { key: 'skeleton', label: 'Esqueleto', match: /skeleton|esqueleto/, size: 'M', head: 'skull', hair: false, skin: 'bone', accentLabel: 'Color de brillo',
    defaults: { eyes: '#9ad0e0' }, options: [opt('Ojos brillantes', 'glow-eyes'), opt('Cuencas vacías')] },
  { key: 'zombie', label: 'No muerto', match: /zombie|zombi|reborn|renacid|darakhul|grim|scourge/, size: 'M', skin: 'undead',
    options: [opt('Costuras', 'stitches'), opt('Cicatriz', 'scar'), opt('Ojos brillantes', 'glow-eyes')] },
  { key: 'vampire', label: 'Vampiro', match: /vampir|dhampir|morgant/, size: 'M', skin: 'pale', defaults: { eyes: '#c0392b', hairColor: '#1d1a18' },
    options: [opt('Colmillos', 'fangs'), opt('Ojos rojos', 'fangs', 'glow-eyes'), opt('Orejas puntiagudas', 'fangs', 'ears-swept')] },
  { key: 'shade', label: 'Sombra', match: /shade|specter|espectro|spirit|umbral|ombrask/, size: 'M', skin: 'pale', defaults: { eyes: '#9ad0e0' },
    options: [opt('Sombra', 'shadow'), opt('Ojos brillantes', 'glow-eyes'), opt('Sombra y ojos', 'shadow', 'glow-eyes')] },
  { key: 'hexblood', label: 'Sangre maldita', match: /hexblood|hag/, size: 'M', skin: 'fey', defaults: { hairColor: '#3a8a4a' },
    options: [opt('Marca', 'mark', 'ears-swept'), opt('Pecas', 'freckles', 'ears-swept'), opt('Ojo extra', 'third-eye')] },
  { key: 'ooze', label: 'Plasmoide', match: /plasmoid|plasmoide|ooze|amoeb/, size: 'M', head: 'ooze', hair: false, skin: 'ooze', accentLabel: 'Color de núcleo',
    options: [opt('Liso'), opt('Manchas', 'spots'), opt('Ojo brillante', 'glow-eyes')] },
  { key: 'insect', label: 'Insectoide', match: /thri-?kreen|tosculi|opteran|kreen|carapace|\bzek\b|insect|beefling/, size: 'M', head: 'insect', hair: false, skin: 'insect', base: ['antennae'], accentLabel: 'Color de caparazón', defaults: { hairColor: '#c9a227', eyes: '#3b6ea5' },
    options: [opt('Liso'), opt('Rayas', 'stripes'), opt('Manchas', 'spots')] },
  { key: 'cyclops', label: 'Cíclope', match: /cyclop|oculus|cíclope/, size: 'L', skin: 'human', base: ['cyclops'],
    options: [opt('Natural'), opt('Cicatriz', 'scar')] },

  // ── Fey & plants ──
  { key: 'fairy', label: 'Hada', match: /fairy|faerie|pixie|hada|nymph|ninfa|dryad|belare/, size: 'S', skin: 'fey', base: ['wings-fairy'],
    options: [opt('Orejas puntiagudas', 'ears-elf'), opt('Pecas', 'ears-elf', 'freckles'), opt('Hojas', 'ears-elf', 'leaves')] },
  { key: 'satyr', label: 'Sátiro', match: /satyr|sátiro|fauno/, size: 'M', skin: 'human', base: ['tail-stub', 'ears-swept'],
    options: [opt('Cuernos de carnero', 'horns-ram'), opt('Cuernos curvos', 'horns-curved'), opt('Cuernitos', 'horns-nubs')] },
  { key: 'mushroom', label: 'Hongo', match: /mushroom|mycelian|myconid|mandrake|snowcap|hongo/, size: 'S', hair: false, skin: 'plant', base: ['mushroom-cap'], accentLabel: 'Color de sombrero',
    defaults: { hairColor: '#a83232' }, options: [opt('Sombrero'), opt('Manchas', 'spots'), opt('Hojas', 'leaves')] },
  { key: 'plant', label: 'Planta', match: /verdan|piney|garden born|wood|dendus|hedge/, size: 'S', skin: 'plant', base: ['ears-swept'],
    options: [opt('Hojas', 'leaves'), opt('Manchas', 'spots'), opt('Natural')] },
  { key: 'firbolg', label: 'Firbolg', match: /firbolg/, size: 'L', skin: 'firbolg', base: ['ears-floppy'],
    options: [opt('Natural'), opt('Barba', 'beard-full'), opt('Pecas', 'freckles')] },
  { key: 'centaur', label: 'Centauro', match: /centaur|centauro/, size: 'L', skin: 'human', base: ['tail-horse'], options: HUMAN_OPTIONS },

  // ── Big humanoids ──
  { key: 'orc', label: 'Orco', match: /\borc|orco|ogre|ogro|troll/, size: 'L', skin: 'orc',
    options: [opt('Colmillos', 'tusks'), opt('Cicatriz', 'tusks', 'scar'), opt('Tatuaje', 'tusks', 'tattoo'), opt('Colmillos pequeños', 'fangs')] },
  { key: 'goliath', label: 'Goliat', match: /goliath|goliat|giant|gigante|cyclopian|tallfolk/, size: 'L', skin: 'elephant', defaults: { hair: 0 },
    options: [opt('Marcas', 'tattoo'), opt('Manchas', 'spots'), opt('Cicatriz', 'scar'), opt('Natural')] },
  { key: 'hobgoblin', label: 'Hobgoblin', match: /hobgoblin|ghaal'dar/, size: 'M', skin: 'goblin', base: ['ears-swept'], defaults: { skin: '#c97d3a' },
    options: [opt('Natural'), opt('Tatuaje', 'tattoo'), opt('Colmillos', 'fangs')] },
  { key: 'goblin', label: 'Goblin', match: /goblin|gobboc|golin'dar|boggart/, size: 'S', skin: 'goblin',
    options: [opt('Orejas largas', 'ears-swept'), opt('Orejas caídas', 'ears-floppy'), opt('Colmillos', 'ears-swept', 'fangs')] },

  // ── Humans and human-looking ──
  { key: 'changeling', label: 'Cambiante', match: /changeling|cambiante/, size: 'M', skin: 'pale', defaults: { hairColor: '#f2f2f2', eyes: '#f2f2f2' },
    options: [opt('Natural'), opt('Ojos vacíos', 'glow-eyes'), opt('Marca', 'mark')] },
  { key: 'kalashtar', label: 'Kalashtar', match: /kalashtar/, size: 'M', skin: 'human',
    options: [opt('Ojos brillantes', 'glow-eyes'), opt('Marca', 'mark'), opt('Natural')] },
  { key: 'vedalken', label: 'Vedalken', match: /vedalken/, size: 'M', skin: 'blue', defaults: { hair: 0 }, options: HUMAN_OPTIONS },
  { key: 'simic', label: 'Híbrido simic', match: /simic/, size: 'M', skin: 'human',
    options: [opt('Aletas', 'fins'), opt('Manchas', 'spots'), opt('Antenas', 'antennae'), opt('Branquias', 'gills')] },
  { key: 'shifter', label: 'Cambiaformas', match: /shifter|beast|bestia|cambiaform|animal|trollkin/, size: 'M', skin: 'human',
    options: [opt('Colmillos', 'fangs', 'sideburns'), opt('Orejas de lobo', 'ears-dog', 'fangs'), opt('Rayas', 'stripes', 'sideburns')] },
  { key: 'hadozee', label: 'Hadozee', match: /hadozee|simio|monkey/, size: 'M', skin: 'fur', base: ['sideburns', 'tail-cat'], options: HUMAN_OPTIONS },
  { key: 'human', label: 'Humano', match: /human|humano|umani|mark of|aetherborn|kor\b|near/, size: 'M', skin: 'human', options: HUMAN_OPTIONS },
];

const cache = new Map<string, RaceVisual>();

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function toVisual(def: Def, size?: Size): RaceVisual {
  return {
    key: def.key,
    label: def.label,
    size: size ?? def.size,
    head: def.head ?? 'human',
    hair: def.hair ?? true,
    skin: def.skin,
    base: def.base ?? [],
    options: def.options ?? HUMAN_OPTIONS,
    accentLabel: def.accentLabel,
    defaults: def.defaults,
  };
}

function sizeFromCatalog(size?: string | null): Size {
  const s = (size ?? '').trim().toUpperCase();
  if (s.startsWith('S') || s.startsWith('P') || s === 'T') return 'S';
  if (s.startsWith('L') || s.startsWith('G') || s.startsWith('H')) return 'L';
  return 'M';
}

/** Visual family for a race name (with or without its source suffix). */
export function resolveRaceVisual(raceName: string | null | undefined, catalogSize?: string | null): RaceVisual {
  const key = `${raceName ?? ''}|${catalogSize ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = strip(splitSource(raceName ?? '').base);
  const def = DEFS.find((d) => d.match.test(base));
  const visual = def ? toVisual(def) : { ...toVisual(DEFS[DEFS.length - 1], sizeFromCatalog(catalogSize)), key: 'custom', label: 'Humanoide' };
  cache.set(key, visual);
  return visual;
}

/** Races offered first in the picker. */
export const COMMON_RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Orc', 'Tiefling', 'Dragonborn', 'Aasimar', 'Goliath'];

export const ALL_FAMILY_KEYS = DEFS.map((d) => d.key);
export function visualByKey(key: string): RaceVisual | undefined {
  const def = DEFS.find((d) => d.key === key);
  return def && toVisual(def);
}
