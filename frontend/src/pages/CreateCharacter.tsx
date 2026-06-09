import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { characterApi } from '../services/api';
import { listRaces, listClasses } from '../services/srdService';
import { useToast } from '../lib/hooks';
import type { SRDRace, SRDClass } from '../types/srd';
function safeParseArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [];
}

function safeParseObject(val: any): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'object' && val !== null) return val;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch (e) {}
  return {};
}

const statTranslations: Record<string, string> = {
  'Strength': 'Fuerza',
  'Dexterity': 'Destreza',
  'Constitution': 'Constitución',
  'Intelligence': 'Inteligencia',
  'Wisdom': 'Sabiduría',
  'Charisma': 'Carisma',
  'str': 'Fuerza',
  'dex': 'Destreza',
  'con': 'Constitución',
  'int': 'Inteligencia',
  'wis': 'Sabiduría',
  'cha': 'Carisma'
};

const sizeTranslations: Record<string, string> = {
  'Tiny': 'Diminuto',
  'Small': 'Pequeño',
  'Medium': 'Mediano',
  'Large': 'Grande',
  'Huge': 'Enorme',
  'Gargantuan': 'Gargantuesco'
};

const proficiencyTranslations: Record<string, string> = {
  'Light': 'Armadura Ligera',
  'Medium': 'Armadura Media',
  'Heavy': 'Armadura Pesada',
  'Shields': 'Escudos',
  'Simple Weapons': 'Armas Sencillas',
  'Martial Weapons': 'Armas Marciales',
  'All Armor': 'Todas las Armaduras',
  'Simple weapons': 'Armas sencillas',
  'Martial weapons': 'Armas marciales'
};

function translateProficiencies(arr: string[]): string {
  if (!arr || arr.length === 0) return 'Ninguna';
  return arr.map(p => proficiencyTranslations[p] || p).join(', ');
}

function translateStatsList(text: string): string {
  if (!text) return '';
  const wordTranslations: Record<string, string> = {
    'or': 'o',
    'and': 'y',
    'Strength': 'Fuerza',
    'Dexterity': 'Destreza',
    'Constitution': 'Constitución',
    'Intelligence': 'Inteligencia',
    'Wisdom': 'Sabiduría',
    'Charisma': 'Carisma',
    'str': 'Fuerza',
    'dex': 'Destreza',
    'con': 'Constitución',
    'int': 'Inteligencia',
    'wis': 'Sabiduría',
    'cha': 'Carisma'
  };
  return text.split(/(\b\w+\b)/g).map(part => {
    const key = part.trim();
    const match = Object.keys(wordTranslations).find(k => k.toLowerCase() === key.toLowerCase());
    return match ? wordTranslations[match] : part;
  }).join('');
}

function formatStartingEquipment(equipStr: string): string {
  if (!equipStr) return 'Ninguno';
  try {
    const parsed = typeof equipStr === 'string' ? JSON.parse(equipStr) : equipStr;
    if (typeof parsed === 'object' && parsed !== null) {
      const lines: string[] = [];
      const defaultEquip = safeParseArray(parsed.default);
      if (defaultEquip.length > 0) {
        lines.push(`• Equipo base: ${defaultEquip.join(', ')}`);
      }
      Object.entries(parsed).forEach(([key, val]) => {
        if (key !== 'default') {
          const options = safeParseArray(val);
          if (options.length > 0) {
            lines.push(`• Elección ${key}: ${options.join(' o ')}`);
          }
        }
      });
      if (lines.length > 0) return lines.join('\n');
    }
  } catch (e) {}
  return String(equipStr);
}

function getClassType(cls: SRDClass): string {
  if (cls.spellcasting_ability && cls.spellcasting_ability.trim() !== '') {
    const key = cls.spellcasting_ability.trim();
    const translated = statTranslations[key] || key;
    return `Caster (${translated})`;
  }
  const casterClasses = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard', 'alchemist', 'artificer'];
  if (casterClasses.includes(cls.name.toLowerCase())) {
    return 'Caster';
  }
  return 'Marcial';
}

export function CreateCharacterPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [races, setRaces] = useState<SRDRace[]>([]);
  const [classes, setClasses] = useState<SRDClass[]>([]);
  const [selectedRace, setSelectedRace] = useState<SRDRace | null>(null);
  const [selectedClass, setSelectedClass] = useState<SRDClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listRaces().then(res => {
        setRaces(res.data);
        if (res.data.length > 0) {
          setSelectedRace(res.data[0]);
        }
      }).catch(() => addToast('error', 'Error al cargar las razas de la base de datos')),
      listClasses().then(res => {
        setClasses(res.data);
        if (res.data.length > 0) {
          setSelectedClass(res.data[0]);
        }
      }).catch(() => addToast('error', 'Error al cargar las clases de la base de datos'))
    ]).finally(() => setLoading(false));
  }, [addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !campaignId || !selectedRace || !selectedClass) return;

    setSubmitting(true);
    try {
      const res = await characterApi.create({
        name: name.trim(),
        race: selectedRace.name,
        class: selectedClass.name.toLowerCase(),
        campaign_id: Number(campaignId)
      });
      addToast('success', `Personaje "${res.data.name}" creado con éxito`);
      navigate(`/campaign/${campaignId}/character/${res.data.id}`);
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Error al crear el personaje');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-body-lg text-secondary">Cargando razas y clases...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center px-4">
        <Link to={`/campaign/${campaignId}`} className="text-primary hover:bg-surface-container-low rounded-full p-2 transition-colors mr-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold">Crear Personaje</h1>
      </header>

      <main className="flex-1 px-4 md:px-10 py-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <form onSubmit={handleSubmit} className="md:col-span-5 space-y-6 bg-surface-container-lowest border border-border-low-contrast rounded-xl p-6 shadow-sm">
            <div>
              <label htmlFor="char-name" className="block font-label-bold text-on-surface mb-2">Nombre del Personaje</label>
              <input
                id="char-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Grog Strongjaw"
                required
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-3 font-body-md rounded-t outline-none transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="char-race" className="font-label-bold text-on-surface">Raza</label>
              </div>
              <select
                id="char-race"
                value={selectedRace?.name || ''}
                onChange={(e) => {
                  const r = races.find(raceItem => raceItem.name === e.target.value);
                  if (r) setSelectedRace(r);
                }}
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-3 font-body-md rounded-t outline-none transition-colors"
              >
                {races.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="char-class" className="font-label-bold text-on-surface">Clase</label>
              </div>
              <select
                id="char-class"
                value={selectedClass?.name || ''}
                onChange={(e) => {
                  const c = classes.find(classItem => classItem.name === e.target.value);
                  if (c) setSelectedClass(c);
                }}
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-3 font-body-md rounded-t outline-none transition-colors"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!name.trim() || submitting || !selectedRace || !selectedClass}
              className="w-full bg-primary-container text-on-primary-container font-label-bold py-4 rounded-lg hover:bg-surface-tint hover:text-white transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm cursor-pointer"
            >
              <span>{submitting ? 'Creando personaje...' : 'Crear Personaje'}</span>
              <span className="material-symbols-outlined">person_add</span>
            </button>
          </form>

          {/* Details Column */}
          <div className="md:col-span-7 space-y-6">
            {/* Race Details Card */}
            {selectedRace && (
              <div className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-start border-b border-border-low-contrast pb-3">
                  <div>
                    <h3 className="font-headline-sm text-on-surface font-bold">{selectedRace.name}</h3>
                    <p className="font-label-sm text-secondary uppercase tracking-wider">Detalles de la Raza</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-surface-container text-on-surface-variant rounded-full text-xs font-label-bold">
                      Velocidad: {selectedRace.speed} pies
                    </span>
                    <span className="px-2.5 py-1 bg-surface-container text-on-surface-variant rounded-full text-xs font-label-bold">
                      Tamaño: {sizeTranslations[selectedRace.size] || selectedRace.size}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.keys(safeParseObject(selectedRace.ability_bonuses)).length > 0 && (
                    <div className="bg-surface-container-low p-3 rounded-lg">
                      <span className="block font-label-bold text-secondary text-xs mb-1">Mejora de Características</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Object.entries(safeParseObject(selectedRace.ability_bonuses)).map(([stat, val]) => (
                          <span key={stat} className="px-2 py-0.5 bg-success-active/10 text-success-active rounded text-xs font-label-bold">
                            {statTranslations[stat] || stat} +{val}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {safeParseArray(selectedRace.languages).length > 0 && (
                    <div className="bg-surface-container-low p-3 rounded-lg">
                      <span className="block font-label-bold text-secondary text-xs mb-1">Idiomas</span>
                      <p className="text-on-surface-variant font-body-md mt-1">
                        {safeParseArray(selectedRace.languages).join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                {selectedRace.description && (
                  <div>
                    <h4 className="font-label-bold text-secondary text-xs mb-1.5 uppercase tracking-wider">Descripción</h4>
                    <div className="max-h-56 overflow-y-auto pr-2 text-sm text-on-surface-variant leading-relaxed whitespace-pre-line custom-scrollbar">
                      {selectedRace.description}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Class Details Card */}
            {selectedClass && (
              <div className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-start border-b border-border-low-contrast pb-3">
                  <div>
                    <h3 className="font-headline-sm text-on-surface font-bold">{selectedClass.name}</h3>
                    <p className="font-label-sm text-secondary uppercase tracking-wider">Detalles de la Clase</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-surface-container text-on-surface-variant rounded-full text-xs font-label-bold">
                      Dado de Golpe: d{selectedClass.hit_die}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-label-bold ${
                      getClassType(selectedClass).startsWith('Caster')
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {getClassType(selectedClass)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {safeParseArray(selectedClass.saving_throws).length > 0 && (
                    <div className="bg-surface-container-low p-3 rounded-lg">
                      <span className="block font-label-bold text-secondary text-xs mb-1">Tiradas de Salvación</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {safeParseArray(selectedClass.saving_throws).map(save => (
                          <span key={save} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-label-bold">
                            {statTranslations[save] || save}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedClass.primary_ability && (
                    <div className="bg-surface-container-low p-3 rounded-lg">
                      <span className="block font-label-bold text-secondary text-xs mb-1">Característica Primaria</span>
                      <p className="text-on-surface-variant font-body-md mt-1">
                        {translateStatsList(selectedClass.primary_ability)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {safeParseArray(selectedClass.armor_proficiencies).length > 0 && (
                    <div className="bg-surface-container-low p-3 rounded-lg">
                      <span className="block font-label-bold text-secondary text-xs mb-1">Competencia con Armaduras</span>
                      <p className="text-on-surface-variant font-body-sm leading-snug mt-1">
                        {translateProficiencies(safeParseArray(selectedClass.armor_proficiencies))}
                      </p>
                    </div>
                  )}

                  {safeParseArray(selectedClass.weapon_proficiencies).length > 0 && (
                    <div className="bg-surface-container-low p-3 rounded-lg">
                      <span className="block font-label-bold text-secondary text-xs mb-1">Competencia con Armas</span>
                      <p className="text-on-surface-variant font-body-sm leading-snug mt-1">
                        {translateProficiencies(safeParseArray(selectedClass.weapon_proficiencies))}
                      </p>
                    </div>
                  )}
                </div>

                {selectedClass.starting_equipment && (
                  <div>
                    <h4 className="font-label-bold text-secondary text-xs mb-1 uppercase tracking-wider">Equipo Inicial</h4>
                    <p className="text-sm text-on-surface-variant leading-relaxed bg-surface-container-low p-3 rounded-lg mt-1 whitespace-pre-line">
                      {formatStartingEquipment(selectedClass.starting_equipment)}
                    </p>
                  </div>
                )}

                {selectedClass.description && (
                  <div>
                    <h4 className="font-label-bold text-secondary text-xs mb-1.5 uppercase tracking-wider">Descripción</h4>
                    <div className="max-h-56 overflow-y-auto pr-2 text-sm text-on-surface-variant leading-relaxed whitespace-pre-line custom-scrollbar">
                      {selectedClass.description}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
