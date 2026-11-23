import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { useCampaign } from './lib/useCampaign';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { CampaignListPage } from './pages/CampaignList';
import { CreateCampaignPage } from './pages/CreateCampaign';
import { CampaignHub } from './pages/CampaignHub';
import { CharacterSheet } from './pages/CharacterSheet';
import { CreateCharacterPage } from './pages/CreateCharacter';
import { EditAppearancePage } from './pages/EditAppearance';
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
import { Bastions } from './pages/Bastions';
import { Messages } from './pages/Messages';
import { LoreSearch } from './pages/LoreSearch';
import { Trade } from './pages/Trade';
import { CreatureDetail } from './pages/CreatureDetail';
import { NPCDetail } from './pages/NPCDetail';
import { NPCCreatorPage } from './pages/NPCCreator';
import { MapDetail } from './pages/MapDetail';
import { PlayerEncounter } from './pages/PlayerEncounter';
import { SettingsPage } from './pages/SettingsPage';
import { SRDSpellBrowser } from './pages/SRDSpellBrowser';
import { EncounterBuilder } from './pages/EncounterBuilder';
import { ContentLibrary } from './pages/ContentLibrary';
import { VirtualTable } from './pages/VirtualTable';
import { useAuth } from './lib/hooks';
import { campaignApi } from './services/api';
import { RealtimeProvider } from './lib/RealtimeProvider';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// The Foundry client view only exists in Foundry-mode campaigns (foundry-integration.md,
// lan-deployment.md); local campaigns go back to the hub. Any member may open it there.
function FoundryModeGuard({ children }: { children: React.ReactNode }) {
  const { campaignId = '' } = useParams();
  const { campaign, isFoundry, loading } = useCampaign(campaignId);
  if (loading) return <div className="p-8 text-on-surface">Comprobando campaña…</div>;
  if (!campaign || !isFoundry) return <Navigate to={`/campaign/${campaignId}`} replace />;
  return children;
}

function GMGuard({ children }: { children: React.ReactNode }) {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['campaign-members', campaignId],
    queryFn: () => campaignApi.members(campaignId).then((response) => response.data),
    enabled: Boolean(campaignId && user),
  });
  if (query.isLoading) return <div className="p-8 text-on-surface">Comprobando permisos…</div>;
  const members = Array.isArray(query.data) ? query.data : [];
  const role = members.find((member: { user_id: number }) => member.user_id === user?.id)?.role;
  return role === 'gm' ? children : <Navigate to={`/campaign/${campaignId}`} replace />;
}

export default function App() {
  return <BrowserRouter><RealtimeProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
      <Route index element={<Navigate to="/campaigns" replace />} />
      <Route path="campaigns" element={<CampaignListPage />} />
      <Route path="campaigns/new" element={<CreateCampaignPage />} />
      <Route path="campaign/:campaignId" element={<CampaignHub />} />
      <Route path="campaign/:campaignId/reference" element={<ContentLibrary />} />
      <Route path="campaign/:campaignId/character/new" element={<CreateCharacterPage />} />
      <Route path="campaign/:campaignId/character/:characterId" element={<CharacterSheet />} />
      <Route path="campaign/:campaignId/character/:characterId/appearance" element={<EditAppearancePage />} />
      <Route path="campaign/:campaignId/character/:characterId/spells" element={<SpellsTab />} />
      <Route path="campaign/:campaignId/character/:characterId/inventory" element={<InventoryTab />} />
      <Route path="campaign/:campaignId/character/:characterId/bio" element={<BiographyTab />} />
      <Route path="campaign/:campaignId/character/:characterId/features" element={<FeaturesTab />} />
      <Route path="campaign/:campaignId/gm" element={<GMGuard><GMConsole /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/combat" element={<GMGuard><CombatTracker /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/npcs" element={<GMGuard><NPCManager /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/party" element={<GMGuard><PartyRoster /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/events" element={<GMGuard><EventsCalendar /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/maps" element={<GMGuard><MapGallery /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/notes" element={<GMGuard><CampaignNotes /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/bestiary" element={<GMGuard><Bestiary /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/bot" element={<GMGuard><BotManager /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/lore" element={<GMGuard><LoreEditor /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/spells-srd" element={<GMGuard><SRDSpellBrowser /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/encounter-builder" element={<GMGuard><EncounterBuilder /></GMGuard>} />
      <Route path="campaign/:campaignId/table" element={<VirtualTable />} />
      <Route path="campaign/:campaignId/combat" element={<FoundryModeGuard><FoundryCombat /></FoundryModeGuard>} />
      <Route path="campaign/:campaignId/market" element={<Marketplace />} />
      <Route path="campaign/:campaignId/bastions" element={<Bastions />} />
      <Route path="campaign/:campaignId/chat" element={<Messages />} />
      <Route path="campaign/:campaignId/lore" element={<LoreSearch />} />
      <Route path="campaign/:campaignId/trade" element={<Trade />} />
      <Route path="campaign/:campaignId/encounter" element={<PlayerEncounter />} />
      <Route path="campaign/:campaignId/gm/bestiary/:creatureId" element={<GMGuard><CreatureDetail /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/npcs/new" element={<GMGuard><NPCCreatorPage /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/npcs/:npcId" element={<GMGuard><NPCDetail /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/npcs/:npcId/edit" element={<GMGuard><NPCCreatorPage /></GMGuard>} />
      <Route path="campaign/:campaignId/gm/maps/:mapId" element={<GMGuard><MapDetail /></GMGuard>} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
  </Routes></RealtimeProvider></BrowserRouter>;
}
