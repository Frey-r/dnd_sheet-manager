import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { marketApi, campaignApi } from '../services/api';
import { searchEquipment, searchMagicItems } from '../services/srdService';
import type { MarketplaceItem } from '../types';
import type { SRDEquipment, SRDMagicItem } from '../types/srd';

export function Marketplace() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Role checks
  const [isGM, setIsGM] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Add SRD Item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [srdTab, setSrdTab] = useState<'equipment' | 'magic'>('equipment');
  const [srdQuery, setSrdQuery] = useState('');
  const [srdEquipment, setSrdEquipment] = useState<SRDEquipment[]>([]);
  const [srdMagic, setSrdMagic] = useState<SRDMagicItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Price configuration modal state
  const [selectedSrdItem, setSelectedSrdItem] = useState<any>(null);
  const [itemPrice, setItemPrice] = useState<number>(10);
  const [adding, setAdding] = useState(false);
  
  // Purchase state
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchMarketplace = useCallback(() => {
    if (!campaignId) return;
    setLoading(true);
    marketApi.list(campaignId)
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => {
    fetchMarketplace();

    // Check user & role
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        setCurrentUser(u);
        campaignApi.get(campaignId!).then((res) => {
          if (res.data && res.data.gm_user_id === u.id) {
            setIsGM(true);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [campaignId, fetchMarketplace]);

  // SRD Search trigger
  useEffect(() => {
    if (srdQuery.trim().length < 2) {
      setSrdEquipment([]);
      setSrdMagic([]);
      return;
    }
    setSearching(true);
    const delayDebounceFn = setTimeout(() => {
      if (srdTab === 'equipment') {
        searchEquipment({ query: srdQuery, limit: 10 })
          .then(res => setSrdEquipment(res.data || []))
          .catch(() => setSrdEquipment([]))
          .finally(() => setSearching(false));
      } else {
        searchMagicItems({ query: srdQuery, limit: 10 })
          .then(res => setSrdMagic(res.data || []))
          .catch(() => setSrdMagic([]))
          .finally(() => setSearching(false));
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [srdQuery, srdTab]);

  const handleSrdItemClick = (item: any) => {
    setSelectedSrdItem(item);
    // Set default price
    if (srdTab === 'equipment') {
      setItemPrice(item.cost_gp || 1);
    } else {
      // Magic item rarity default prices
      const rarityPrices: Record<string, number> = {
        'common': 50,
        'uncommon': 150,
        'rare': 500,
        'very rare': 5000,
        'legendary': 50000,
      };
      setItemPrice(rarityPrices[item.rarity.toLowerCase()] || 100);
    }
  };

  const handleAddSrdToMarket = async () => {
    if (!selectedSrdItem) return;
    setAdding(true);
    try {
      await marketApi.create(campaignId!, {
        name: selectedSrdItem.name,
        item_type: srdTab === 'equipment' ? selectedSrdItem.category : 'Magic Item',
        rarity: selectedSrdItem.rarity || 'common',
        price: itemPrice,
        weight: selectedSrdItem.weight || 0,
        description: selectedSrdItem.description || '',
        attunement_required: selectedSrdItem.requires_attunement || false,
        srd_ref_id: selectedSrdItem.id,
      });

      setSelectedSrdItem(null);
      setShowAddModal(false);
      setSrdQuery('');
      // Refresh list
      marketApi.list(campaignId!).then(r => setItems(r.data));
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const handlePurchase = async (itemId: number, itemName: string) => {
    setPurchaseMessage(null);
    setErrorMessage(null);
    try {
      const res = await marketApi.purchase(campaignId!, itemId);
      setPurchaseMessage(`Successfully purchased ${itemName}! Gold remaining: ${res.data.gold_remaining} gp`);
      setTimeout(() => setPurchaseMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || `Failed to purchase ${itemName}.`);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen flex flex-col bg-surface-container-lowest">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Campaign Marketplace</h1>
        </div>
        {isGM && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-on-primary font-label-bold px-4 py-2 rounded-lg hover:bg-primary/95 transition-colors flex items-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">storefront</span>
            Add SRD Item
          </button>
        )}
      </header>

      <main className="flex-1 p-4 md:p-10 max-w-4xl mx-auto w-full space-y-6">
        {purchaseMessage && (
          <div className="p-4 bg-primary/10 text-primary border border-primary/20 rounded-xl font-body-md flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {purchaseMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-error-container text-on-error-container border border-error/20 rounded-xl font-body-md flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">warning</span>
            {errorMessage}
          </div>
        )}

        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items in campaign marketplace..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-low-contrast rounded-lg font-body-md text-on-surface focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {loading ? (
          <div className="text-center py-20 text-secondary font-body-lg">Loading shop inventories...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => (
              <div key={item.id} className="bg-surface border border-border-low-contrast rounded-xl p-4 flex items-center justify-between hover:border-primary transition-colors shadow-2xs">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-surface-subtle flex items-center justify-center shrink-0 border border-border-low-contrast">
                    <span className="material-symbols-outlined text-outline">
                      {item.item_type.toLowerCase().includes('weapon') ? 'swords' :
                       item.item_type.toLowerCase().includes('armor') ? 'shield' :
                       item.item_type.toLowerCase().includes('magic') ? 'auto_awesome' : 'inventory_2'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-label-bold text-on-surface">{item.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full font-label-bold text-[9px] uppercase tracking-wider ${
                        item.rarity === 'legendary' ? 'bg-error/10 text-error border border-error/20' :
                        item.rarity === 'very_rare' ? 'bg-tertiary/10 text-tertiary' :
                        item.rarity === 'rare' ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'
                      }`}>{item.rarity.replace('_', ' ')}</span>
                    </div>
                    <p className="font-label-sm text-secondary capitalize">{item.item_type} • {item.weight} lbs</p>
                    {item.description && (
                      <p className="font-body-sm text-on-surface-variant line-clamp-1 mt-1">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-headline-sm text-on-surface font-bold">{item.price} gp</span>
                  <button
                    onClick={() => handlePurchase(item.id, item.name)}
                    className="bg-primary text-on-primary font-label-bold px-4 py-2 rounded-lg hover:bg-primary/95 transition-all shadow-xs"
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-20 text-secondary font-body-lg">
                {search ? 'No items found matching search' : 'The shop is currently empty. Ask the GM to add some standard or magic items!'}
              </div>
            )}
          </div>
        )}
      </main>

      {/* GM Add Item from SRD Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface w-full max-w-lg rounded-xl shadow-xl overflow-hidden border border-border-low-contrast flex flex-col max-h-[85vh]">
            <header className="px-4 py-3 bg-surface-subtle border-b border-border-low-contrast flex items-center justify-between">
              <h3 className="font-label-bold text-on-surface">Add SRD Item to Shop</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSrdQuery('');
                  setSelectedSrdItem(null);
                }}
                className="p-1 rounded-full hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-secondary">close</span>
              </button>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-border-low-contrast">
              <button
                onClick={() => { setSrdTab('equipment'); setSrdQuery(''); }}
                className={`flex-1 py-3 text-center font-label-bold border-b-2 transition-all ${
                  srdTab === 'equipment' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-on-surface'
                }`}
              >
                Standard Equipment
              </button>
              <button
                onClick={() => { setSrdTab('magic'); setSrdQuery(''); }}
                className={`flex-1 py-3 text-center font-label-bold border-b-2 transition-all ${
                  srdTab === 'magic' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-on-surface'
                }`}
              >
                Magic Items
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-border-low-contrast">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">search</span>
                <input
                  type="text"
                  placeholder={srdTab === 'equipment' ? 'Search weapons, armor, tools (e.g. Longsword)...' : 'Search magical items (e.g. Bag of Holding)...'}
                  value={srdQuery}
                  onChange={(e) => setSrdQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-border-low-contrast rounded-lg font-body-md text-on-surface focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {searching ? (
                <div className="text-center py-10 text-secondary">Searching the reference database...</div>
              ) : srdTab === 'equipment' ? (
                srdEquipment.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSrdItemClick(item)}
                    className="w-full text-left p-3 rounded-lg border border-border-low-contrast hover:border-primary transition-colors bg-surface-container-lowest flex items-center justify-between"
                  >
                    <div>
                      <div className="font-label-bold text-on-surface">{item.name}</div>
                      <div className="font-label-sm text-secondary capitalize">{item.category} • {item.cost_gp} gp • {item.weight} lbs</div>
                    </div>
                    <span className="material-symbols-outlined text-primary">add_circle</span>
                  </button>
                ))
              ) : (
                srdMagic.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSrdItemClick(item)}
                    className="w-full text-left p-3 rounded-lg border border-border-low-contrast hover:border-primary transition-colors bg-surface-container-lowest flex items-center justify-between"
                  >
                    <div>
                      <div className="font-label-bold text-on-surface">{item.name}</div>
                      <div className="font-label-sm text-secondary capitalize">{item.rarity} {item.requires_attunement ? '• Requires Attunement' : ''}</div>
                    </div>
                    <span className="material-symbols-outlined text-primary">add_circle</span>
                  </button>
                ))
              )}

              {!searching && srdQuery.trim().length >= 2 && srdEquipment.length === 0 && srdMagic.length === 0 && (
                <div className="text-center py-10 text-secondary">No items found matching search in D&D 5e SRD.</div>
              )}

              {srdQuery.trim().length < 2 && (
                <div className="text-center py-10 text-secondary font-body-sm">
                  Type at least 2 characters to search.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GM Configure price modal */}
      {selectedSrdItem && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface w-full max-w-sm rounded-xl shadow-2xl border border-border-low-contrast p-5 space-y-4">
            <div>
              <h3 className="font-label-bold text-on-surface text-lg">Configure Marketplace Price</h3>
              <p className="font-body-sm text-secondary mt-1">Configure price in gold pieces (gp) for <strong>{selectedSrdItem.name}</strong>.</p>
            </div>

            <div>
              <label className="font-label-sm text-secondary block mb-1">Price (gp)</label>
              <input
                type="number"
                min="0"
                value={itemPrice}
                onChange={(e) => setItemPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-border-low-contrast rounded-lg text-on-surface focus:outline-none focus:border-primary font-label-bold text-lg"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedSrdItem(null)}
                className="flex-1 py-2 rounded-lg border border-border-low-contrast font-label-bold hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSrdToMarket}
                disabled={adding}
                className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-label-bold hover:bg-primary/95 disabled:opacity-50 transition-colors shadow-sm"
              >
                {adding ? 'Adding...' : 'Add to Shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
