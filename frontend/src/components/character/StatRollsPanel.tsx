/* GM view of the players' ability rolls: who rolled what, and permission to roll again. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface Roll { id: number; username: string; totals: number[]; status: 'available' | 'used' | 'discarded'; character_id: number | null; created_at: string }

const STATUS: Record<Roll['status'], string> = { available: 'Sin usar', used: 'Usada', discarded: 'Descartada' };

export function StatRollsPanel({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const rolls = useQuery({
    queryKey: ['stat-rolls-gm', campaignId],
    queryFn: async () => (await api.get<{ all: Roll[] }>(`/campaigns/${campaignId}/stat-rolls`)).data.all ?? [],
  });
  const discard = useMutation({
    mutationFn: (id: number) => api.delete(`/campaigns/${campaignId}/stat-rolls/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stat-rolls-gm', campaignId] }),
  });
  const list = (rolls.data ?? []).filter((r) => r.status !== 'discarded').slice(0, 8);

  return (
    <section className="mc-card p-4">
      <div className="mc-eyebrow">Tiradas de características</div>
      {list.length === 0 ? (
        <p className="mt-1 text-[13.5px] text-muted">Nadie ha tirado aún. Las tiradas 4d6 las hace el servidor al crear personaje.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {list.map((r) => {
            const sum = r.totals.reduce((s, v) => s + v, 0);
            return (
              <li key={r.id} className="rounded-lg border border-line p-2.5">
                <div className="flex items-center gap-2 text-[13px]">
                  <b className="truncate">{r.username}</b>
                  <span className={`ml-auto text-[12px] ${r.status === 'available' ? 'text-warn' : 'text-muted'}`}>{STATUS[r.status]}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[13.5px]">
                  {r.totals.map((t, i) => <span key={i} className="rounded border border-line px-1.5">{t}</span>)}
                  <span className="ml-auto text-[12px] text-faint">Σ {sum}</span>
                </div>
                {r.status === 'available' && (
                  <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm mt-1.5 w-full" disabled={discard.isPending}
                    onClick={() => { if (window.confirm(`¿Permitir que ${r.username} vuelva a tirar? Esta tirada se descarta.`)) discard.mutate(r.id); }}>
                    Permitir repetir
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
