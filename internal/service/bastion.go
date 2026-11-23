package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// Bastions implements the Bastion system (openspec/specs/market-bastions.md §6).
type Bastions struct {
	repo *repository.BastionRepository
	rng  Roller
}

func NewBastions(repo *repository.BastionRepository) *Bastions {
	return &Bastions{repo: repo, rng: defaultRoller{}}
}

// BastionError is a rule violation shown to the user (409).
type BastionError struct{ Msg string }

func (e BastionError) Error() string { return e.Msg }

// IsBastionUserError tells whether err is a user-facing rule violation.
func IsBastionUserError(err error) bool {
	var u BastionError
	return errors.As(err, &u) || errors.Is(err, ErrInsufficientFunds) ||
		errors.Is(err, repository.ErrNotEnoughItems) || errors.Is(err, repository.ErrBastionExists)
}

// BastionDetail is a Bastion with the catalogue its owner can build from.
type BastionDetail struct {
	Bastion      *domain.Bastion              `json:"bastion"`
	Catalog      []domain.BastionCatalogEntry `json:"catalog"`
	SpecialSlots int                          `json:"special_slots"`
	SpecialUsed  int                          `json:"special_used"`
}

// BastionList is what GET /bastions returns.
type BastionList struct {
	Bastions []domain.Bastion             `json:"bastions"`
	Catalog  []domain.BastionCatalogEntry `json:"catalog"`
}

var bastionOrders = map[string]bool{"craft": true, "empower": true, "harvest": true, "maintain": true, "recruit": true, "research": true, "trade": true}
var bastionSizes = map[string]bool{"cramped": true, "roomy": true, "vast": true}
var bastionKinds = map[string]bool{"item": true, "gold": true, "defender": true, "narrative": true}

func attachCatalog(b *domain.Bastion, catalog []domain.BastionCatalogEntry) {
	byID := map[int64]domain.BastionCatalogEntry{}
	for _, e := range catalog {
		byID[e.ID] = e
	}
	for i := range b.Facilities {
		f := &b.Facilities[i]
		if f.CatalogID == nil {
			continue
		}
		if e, ok := byID[*f.CatalogID]; ok {
			f.Description, f.Prerequisite, f.Orders, f.Options = e.Description, e.Prerequisite, e.Orders, e.Options
		}
	}
}

func countSpecial(b *domain.Bastion) int {
	n := 0
	for _, f := range b.Facilities {
		if f.Kind == "special" {
			n++
		}
	}
	return n
}

func canAccess(b *domain.Bastion, userID int64, isGM bool) bool {
	return isGM || b.OwnerUserID == userID
}

// List returns the GM's whole campaign or a player's own Bastion.
func (s *Bastions) List(ctx context.Context, campaignID, userID int64, isGM bool) (*BastionList, error) {
	catalog, err := s.repo.Catalog(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	owner := userID
	if isGM {
		owner = 0
	}
	list, err := s.repo.Bastions(ctx, campaignID, owner)
	if err != nil {
		return nil, err
	}
	for i := range list {
		attachCatalog(&list[i], catalog)
	}
	return &BastionList{Bastions: list, Catalog: catalog}, nil
}

// Get returns one Bastion to its owner or the GM.
func (s *Bastions) Get(ctx context.Context, campaignID, userID int64, isGM bool, id int64) (*BastionDetail, error) {
	b, err := s.repo.Bastion(ctx, campaignID, id)
	if err != nil {
		return nil, err
	}
	if !canAccess(b, userID, isGM) {
		return nil, repository.ErrBastionNotFound
	}
	return s.detail(ctx, campaignID, b)
}

func (s *Bastions) detail(ctx context.Context, campaignID int64, b *domain.Bastion) (*BastionDetail, error) {
	catalog, err := s.repo.Catalog(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	attachCatalog(b, catalog)
	return &BastionDetail{Bastion: b, Catalog: catalog, SpecialSlots: SpecialSlots(b.CharacterLevel), SpecialUsed: countSpecial(b)}, nil
}

// FoundInput is the body of POST /bastions.
type FoundInput struct {
	CharacterID int64    `json:"character_id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	BasicKinds  []string `json:"basic_kinds"`
}

// Found creates a Bastion: players need level 5, the GM can always create one (§6.1).
func (s *Bastions) Found(ctx context.Context, campaignID, userID int64, isGM bool, in FoundInput) (*BastionDetail, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, BastionError{"El bastión necesita un nombre"}
	}
	var char *repository.CharacterRef
	var err error
	if isGM {
		if in.CharacterID == 0 {
			return nil, BastionError{"Elige el personaje dueño del bastión"}
		}
		char, err = s.repo.Character(ctx, campaignID, in.CharacterID)
	} else {
		char, err = s.repo.CharacterOfUser(ctx, campaignID, userID)
		if err == nil && char.Level < 5 {
			return nil, BastionError{"Necesitas nivel 5 para fundar un bastión"}
		}
	}
	if err != nil {
		if errors.Is(err, repository.ErrBastionNotFound) {
			return nil, BastionError{"Necesitas un personaje en la campaña"}
		}
		return nil, err
	}
	pick := func(i int, def string) string {
		if i < len(in.BasicKinds) {
			if _, ok := BasicKinds[in.BasicKinds[i]]; ok {
				return in.BasicKinds[i]
			}
		}
		return def
	}
	k1, k2 := pick(0, "bedroom"), pick(1, "parlor")
	b := &domain.Bastion{CampaignID: campaignID, CharacterID: char.ID, Name: truncate(name, 160), Description: truncate(in.Description, 2000)}
	seeds := []repository.BasicSeed{
		{Kind: k1, Name: BasicKinds[k1], Size: "cramped"},
		{Kind: k2, Name: BasicKinds[k2], Size: "roomy"},
	}
	if err := s.repo.CreateBastion(ctx, b, seeds); err != nil {
		return nil, err
	}
	return s.Get(ctx, campaignID, userID, true, b.ID)
}

// Rename edits a Bastion's name and description.
func (s *Bastions) Rename(ctx context.Context, campaignID, userID int64, isGM bool, id int64, name, description string) (*BastionDetail, error) {
	b, err := s.repo.Bastion(ctx, campaignID, id)
	if err != nil {
		return nil, err
	}
	if !canAccess(b, userID, isGM) {
		return nil, repository.ErrBastionNotFound
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, BastionError{"El bastión necesita un nombre"}
	}
	if err := s.repo.UpdateBastion(ctx, campaignID, id, truncate(name, 160), truncate(description, 2000)); err != nil {
		return nil, err
	}
	return s.Get(ctx, campaignID, userID, isGM, id)
}

// FacilityInput is the body of POST /bastions/:bid/facilities.
type FacilityInput struct {
	Type       string `json:"type"` // special | basic | enlarge
	CatalogID  int64  `json:"catalog_id"`
	BasicKind  string `json:"basic_kind"`
	Size       string `json:"size"`
	FacilityID int64  `json:"facility_id"`
}

func payFunc(cp int64) repository.WalletFunc {
	return func(g, sv, c int) (int, int, int, error) {
		w, err := (Wallet{g, sv, c}).Pay(cp)
		return w.Gold, w.Silver, w.Copper, err
	}
}

// AddFacility adds a special facility (free, within the level's allowance), queues a new basic
// facility or enlarges one. Gold is paid up front by the owner; the GM works for free.
func (s *Bastions) AddFacility(ctx context.Context, campaignID, userID int64, isGM bool, bid int64, in FacilityInput) (*BastionDetail, error) {
	b, err := s.repo.Bastion(ctx, campaignID, bid)
	if err != nil {
		return nil, err
	}
	if !canAccess(b, userID, isGM) {
		return nil, repository.ErrBastionNotFound
	}
	var pay repository.WalletFunc
	charge := func(cp int64) {
		if !isGM && cp > 0 {
			pay = payFunc(cp)
		}
	}
	switch in.Type {
	case "special":
		catalog, err := s.repo.Catalog(ctx, campaignID)
		if err != nil {
			return nil, err
		}
		var entry *domain.BastionCatalogEntry
		for i := range catalog {
			if catalog[i].ID == in.CatalogID {
				entry = &catalog[i]
			}
		}
		if entry == nil {
			return nil, repository.ErrBastionNotFound
		}
		if !isGM {
			if b.CharacterLevel < entry.MinLevel {
				return nil, BastionError{fmt.Sprintf("«%s» requiere nivel %d", entry.Name, entry.MinLevel)}
			}
			if countSpecial(b) >= SpecialSlots(b.CharacterLevel) {
				return nil, BastionError{"No tienes más espacios de instalación especial a tu nivel"}
			}
		}
		if _, err := s.repo.AddSpecialFacility(ctx, b.ID, *entry); err != nil {
			return nil, err
		}
	case "basic":
		spec, ok := BasicBuildSpec(in.Size)
		if _, known := BasicKinds[in.BasicKind]; !ok || !known {
			return nil, BastionError{"Elige el tipo y el tamaño de la instalación básica"}
		}
		charge(spec.CostCP)
		c := &domain.BastionConstruction{BastionID: b.ID, Kind: "add", BasicKind: in.BasicKind, TargetSize: in.Size, TotalDays: spec.Days, CostCP: spec.CostCP}
		if isGM {
			c.CostCP = 0
		}
		if err := s.repo.StartConstruction(ctx, c, b.CharacterID, pay); err != nil {
			return nil, err
		}
	case "enlarge":
		var target *domain.BastionFacility
		for i := range b.Facilities {
			if b.Facilities[i].ID == in.FacilityID && b.Facilities[i].Kind == "basic" {
				target = &b.Facilities[i]
			}
		}
		if target == nil {
			return nil, repository.ErrBastionNotFound
		}
		for _, c := range b.Construction {
			if c.FacilityID != nil && *c.FacilityID == target.ID {
				return nil, BastionError{"Esa instalación ya está en obras"}
			}
		}
		next, spec, ok := EnlargeSpec(target.Size)
		if !ok {
			return nil, BastionError{"Esa instalación ya es del tamaño máximo"}
		}
		charge(spec.CostCP)
		c := &domain.BastionConstruction{BastionID: b.ID, Kind: "enlarge", FacilityID: &target.ID, BasicKind: target.BasicKind, TargetSize: next, TotalDays: spec.Days, CostCP: spec.CostCP}
		if isGM {
			c.CostCP = 0
		}
		if err := s.repo.StartConstruction(ctx, c, b.CharacterID, pay); err != nil {
			return nil, err
		}
	default:
		return nil, BastionError{"Tipo de instalación desconocido"}
	}
	return s.Get(ctx, campaignID, userID, isGM, bid)
}

// RemoveFacility deletes a facility of the caller's Bastion.
func (s *Bastions) RemoveFacility(ctx context.Context, campaignID, userID int64, isGM bool, fid int64) error {
	_, b, err := s.repo.Facility(ctx, campaignID, fid)
	if err != nil {
		return err
	}
	if !canAccess(b, userID, isGM) {
		return repository.ErrBastionNotFound
	}
	return s.repo.DeleteFacility(ctx, fid)
}

// OrderInput is the body of PUT /bastion-facilities/:fid/order.
type OrderInput struct {
	Order  string `json:"order"`
	Option string `json:"option"`
}

// IssueOrder gives a special facility an order for the next Bastion turn (owner only). The
// option's cost is charged now; replacing an order that has not progressed refunds it.
func (s *Bastions) IssueOrder(ctx context.Context, campaignID, userID int64, fid int64, in OrderInput) (*BastionDetail, error) {
	f, b, err := s.repo.Facility(ctx, campaignID, fid)
	if err != nil {
		return nil, err
	}
	if b.OwnerUserID != userID {
		return nil, repository.ErrBastionNotFound
	}
	if f.Kind != "special" {
		return nil, BastionError{"Solo las instalaciones especiales reciben órdenes"}
	}
	catalog, err := s.repo.Catalog(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	var entry *domain.BastionCatalogEntry
	for i := range catalog {
		if f.CatalogID != nil && catalog[i].ID == *f.CatalogID {
			entry = &catalog[i]
		}
	}

	var refund int64
	if orderActive(*f) {
		var old domain.BastionOption
		if json.Unmarshal(f.OrderOption, &old) == nil {
			if f.TurnsLeft < max(old.Turns, 1) {
				return nil, BastionError{"Esta instalación tiene una orden en curso; espera a que termine"}
			}
			refund = old.CostCP
		}
	}

	order := strings.ToLower(strings.TrimSpace(in.Order))
	var option domain.JSONB
	turns := 0
	var cost int64
	if order != "" && order != "maintain" {
		if entry == nil || !bastionOrders[order] || !bastionContains(entry.Orders, order) {
			return nil, BastionError{"Esta instalación no admite esa orden"}
		}
		opt, ok := ValidOrderOption(entry.Options, order, in.Option)
		if !ok {
			return nil, BastionError{"Elige una opción válida para la orden"}
		}
		raw, err := json.Marshal(opt)
		if err != nil {
			return nil, err
		}
		option, turns, cost = domain.JSONB(raw), max(opt.Turns, 1), opt.CostCP
	} else {
		order = ""
		if in.Order == "maintain" {
			order = "maintain"
		}
	}
	var adjust repository.WalletFunc
	if refund > 0 || cost > 0 {
		adjust = func(g, sv, c int) (int, int, int, error) {
			w, err := (Wallet{g, sv, c}).Receive(refund).Pay(cost)
			return w.Gold, w.Silver, w.Copper, err
		}
	}
	if err := s.repo.SetOrder(ctx, f.ID, order, option, turns, b.CharacterID, adjust); err != nil {
		return nil, err
	}
	return s.Get(ctx, campaignID, userID, false, b.ID)
}

func bastionContains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

// TurnSummary is what running a Bastion turn returns to the GM.
type TurnSummary struct {
	Turn    int                `json:"turn"`
	Results []TurnBastionEntry `json:"results"`
}

type TurnBastionEntry struct {
	BastionID int64    `json:"bastion_id"`
	Name      string   `json:"name"`
	Owner     string   `json:"owner"`
	Event     string   `json:"event,omitempty"`
	Log       []string `json:"log"`
}

// RunTurn runs a Bastion turn (7 in-game days) for every Bastion of the campaign (GM only).
func (s *Bastions) RunTurn(ctx context.Context, campaignID int64) (*TurnSummary, error) {
	bastions, err := s.repo.Bastions(ctx, campaignID, 0)
	if err != nil {
		return nil, err
	}
	if len(bastions) == 0 {
		return nil, BastionError{"Todavía no hay bastiones en la campaña"}
	}
	events, err := s.repo.Events(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	turn, err := s.repo.NextTurnNumber(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	results := make([]domain.BastionTurnResult, 0, len(bastions))
	summary := &TurnSummary{Turn: turn}
	for i := range bastions {
		b := &bastions[i]
		res := ProcessBastion(s.rng, b, events, turn)
		results = append(results, res)
		summary.Results = append(summary.Results, TurnBastionEntry{BastionID: b.ID, Name: b.Name, Owner: b.CharacterName, Event: res.EventName, Log: res.Log})
	}
	err = s.repo.ApplyTurn(ctx, campaignID, results, func(g, sv, c int, cp int64) (int, int, int) {
		w := (Wallet{g, sv, c}).Receive(cp)
		return w.Gold, w.Silver, w.Copper
	})
	if err != nil {
		return nil, err
	}
	return summary, nil
}

// SaleInput is the body of POST /bastions/:bid/sell and /take.
type SaleInput struct {
	WarehouseID int64 `json:"warehouse_id"`
	Qty         int   `json:"qty"`
}

// SaleResult is returned to the seller.
type SaleResult struct {
	Message  string `json:"message"`
	PayoutCP int64  `json:"payout_cp"`
	Buyer    string `json:"buyer"`
}

// SellWarehouse sells goods to a random buyer (§6.5); owner only.
func (s *Bastions) SellWarehouse(ctx context.Context, campaignID, userID, bid int64, in SaleInput) (*SaleResult, error) {
	b, err := s.repo.Bastion(ctx, campaignID, bid)
	if err != nil {
		return nil, err
	}
	if b.OwnerUserID != userID {
		return nil, repository.ErrBastionNotFound
	}
	npcs, err := s.repo.NPCs(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	pct, err := s.repo.SalePct(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	qty := max(in.Qty, 1)
	buyer := "un comprador anónimo"
	it, sale, err := s.repo.SellWarehouse(ctx, b.ID, in.WarehouseID, qty, b.CharacterID,
		func(it domain.WarehouseItem) repository.WarehouseSale {
			p := PlanSale(s.rng, len(npcs), it.ValueCP, qty, pct)
			ws := repository.WarehouseSale{PayoutCP: p.PayoutCP}
			if p.NPCIndex >= 0 {
				npc := npcs[p.NPCIndex]
				ws.NPCID, ws.Location = &npc.ID, p.Location
				ws.Source = fmt.Sprintf("Comprado al bastión de %s", b.CharacterName)
				buyer = npc.Name
			}
			return ws
		},
		func(g, sv, c int, cp int64) (int, int, int) {
			w := (Wallet{g, sv, c}).Receive(cp)
			return w.Gold, w.Silver, w.Copper
		})
	if err != nil {
		return nil, err
	}
	label := it.Name
	if qty > 1 {
		label = fmt.Sprintf("%d × %s", qty, it.Name)
	}
	return &SaleResult{Message: fmt.Sprintf("Vendiste %s a %s por %s.", label, buyer, FormatCP(sale.PayoutCP)), PayoutCP: sale.PayoutCP, Buyer: buyer}, nil
}

// TakeWarehouse moves goods to the owner's inventory.
func (s *Bastions) TakeWarehouse(ctx context.Context, campaignID, userID, bid int64, in SaleInput) (string, error) {
	b, err := s.repo.Bastion(ctx, campaignID, bid)
	if err != nil {
		return "", err
	}
	if b.OwnerUserID != userID {
		return "", repository.ErrBastionNotFound
	}
	qty := max(in.Qty, 1)
	it, err := s.repo.TakeWarehouse(ctx, b.ID, in.WarehouseID, qty, b.CharacterID)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%d × %s pasan a tu inventario.", qty, it.Name), nil
}

// ---------- Catalogue ----------

// CatalogPayload is the body of PUT /bastion-catalog.
type CatalogPayload struct {
	Facilities []domain.BastionCatalogEntry `json:"facilities"`
	Events     []domain.BastionEvent        `json:"events"`
}

// ValidateCatalog checks a catalogue edit and returns the first problem found.
func ValidateCatalog(p *CatalogPayload) error {
	if len(p.Facilities) > 200 || len(p.Events) > 100 {
		return BastionError{"El catálogo es demasiado grande"}
	}
	for i := range p.Facilities {
		e := &p.Facilities[i]
		e.Name = strings.TrimSpace(e.Name)
		if e.Name == "" {
			return BastionError{"Toda instalación necesita un nombre"}
		}
		if e.MinLevel < 1 || e.MinLevel > 20 {
			return BastionError{fmt.Sprintf("«%s»: el nivel mínimo va de 1 a 20", e.Name)}
		}
		if !bastionSizes[e.Size] {
			e.Size = "roomy"
		}
		if e.Hirelings < 0 || e.Hirelings > 20 {
			return BastionError{fmt.Sprintf("«%s»: empleados entre 0 y 20", e.Name)}
		}
		for _, o := range e.Orders {
			if !bastionOrders[o] || o == "maintain" {
				return BastionError{fmt.Sprintf("«%s»: orden desconocida «%s»", e.Name, o)}
			}
		}
		seen := map[string]bool{}
		for j := range e.Options {
			o := &e.Options[j]
			o.ID, o.Name = strings.TrimSpace(o.ID), strings.TrimSpace(o.Name)
			if o.ID == "" || o.Name == "" || seen[o.ID] {
				return BastionError{fmt.Sprintf("«%s»: cada opción necesita un id único y un nombre", e.Name)}
			}
			seen[o.ID] = true
			if !bastionContains(e.Orders, o.Order) {
				return BastionError{fmt.Sprintf("«%s»: la opción «%s» usa una orden que la instalación no admite", e.Name, o.Name)}
			}
			if !bastionKinds[o.Kind] {
				return BastionError{fmt.Sprintf("«%s»: tipo de resultado inválido en «%s»", e.Name, o.Name)}
			}
			if o.Turns < 1 || o.Turns > 52 || o.CostCP < 0 || o.ValueCP < 0 || o.GoldMultCP < 0 || o.Qty < 0 || o.Defenders < 0 {
				return BastionError{fmt.Sprintf("«%s»: valores fuera de rango en «%s»", e.Name, o.Name)}
			}
			if o.Kind == "gold" {
				if _, _, err := ParseDice(o.GoldDice); err != nil {
					return BastionError{fmt.Sprintf("«%s»: dados inválidos en «%s»", e.Name, o.Name)}
				}
			}
		}
	}
	for i := range p.Events {
		ev := &p.Events[i]
		ev.Name = strings.TrimSpace(ev.Name)
		if ev.Name == "" || ev.RollMin < 1 || ev.RollMax > 100 || ev.RollMin > ev.RollMax {
			return BastionError{"Cada evento necesita nombre y un rango dentro de 1-100"}
		}
		if ev.RewardDice != "" {
			if _, _, err := ParseDice(ev.RewardDice); err != nil {
				return BastionError{fmt.Sprintf("Evento «%s»: dados inválidos", ev.Name)}
			}
		}
		if ev.RewardMultCP < 0 {
			return BastionError{fmt.Sprintf("Evento «%s»: recompensa inválida", ev.Name)}
		}
	}
	return nil
}

// Catalog returns the campaign's catalogue and events table.
func (s *Bastions) Catalog(ctx context.Context, campaignID int64) (*CatalogPayload, error) {
	f, err := s.repo.Catalog(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	e, err := s.repo.Events(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	return &CatalogPayload{Facilities: f, Events: e}, nil
}

// SaveCatalog validates and stores a catalogue edit.
func (s *Bastions) SaveCatalog(ctx context.Context, campaignID int64, p *CatalogPayload) (*CatalogPayload, error) {
	if err := ValidateCatalog(p); err != nil {
		return nil, err
	}
	if err := s.repo.SaveCatalog(ctx, campaignID, p.Facilities, p.Events); err != nil {
		return nil, err
	}
	return s.Catalog(ctx, campaignID)
}
