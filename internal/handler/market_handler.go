package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// MarketHandler serves shops and NPC belongings (openspec/specs/market-bastions.md §7).
type MarketHandler struct {
	repo   *repository.MarketRepository
	market *service.Market
}

func NewMarketHandler(repo *repository.MarketRepository, market *service.Market) *MarketHandler {
	return &MarketHandler{repo: repo, market: market}
}

func (h *MarketHandler) RegisterRoutes(g *gin.RouterGroup) {
	g.GET("/campaigns/:id/shops", h.ListShops)
	g.POST("/campaigns/:id/shops", h.SaveShop)
	g.PUT("/campaigns/:id/shops/:shop_id", h.SaveShop)
	g.DELETE("/campaigns/:id/shops/:shop_id", h.DeleteShop)
	g.GET("/campaigns/:id/shops/:shop_id/items", h.ListItems)
	g.POST("/campaigns/:id/shops/:shop_id/items", h.SaveItem)
	g.PUT("/campaigns/:id/shop-items/:item_id", h.SaveItem)
	g.DELETE("/campaigns/:id/shop-items/:item_id", h.DeleteItem)
	g.POST("/campaigns/:id/shops/:shop_id/buy", h.Buy)
	g.POST("/campaigns/:id/shops/:shop_id/sell", h.Sell)
	g.GET("/campaigns/:id/shops/:shop_id/sellable", h.Sellable)
	g.POST("/campaigns/:id/shops/:shop_id/offers", h.MakeOffer)
	g.GET("/campaigns/:id/offers", h.ListOffers)
	g.POST("/campaigns/:id/offers/:offer_id/:action", h.ResolveOffer)
	g.GET("/campaigns/:id/npcs/:resource_id/items", h.ListNPCItems)
	g.POST("/campaigns/:id/npcs/:resource_id/items", h.SaveNPCItem)
	g.PUT("/campaigns/:id/npc-items/:item_id", h.SaveNPCItem)
	g.DELETE("/campaigns/:id/npc-items/:item_id", h.DeleteNPCItem)
}

func (h *MarketHandler) fail(c *gin.Context, err error, msg string) {
	switch {
	case errors.Is(err, repository.ErrMarketNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
	case service.IsMarketUserError(err):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		log.Printf("market: %s: %v", msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
	}
}

func gmOnly(c *gin.Context) bool {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Solo el DM puede hacer esto"})
		return false
	}
	return true
}

// ---------- Shops ----------

func (h *MarketHandler) ListShops(c *gin.Context) {
	ctx := c.Request.Context()
	shops, err := h.repo.Shops(ctx, parseID(c.Param("id")))
	if err != nil {
		h.fail(c, err, "no se pudieron cargar las tiendas")
		return
	}
	c.JSON(http.StatusOK, h.market.Annotate(ctx, shops, middleware.GetUserID(c), middleware.IsGM(c)))
}

type shopInput struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Icon         string   `json:"icon"`
	NPCID        *int64   `json:"npc_id"`
	Availability string   `json:"availability"`
	SceneID      *int64   `json:"scene_id"`
	ObjectID     *int64   `json:"object_id"`
	PricePct     int      `json:"price_pct"`
	BuyRatePct   *int     `json:"buy_rate_pct"`
	BuysTypes    []string `json:"buys_types"`
}

func (h *MarketHandler) SaveShop(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	var in shopInput
	if err := c.ShouldBindJSON(&in); err != nil || strings.TrimSpace(in.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "La tienda necesita un nombre"})
		return
	}
	switch in.Availability {
	case "open", "closed", "scene":
	default:
		in.Availability = "closed"
	}
	if in.Availability == "scene" && in.SceneID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Elige la escena donde abre la tienda"})
		return
	}
	if in.PricePct <= 0 {
		in.PricePct = 100
	}
	rate := 50
	if in.BuyRatePct != nil {
		rate = max(0, min(100, *in.BuyRatePct))
	}
	if in.Icon == "" {
		in.Icon = "storefront"
	}
	shop := &domain.Shop{
		ID: parseID(c.Param("shop_id")), CampaignID: parseID(c.Param("id")), Name: strings.TrimSpace(in.Name),
		Description: in.Description, Icon: in.Icon, NPCID: in.NPCID, Availability: in.Availability, SceneID: in.SceneID,
		ObjectID: in.ObjectID, PricePct: min(in.PricePct, 1000), BuyRatePct: rate, BuysTypes: in.BuysTypes,
	}
	if err := h.repo.SaveShop(c.Request.Context(), shop); err != nil {
		if strings.Contains(err.Error(), "shops_object_idx") {
			c.JSON(http.StatusConflict, gin.H{"error": "Ese objeto del mapa ya es el mostrador de otra tienda"})
			return
		}
		h.fail(c, err, "no se pudo guardar la tienda")
		return
	}
	saved, err := h.repo.Shop(c.Request.Context(), shop.CampaignID, shop.ID)
	if err != nil {
		h.fail(c, err, "no se pudo cargar la tienda")
		return
	}
	c.JSON(http.StatusOK, saved)
}

func (h *MarketHandler) DeleteShop(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	if err := h.repo.DeleteShop(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("shop_id"))); err != nil {
		h.fail(c, err, "no se pudo borrar la tienda")
		return
	}
	c.Status(http.StatusNoContent)
}

// ---------- Items ----------

func (h *MarketHandler) shopFor(c *gin.Context) (*domain.Shop, bool) {
	shop, err := h.repo.Shop(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("shop_id")))
	if err != nil {
		h.fail(c, err, "no se pudo cargar la tienda")
		return nil, false
	}
	if !middleware.IsGM(c) && shop.Availability == "closed" {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return nil, false
	}
	return shop, true
}

func (h *MarketHandler) ListItems(c *gin.Context) {
	shop, ok := h.shopFor(c)
	if !ok {
		return
	}
	items, err := h.repo.ShopItems(c.Request.Context(), shop.ID)
	if err != nil {
		h.fail(c, err, "no se pudo cargar el inventario")
		return
	}
	if !middleware.IsGM(c) {
		visible := items[:0]
		for _, it := range items {
			if it.Stock != 0 {
				visible = append(visible, it)
			}
		}
		items = visible
	}
	service.PriceItems(shop, items)
	shop.Available, shop.Reason = h.market.Availability(c.Request.Context(), shop, middleware.GetUserID(c), middleware.IsGM(c))
	c.JSON(http.StatusOK, gin.H{"shop": shop, "items": items})
}

type itemInput struct {
	Name               string  `json:"name"`
	ItemType           string  `json:"item_type"`
	Rarity             string  `json:"rarity"`
	PriceCP            int64   `json:"price_cp"`
	Weight             float64 `json:"weight"`
	Description        string  `json:"description"`
	AttunementRequired bool    `json:"attunement_required"`
	SRDRefID           *int64  `json:"srd_ref_id"`
	SRDKind            *string `json:"srd_kind"`
	Stock              *int    `json:"stock"`
}

func (h *MarketHandler) SaveItem(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	var in itemInput
	if err := c.ShouldBindJSON(&in); err != nil || strings.TrimSpace(in.Name) == "" || in.PriceCP < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El objeto necesita nombre y un precio válido"})
		return
	}
	it := &domain.ShopItem{
		Name: strings.TrimSpace(in.Name), ItemType: or(in.ItemType, "misc"), Rarity: or(in.Rarity, "common"), PriceCP: in.PriceCP,
		Weight: in.Weight, Description: in.Description, AttunementRequired: in.AttunementRequired, SRDRefID: in.SRDRefID, SRDKind: in.SRDKind, Stock: 1,
	}
	if in.Stock != nil {
		it.Stock = max(-1, *in.Stock)
	}
	if id := parseID(c.Param("item_id")); id != 0 {
		existing, err := h.repo.ShopItem(ctx, campaignID, id)
		if err != nil {
			h.fail(c, err, "no se pudo cargar el objeto")
			return
		}
		it.ID, it.ShopID, it.SRDRefID, it.SRDKind = existing.ID, existing.ShopID, existing.SRDRefID, existing.SRDKind
	} else {
		shop, err := h.repo.Shop(ctx, campaignID, parseID(c.Param("shop_id")))
		if err != nil {
			h.fail(c, err, "no se pudo cargar la tienda")
			return
		}
		it.ShopID = shop.ID
	}
	if err := h.repo.SaveShopItem(ctx, it); err != nil {
		h.fail(c, err, "no se pudo guardar el objeto")
		return
	}
	c.JSON(http.StatusOK, it)
}

func or(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

func (h *MarketHandler) DeleteItem(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	it, err := h.repo.ShopItem(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("item_id")))
	if err != nil {
		h.fail(c, err, "no se pudo cargar el objeto")
		return
	}
	if err := h.repo.DeleteShopItem(c.Request.Context(), it.ID); err != nil {
		h.fail(c, err, "no se pudo borrar el objeto")
		return
	}
	c.Status(http.StatusNoContent)
}

// ---------- Trading ----------

type tradeInput struct {
	ItemID          int64 `json:"item_id"`
	InventoryItemID int64 `json:"inventory_item_id"`
	Qty             int   `json:"qty"`
}

// Buy is a GM shortcut. Players always go through the seller with a cart (MakeOffer).
func (h *MarketHandler) Buy(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	var in tradeInput
	if err := c.ShouldBindJSON(&in); err != nil || in.ItemID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Falta el objeto"})
		return
	}
	res, err := h.market.Buy(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), parseID(c.Param("shop_id")), in.ItemID, in.Qty)
	if err != nil {
		h.fail(c, err, "no se pudo comprar")
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *MarketHandler) Sell(c *gin.Context) {
	var in tradeInput
	if err := c.ShouldBindJSON(&in); err != nil || in.InventoryItemID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Falta el objeto"})
		return
	}
	res, err := h.market.Sell(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), parseID(c.Param("shop_id")), in.InventoryItemID, in.Qty)
	if err != nil {
		h.fail(c, err, "no se pudo vender")
		return
	}
	c.JSON(http.StatusOK, res)
}

// Sellable lists the player's inventory with what this shop would pay per unit.
func (h *MarketHandler) Sellable(c *gin.Context) {
	shop, ok := h.shopFor(c)
	if !ok {
		return
	}
	characterID, err := h.repo.CharacterOf(c.Request.Context(), shop.CampaignID, middleware.GetUserID(c))
	if err != nil {
		c.JSON(http.StatusOK, []any{})
		return
	}
	items, err := h.repo.Sellable(c.Request.Context(), characterID)
	if err != nil {
		h.fail(c, err, "no se pudo cargar tu inventario")
		return
	}
	type offer struct {
		repository.SellableItem
		OfferCP int64  `json:"offer_cp"`
		Reason  string `json:"reason,omitempty"`
	}
	out := make([]offer, 0, len(items))
	for _, it := range items {
		o := offer{SellableItem: it}
		switch {
		case it.Blocked:
			o.Reason = "Equipado o ligado a una misión"
		case it.ValueCP == nil || *it.ValueCP <= 0:
			o.Reason = "Sin valor conocido"
		case shop.BuyRatePct <= 0:
			o.Reason = "La tienda no compra"
		case !service.ShopBuysType(shop.BuysTypes, it.ItemType):
			o.Reason = "No compra este tipo"
		default:
			o.OfferCP = service.ApplyPct(*it.ValueCP, shop.BuyRatePct, false)
		}
		out = append(out, o)
	}
	c.JSON(http.StatusOK, out)
}

// ---------- NPC belongings ----------

func (h *MarketHandler) ListNPCItems(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	npcID := parseID(c.Param("resource_id"))
	if _, err := h.repo.NPCInCampaign(c.Request.Context(), parseID(c.Param("id")), npcID); err != nil {
		h.fail(c, err, "no se pudo cargar el PNJ")
		return
	}
	items, err := h.repo.NPCItems(c.Request.Context(), npcID)
	if err != nil {
		h.fail(c, err, "no se pudieron cargar sus pertenencias")
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *MarketHandler) SaveNPCItem(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	var in domain.NPCItem
	if err := c.ShouldBindJSON(&in); err != nil || strings.TrimSpace(in.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El objeto necesita un nombre"})
		return
	}
	if id := parseID(c.Param("item_id")); id != 0 {
		existing, err := h.repo.NPCItem(ctx, campaignID, id)
		if err != nil {
			h.fail(c, err, "no se pudo cargar el objeto")
			return
		}
		in.ID, in.NPCID = existing.ID, existing.NPCID
	} else {
		in.ID = 0
		in.NPCID = parseID(c.Param("resource_id"))
		if _, err := h.repo.NPCInCampaign(ctx, campaignID, in.NPCID); err != nil {
			h.fail(c, err, "no se pudo cargar el PNJ")
			return
		}
	}
	in.Name = strings.TrimSpace(in.Name)
	if err := h.repo.SaveNPCItem(ctx, &in); err != nil {
		h.fail(c, err, "no se pudo guardar")
		return
	}
	c.JSON(http.StatusOK, in)
}

func (h *MarketHandler) DeleteNPCItem(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	it, err := h.repo.NPCItem(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("item_id")))
	if err != nil {
		h.fail(c, err, "no se pudo cargar el objeto")
		return
	}
	if err := h.repo.DeleteNPCItem(c.Request.Context(), it.ID); err != nil {
		h.fail(c, err, "no se pudo borrar")
		return
	}
	c.Status(http.StatusNoContent)
}

// ---------- Haggling ----------

func (h *MarketHandler) MakeOffer(c *gin.Context) {
	var in service.OfferInput
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Lines) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El carrito está vacío"})
		return
	}
	out, err := h.market.MakeOffer(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), parseID(c.Param("shop_id")), in)
	if err != nil {
		h.fail(c, err, "no se pudo hacer la oferta")
		return
	}
	if out.Offer != nil {
		hideRoll(out.Offer)
	}
	c.JSON(http.StatusOK, out)
}

// hideRoll removes the secret haggling roll from what a player receives.
func hideRoll(o *domain.ShopOffer) {
	o.RollTotal, o.RollDetail = nil, ""
}

// ListOffers: the GM gets the whole pending queue; a player gets their active and recent offers.
func (h *MarketHandler) ListOffers(c *gin.Context) {
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	if middleware.IsGM(c) {
		offers, err := h.repo.ActiveOffers(ctx, campaignID, 0)
		if err != nil {
			h.fail(c, err, "no se pudieron cargar las ofertas")
			return
		}
		c.JSON(http.StatusOK, gin.H{"active": offers})
		return
	}
	userID := middleware.GetUserID(c)
	active, err := h.repo.ActiveOffers(ctx, campaignID, userID)
	if err != nil {
		h.fail(c, err, "no se pudieron cargar las ofertas")
		return
	}
	recent, err := h.repo.RecentOffers(ctx, campaignID, userID)
	if err != nil {
		h.fail(c, err, "no se pudieron cargar las ofertas")
		return
	}
	for i := range active {
		hideRoll(&active[i])
	}
	for i := range recent {
		hideRoll(&recent[i])
	}
	c.JSON(http.StatusOK, gin.H{"active": active, "recent": recent})
}

func (h *MarketHandler) ResolveOffer(c *gin.Context) {
	var in struct {
		PriceCP int64  `json:"price_cp"`
		Note    string `json:"note"`
	}
	_ = c.ShouldBindJSON(&in)
	msg, err := h.market.ResolveOffer(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c),
		parseID(c.Param("offer_id")), c.Param("action"), in.PriceCP, in.Note)
	if err != nil {
		h.fail(c, err, "no se pudo resolver la oferta")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": msg})
}
