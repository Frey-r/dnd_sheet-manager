import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { CampaignListPage } from './pages/CampaignList';
import { CreateCampaignPage } from './pages/CreateCampaign';
import { CampaignHub } from './pages/CampaignHub';
import { CharacterSheet } from './pages/CharacterSheet';
import { CreateCharacterPage } from './pages/CreateCharacter';
import { SpellsTab } from './pages/SpellsTab';
import { InventoryTab } from './pages/InventoryTab';
import { BiographyTab } from './pages/BiographyTab';
import { FeaturesTab } from './pages/FeaturesTab';
import { GMConsole } from './pages/GMConsole';
import { CombatTracker } from './pages/CombatTracker';
import { FoundryCombat } from './pages/FoundryCombat';
import { NPCManager } from './pages/NPCManager';
import { PartyRoster } from './pages/PartyRoster';
import { EventsCalendar } from './pages/EventsCalendar';
import { MapGallery } from './pages/MapGallery';
import { CampaignNotes } from './pages/CampaignNotes';
import { Bestiary } from './pages/Bestiary';
import { BotManager } from './pages/BotManager';
import { LoreEditor } from './pages/LoreEditor';
import { Marketplace } from './pages/Marketplace';
import { Messages } from './pages/Messages';
import { LoreSearch } from './pages/LoreSearch';
import { Trade } from './pages/Trade';
import { CreatureDetail } from './pages/CreatureDetail';
import { NPCDetail } from './pages/NPCDetail';
import { MapDetail } from './pages/MapDetail';
import { PlayerEncounter } from './pages/PlayerEncounter';
import { SettingsPage } from './pages/SettingsPage';
import { SRDSpellBrowser } from './pages/SRDSpellBrowser';
import { EncounterBuilder } from './pages/EncounterBuilder';
import { useAuth } from './lib/hooks';
import type { UserRole } from './types';

/** Protects a route: if the user's role is not in allowedRoles, redirect to /campaigns */
function RoleGuard({ allowedRoles, children }: { allowedRoles: UserRole[]; children: React.ReactNode }) {
  const { role, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/campaigns" replace />;
  return <>{children}</>;
}


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Main App with Layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/campaigns" replace />} />

          {/* Campaigns */}
          <Route path="campaigns" element={<CampaignListPage />} />
          <Route path="campaigns/new" element={<RoleGuard allowedRoles={['admin', 'dm']}><CreateCampaignPage /></RoleGuard>} />
          <Route path="campaign/:campaignId" element={<CampaignHub />} />

          {/* Character Sheet Tabs */}
          <Route path="campaign/:campaignId/character/new" element={<CreateCharacterPage />} />
          <Route path="campaign/:campaignId/character/:characterId" element={<CharacterSheet />} />
          <Route path="campaign/:campaignId/character/:characterId/spells" element={<SpellsTab />} />
          <Route path="campaign/:campaignId/character/:characterId/inventory" element={<InventoryTab />} />
          <Route path="campaign/:campaignId/character/:characterId/bio" element={<BiographyTab />} />
          <Route path="campaign/:campaignId/character/:characterId/features" element={<FeaturesTab />} />

          {/* GM Console — admin & dm only */}
          <Route path="campaign/:campaignId/gm" element={<RoleGuard allowedRoles={['admin', 'dm']}><GMConsole /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/combat" element={<RoleGuard allowedRoles={['admin', 'dm']}><CombatTracker /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/npcs" element={<RoleGuard allowedRoles={['admin', 'dm']}><NPCManager /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/party" element={<RoleGuard allowedRoles={['admin', 'dm']}><PartyRoster /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/events" element={<RoleGuard allowedRoles={['admin', 'dm']}><EventsCalendar /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/maps" element={<RoleGuard allowedRoles={['admin', 'dm']}><MapGallery /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/notes" element={<RoleGuard allowedRoles={['admin', 'dm']}><CampaignNotes /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/bestiary" element={<RoleGuard allowedRoles={['admin', 'dm']}><Bestiary /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/bot" element={<RoleGuard allowedRoles={['admin', 'dm']}><BotManager /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/lore" element={<RoleGuard allowedRoles={['admin', 'dm']}><LoreEditor /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/spells-srd" element={<RoleGuard allowedRoles={['admin', 'dm']}><SRDSpellBrowser /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/encounter-builder" element={<RoleGuard allowedRoles={['admin', 'dm']}><EncounterBuilder /></RoleGuard>} />

          {/* Player Pages */}
          <Route path="campaign/:campaignId/combat" element={<FoundryCombat />} />
          <Route path="campaign/:campaignId/market" element={<Marketplace />} />
          <Route path="campaign/:campaignId/chat" element={<Messages />} />
          <Route path="campaign/:campaignId/lore" element={<LoreSearch />} />
          <Route path="campaign/:campaignId/trade" element={<Trade />} />
          <Route path="campaign/:campaignId/encounter" element={<PlayerEncounter />} />

          {/* Detail Views — GM only */}
          <Route path="campaign/:campaignId/gm/bestiary/:creatureId" element={<RoleGuard allowedRoles={['admin', 'dm']}><CreatureDetail /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/npcs/:npcId" element={<RoleGuard allowedRoles={['admin', 'dm']}><NPCDetail /></RoleGuard>} />
          <Route path="campaign/:campaignId/gm/maps/:mapId" element={<RoleGuard allowedRoles={['admin', 'dm']}><MapDetail /></RoleGuard>} />


          {/* Settings */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;