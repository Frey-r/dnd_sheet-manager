import { Link } from 'react-router-dom';

type Tab = 'stats' | 'spells' | 'inventory' | 'bio' | 'features';
const TABS: { key: Tab; label: string; path: string }[] = [
  { key: 'stats', label: 'Estadísticas', path: '' },
  { key: 'spells', label: 'Conjuros', path: '/spells' },
  { key: 'inventory', label: 'Inventario', path: '/inventory' },
  { key: 'bio', label: 'Biografía', path: '/bio' },
  { key: 'features', label: 'Rasgos', path: '/features' },
];

/** Tab strip shared by the character sheet screens. */
export function CharacterTabs({ campaignId, characterId, active }: { campaignId?: string; characterId?: string; active: Tab }) {
  const base = `/campaign/${campaignId}/character/${characterId}`;
  return (
    <nav aria-label="Secciones del personaje" className="bg-surface border-b border-border-low-contrast sticky top-16 z-30">
      <div className="flex overflow-x-auto no-scrollbar px-4 gap-4">
        {TABS.map((tab) => (
          <Link key={tab.key} to={`${base}${tab.path}`} aria-current={tab.key === active ? 'page' : undefined}
            className={`py-3 border-b-2 font-label-bold whitespace-nowrap ${tab.key === active ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-on-surface'}`}>{tab.label}</Link>
        ))}
      </div>
    </nav>
  );
}
