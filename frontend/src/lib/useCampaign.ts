import { useQuery } from '@tanstack/react-query';
import { campaignApi, characterApi } from '../services/api';
import { useAuth } from './hooks';

export interface CampaignSummary {
  id: number;
  name: string;
  description: string;
  join_code: string;
  gm_user_id: number;
  status: string;
  game_mode: 'local' | 'foundry' | string;
}

export interface CharacterSummary {
  id: number;
  user_id: number;
  name: string;
  race: string;
  class: string;
  level: number;
  current_hp: number;
  max_hp: number;
  temp_hp: number;
  ac: number;
}

/** Shared campaign context for the shell and pages: campaign, my role, my character. */
export function useCampaign(campaignId?: string | number) {
  const { user } = useAuth();
  const enabled = Boolean(campaignId);
  const campaign = useQuery({
    queryKey: ['campaign', String(campaignId)],
    queryFn: async () => (await campaignApi.get(campaignId!)).data as CampaignSummary,
    enabled,
    staleTime: 60_000,
  });
  const characters = useQuery({
    queryKey: ['characters', String(campaignId)],
    queryFn: async () => ((await characterApi.listByCampaign(campaignId!)).data ?? []) as CharacterSummary[],
    enabled,
  });
  const isGM = Boolean(user && campaign.data && campaign.data.gm_user_id === user.id);
  const myCharacter = characters.data?.find((c) => c.user_id === user?.id);
  return {
    campaign: campaign.data,
    characters: characters.data ?? [],
    myCharacter,
    isGM,
    isFoundry: campaign.data?.game_mode === 'foundry',
    loading: campaign.isLoading,
  };
}
