import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { campaignApi, characterApi, tradeApi } from '../services/api';
import type { CampaignMember, Character } from '../types';

export function Trade() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [offeredGold, setOfferedGold] = useState(0);
  const [requestedGold, setRequestedGold] = useState(0);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    campaignApi.members(campaignId).then(r => {
      setMembers(r.data);
      return Promise.all(r.data.map(() =>
        characterApi.listByCampaign(campaignId).catch(() => ({ data: [] }))
      ));
    }).catch(() => {});
  }, [campaignId]);

  const handleSend = async () => {
    if (!recipientId || !campaignId) return;
    setSending(true);
    try {
      await tradeApi.create(1, {
        recipient_character_id: recipientId,
        offered_item_ids: [],
        offered_gold: offeredGold,
        requested_item_ids: [],
        requested_gold: requestedGold,
      });
      setStatus('Oferta enviada');
    } catch {
      setStatus('Error al enviar');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center px-4">
        <Link to={`/campaign/${campaignId}`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-on-surface font-bold ml-2">Intercambio</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 max-w-2xl mx-auto w-full space-y-6">
        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-lg">
          <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-4">Nueva Oferta de Intercambio</h2>

          <div className="space-y-4">
            <div>
              <label className="font-label-bold text-on-surface mb-2 block">Oro a ofrecer</label>
              <input
                type="number"
                min={0}
                value={offeredGold}
                onChange={(e) => setOfferedGold(Number(e.target.value))}
                className="w-full bg-surface-subtle border border-border-low-contrast rounded-lg px-4 py-3 font-body-md outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="font-label-bold text-on-surface mb-2 block">Oro solicitado</label>
              <input
                type="number"
                min={0}
                value={requestedGold}
                onChange={(e) => setRequestedGold(Number(e.target.value))}
                className="w-full bg-surface-subtle border border-border-low-contrast rounded-lg px-4 py-3 font-body-md outline-none focus:border-primary"
              />
            </div>

            {members.length > 0 && (
              <div>
                <label className="font-label-bold text-on-surface mb-2 block">Selecciona miembro del grupo</label>
                <div className="flex flex-col gap-2">
                  {members.map((m) => (
                    <button
                      key={m.user_id}
                      onClick={() => setRecipientId(m.user_id)}
                      className={`text-left p-3 rounded-lg border transition-colors ${recipientId === m.user_id ? 'border-primary bg-primary-fixed' : 'border-border-low-contrast hover:bg-surface-subtle'}`}
                    >
                      <span className="font-body-md text-on-surface">{m.username || `Player ${m.user_id}`}</span>
                      <span className="font-label-sm text-secondary ml-2">({m.role})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!recipientId || sending}
            className="w-full mt-6 bg-primary-container text-on-primary-container font-label-bold py-3 rounded-lg hover:bg-surface-tint transition-colors shadow-sm disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Enviar Oferta'}
          </button>

          {status && (
            <div className={`mt-4 text-center font-label-bold p-3 rounded-lg ${status.includes('Error') ? 'bg-error-container text-on-error-container' : 'bg-success-active/10 text-success-active'}`}>
              {status}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
