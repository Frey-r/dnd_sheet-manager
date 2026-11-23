/* Race and class catalogue of the creators (players and NPCs): one cached request each, shared by
   every step and both creators (RG-1). */
import { useQuery } from '@tanstack/react-query';
import { listClasses, listRaces } from '../../../services/srdService';

const STALE_MS = 300_000;

export function useCreatorCatalog() {
  const races = useQuery({ queryKey: ['srd-races'], queryFn: async () => (await listRaces()).data ?? [], staleTime: STALE_MS });
  const classes = useQuery({ queryKey: ['srd-classes'], queryFn: async () => (await listClasses()).data ?? [], staleTime: STALE_MS });
  return { races, classes };
}
