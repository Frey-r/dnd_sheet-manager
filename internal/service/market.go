package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// Market implements shops (openspec/specs/market-bastions.md §3).
type Market struct {
	repo *repository.MarketRepository
	vtt  *repository.VTTRepository
}

func NewMarket(repo *repository.MarketRepository, vtt *repository.VTTRepository) *Market {
	return &Market{repo: repo, vtt: vtt}
}

// ErrShopUnavailable carries the reason a shop cannot be used right now.
type ErrShopUnavailable struct{ Reason string }

func (e ErrShopUnavailable) Error() string { return e.Reason }

// Availability decides whether userID can use the shop now (§3).
func (m *Market) Availability(ctx context.Context, shop *domain.Shop, userID int64, isGM bool) (bool, string) {
	if isGM {
		return true, ""
	}
	active, err := m.repo.ActiveSceneID(ctx, shop.CampaignID)
	if err != nil {
		return false, "No disponible"
	}
	switch shop.Availability {
	case "closed":
		return false, "Cerrada"
	case "scene":
		if shop.SceneID == nil || *shop.SceneID != active {
			if shop.SceneName != "" {
				return false, fmt.Sprintf("Solo abre en «%s»", shop.SceneName)
			}
			return false, "Solo abre en su escena"
		}
	}
	if shop.ObjectID != nil {
		near, objScene, err := m.repo.NearObject(ctx, *shop.ObjectID, userID)
		if err == nil && objScene == active && !near {
			return false, "Acércate al mostrador"
		}
	}
	return true, ""
}

// Annotate fills Available/Reason for each shop and hides closed ones from players.
func (m *Market) Annotate(ctx context.Context, shops []domain.Shop, userID int64, isGM bool) []domain.Shop {
	out := make([]domain.Shop, 0, len(shops))
	for _, s := range shops {
		if !isGM && s.Availability == "closed" {
			continue
		}
		s.Available, s.Reason = m.Availability(ctx, &s, userID, isGM)
		out = append(out, s)
	}
	return out
}

// PriceItems sets the final price (shop markup applied).
func PriceItems(shop *domain.Shop, items []domain.ShopItem) {
	for i := range items {
		items[i].FinalPriceCP = ApplyPct(items[i].PriceCP, shop.PricePct, true)
	}
}

// BuyResult is returned to the buyer.
type BuyResult struct {
	Message string `json:"message"`
	PaidCP  int64  `json:"paid_cp"`
}

// Buy charges the player's character and moves the item to its inventory.
func (m *Market) Buy(ctx context.Context, campaignID, userID int64, isGM bool, shopID, itemID int64, qty int) (*BuyResult, error) {
	if qty < 1 || qty > 999 {
		qty = 1
	}
	shop, err := m.repo.Shop(ctx, campaignID, shopID)
	if err != nil {
		return nil, err
	}
	if ok, reason := m.Availability(ctx, shop, userID, isGM); !ok {
		return nil, ErrShopUnavailable{reason}
	}
	item, err := m.repo.ShopItem(ctx, campaignID, itemID)
	if err != nil || item.ShopID != shop.ID {
		return nil, repository.ErrMarketNotFound
	}
	characterID, err := m.repo.CharacterOf(ctx, campaignID, userID)
	if err != nil {
		return nil, ErrShopUnavailable{"Necesitas un personaje en la campaña"}
	}
	unit := ApplyPct(item.PriceCP, shop.PricePct, true)
	total := unit * int64(qty)
	_, err = m.repo.Buy(ctx, item.ID, characterID, qty, unit, func(g, s, c int) (int, int, int, error) {
		w, err := (Wallet{g, s, c}).Pay(total)
		return w.Gold, w.Silver, w.Copper, err
	})
	if err != nil {
		return nil, err
	}
	label := item.Name
	if qty > 1 {
		label = fmt.Sprintf("%d × %s", qty, item.Name)
	}
	return &BuyResult{Message: fmt.Sprintf("Compraste %s por %s.", label, FormatCP(total)), PaidCP: total}, nil
}

// Sell sells an inventory item of the player's character to the shop.
func (m *Market) Sell(ctx context.Context, campaignID, userID int64, isGM bool, shopID, inventoryID int64, qty int) (*BuyResult, error) {
	if qty < 1 {
		qty = 1
	}
	shop, err := m.repo.Shop(ctx, campaignID, shopID)
	if err != nil {
		return nil, err
	}
	if ok, reason := m.Availability(ctx, shop, userID, isGM); !ok {
		return nil, ErrShopUnavailable{reason}
	}
	if shop.BuyRatePct <= 0 {
		return nil, ErrShopUnavailable{"Esta tienda no compra objetos"}
	}
	characterID, err := m.repo.CharacterOf(ctx, campaignID, userID)
	if err != nil {
		return nil, ErrShopUnavailable{"Necesitas un personaje en la campaña"}
	}
	res, err := m.repo.SellToShop(ctx, shop.ID, inventoryID, characterID, qty, shop.BuyRatePct, shop.BuysTypes)
	if err != nil {
		return nil, err
	}
	label := res.Name
	if res.Qty > 1 {
		label = fmt.Sprintf("%d × %s", res.Qty, res.Name)
	}
	return &BuyResult{Message: fmt.Sprintf("Vendiste %s por %s.", label, FormatCP(res.PayoutCP)), PaidCP: res.PayoutCP}, nil
}

// IsUserError tells whether err should be shown to the player (4xx).
func IsMarketUserError(err error) bool {
	var u ErrShopUnavailable
	return errors.As(err, &u) || errors.Is(err, ErrInsufficientFunds) || errors.Is(err, repository.ErrOutOfStock) ||
		errors.Is(err, repository.ErrNotEnoughItems) || errors.Is(err, repository.ErrNotSellable) ||
		errors.Is(err, repository.ErrOfferActive) || errors.Is(err, repository.ErrOfferResolved)
}

// ---------- Haggling over a cart (market-bastions.md §3) ----------

var haggleSkills = map[string]bool{"persuasión": true, "engaño": true, "intimidación": true}

// CartLine is one item of the player's cart.
type CartLine struct {
	ItemID int64 `json:"item_id"`
	Qty    int   `json:"qty"`
}

// OfferInput is the cart a player sends to the seller with the price they propose.
type OfferInput struct {
	Lines     []CartLine `json:"lines"`
	OfferedCP int64      `json:"offered_cp"`
	Message   string     `json:"message"`
	Skill     string     `json:"skill"`
}

// OfferOutcome is returned to the player.
type OfferOutcome struct {
	Message string            `json:"message"`
	Offer   *domain.ShopOffer `json:"offer,omitempty"`
}

// MakeOffer files the cart for the seller (the GM). Nothing is bought until the GM closes the
// deal: the price is role-played (market-bastions.md §3).
func (m *Market) MakeOffer(ctx context.Context, campaignID, userID int64, isGM bool, shopID int64, in OfferInput) (*OfferOutcome, error) {
	shop, err := m.repo.Shop(ctx, campaignID, shopID)
	if err != nil {
		return nil, err
	}
	if ok, reason := m.Availability(ctx, shop, userID, isGM); !ok {
		return nil, ErrShopUnavailable{reason}
	}
	if len(in.Lines) == 0 || len(in.Lines) > 50 {
		return nil, ErrShopUnavailable{"El carrito está vacío"}
	}
	qtyByItem := map[int64]int{}
	order := []int64{}
	for _, l := range in.Lines {
		if l.Qty < 1 || l.Qty > 999 {
			l.Qty = 1
		}
		if _, seen := qtyByItem[l.ItemID]; !seen {
			order = append(order, l.ItemID)
		}
		qtyByItem[l.ItemID] += l.Qty
	}
	items, err := m.repo.ShopItems(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	byID := map[int64]domain.ShopItem{}
	for _, it := range items {
		byID[it.ID] = it
	}
	o := &domain.ShopOffer{CampaignID: campaignID, ShopID: shop.ID, UserID: userID, Message: truncate(in.Message, 500)}
	for _, id := range order {
		qty := qtyByItem[id]
		it, ok := byID[id]
		if !ok {
			return nil, repository.ErrMarketNotFound
		}
		if it.Stock != -1 && it.Stock < qty {
			return nil, ErrShopUnavailable{fmt.Sprintf("No hay suficientes existencias de %s", it.Name)}
		}
		unit := ApplyPct(it.PriceCP, shop.PricePct, true)
		itemID := it.ID
		o.Lines = append(o.Lines, domain.ShopOfferLine{ItemID: &itemID, Name: it.Name, Qty: qty, UnitListCP: unit})
		o.Qty += qty
		o.ListCP += unit * int64(qty)
	}
	o.OfferedCP = max(0, in.OfferedCP)
	characterID, err := m.repo.CharacterOf(ctx, campaignID, userID)
	if err != nil {
		return nil, ErrShopUnavailable{"Necesitas un personaje en la campaña"}
	}
	o.CharacterID = characterID
	if skill := strings.ToLower(strings.TrimSpace(in.Skill)); haggleSkills[skill] && m.vtt != nil {
		if p, err := m.vtt.CharacterProfile(ctx, characterID); err == nil {
			d := 1 + rand.IntN(20)
			mod := SkillModifier(skill, p.Str, p.Dex, p.Con, p.Int, p.Wis, p.Cha)
			total := d + mod
			o.Skill, o.RollTotal = skill, &total
			o.RollDetail = fmt.Sprintf("d20 (%d) %+d = %d", d, mod, total)
		}
	}
	if err := m.repo.CreateOffer(ctx, o); err != nil {
		return nil, err
	}
	who := "el vendedor"
	if shop.NPCName != "" {
		who = shop.NPCName
	}
	return &OfferOutcome{Message: fmt.Sprintf("Pedido enviado a %s. Negocien el precio.", who), Offer: o}, nil
}

// ResolveOffer applies a GM or player action to an offer.
//
//	GM: accept (closes the deal at priceCP, default the offered price) · reject · counter (priceCP)
//	Player: accept (a counter) · reject (a counter) · withdraw.
func (m *Market) ResolveOffer(ctx context.Context, campaignID, userID int64, isGM bool, offerID int64, action string, priceCP int64, note string) (string, error) {
	o, err := m.repo.Offer(ctx, campaignID, offerID)
	if err != nil {
		return "", err
	}
	owner := o.UserID == userID
	note = truncate(note, 300)
	active := []string{"pending", "countered"}
	switch {
	case isGM && action == "accept" && (o.Status == "pending" || o.Status == "countered"):
		if priceCP <= 0 {
			priceCP = o.OfferedCP
		}
		return m.close(ctx, o, priceCP, active)
	case isGM && action == "reject" && (o.Status == "pending" || o.Status == "countered"):
		return "Pedido rechazado.", m.repo.SetOfferStatus(ctx, o.ID, active, "rejected", nil, note)
	case isGM && action == "counter" && o.Status == "pending":
		if priceCP <= 0 {
			return "", ErrShopUnavailable{"Indica el precio que propone el vendedor"}
		}
		return "Propuesta enviada.", m.repo.SetOfferStatus(ctx, o.ID, []string{"pending"}, "countered", &priceCP, note)
	case owner && action == "accept" && o.Status == "countered" && o.CounterCP != nil:
		return m.close(ctx, o, *o.CounterCP, []string{"countered"})
	case owner && action == "reject" && o.Status == "countered":
		return "Rechazaste la propuesta del vendedor.", m.repo.SetOfferStatus(ctx, o.ID, []string{"countered"}, "rejected", nil, "")
	case (owner || isGM) && action == "withdraw" && (o.Status == "pending" || o.Status == "countered"):
		return "Pedido retirado.", m.repo.SetOfferStatus(ctx, o.ID, active, "withdrawn", nil, "")
	}
	return "", repository.ErrOfferResolved
}

// close charges the agreed total and delivers the cart. On a user error (funds, stock) the offer
// stays open so the table can adjust it.
func (m *Market) close(ctx context.Context, o *domain.ShopOffer, totalCP int64, from []string) (string, error) {
	err := m.repo.CloseOffer(ctx, o, from, totalCP, func(g, s, c int) (int, int, int, error) {
		w, err := (Wallet{g, s, c}).Pay(totalCP)
		return w.Gold, w.Silver, w.Copper, err
	})
	if err != nil {
		if IsMarketUserError(err) {
			return "", ErrShopUnavailable{"No se pudo cerrar el trato: " + err.Error()}
		}
		return "", err
	}
	return fmt.Sprintf("Trato cerrado: %s por %s.", o.Summary, FormatCP(totalCP)), nil
}

func truncate(s string, n int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) > n {
		r = r[:n]
	}
	return string(r)
}
