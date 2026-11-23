package service

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"strconv"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// Pure Bastion rules (openspec/specs/market-bastions.md §6): costs, turn processing, events and
// the sale of warehouse goods. Randomness comes through Roller so it can be tested.

// Roller returns a random integer in [0, n).
type Roller interface{ Intn(n int) int }

type defaultRoller struct{}

func (defaultRoller) Intn(n int) int { return rand.IntN(n) }

// TurnDays is the length of a Bastion turn in in-game days.
const TurnDays = 7

// Sale split (§6.5).
const (
	NPCBuyerPct   = 15 // % of sales bought by a campaign NPC (the rest go to anonymous buyers)
	NPCInventoryP = 60 // % of NPC purchases that end up in the NPC inventory (the rest at home)
)

// SpecialSlots is the number of special facilities allowed at a level (§6.3).
func SpecialSlots(level int) int {
	switch {
	case level >= 17:
		return 6
	case level >= 13:
		return 5
	case level >= 9:
		return 4
	case level >= 5:
		return 2
	}
	return 0
}

// SizeSquares maps a size to its squares (§6.2).
func SizeSquares(size string) int {
	switch size {
	case "cramped":
		return 4
	case "roomy":
		return 16
	case "vast":
		return 36
	}
	return 0
}

// BuildSpec is the cost and duration of a construction.
type BuildSpec struct {
	CostCP int64
	Days   int
}

// BasicBuildSpec is the price of adding a basic facility of the size (gold up front).
func BasicBuildSpec(size string) (BuildSpec, bool) {
	switch size {
	case "cramped":
		return BuildSpec{500 * 100, 20}, true
	case "roomy":
		return BuildSpec{1000 * 100, 45}, true
	case "vast":
		return BuildSpec{3000 * 100, 125}, true
	}
	return BuildSpec{}, false
}

// EnlargeSpec returns the next size and the price of enlarging a basic facility.
func EnlargeSpec(from string) (string, BuildSpec, bool) {
	switch from {
	case "cramped":
		return "roomy", BuildSpec{500 * 100, 25}, true
	case "roomy":
		return "vast", BuildSpec{2000 * 100, 80}, true
	}
	return "", BuildSpec{}, false
}

// BasicKinds are the six basic facilities (§6.2) with their Spanish label.
var BasicKinds = map[string]string{
	"bedroom": "Dormitorio", "dining": "Comedor", "parlor": "Salón",
	"courtyard": "Patio", "kitchen": "Cocina", "storage": "Almacenamiento",
}

// ParseDice reads "2d6" (a leading count is optional).
func ParseDice(expr string) (count, sides int, err error) {
	e := strings.ToLower(strings.TrimSpace(expr))
	left, right, ok := strings.Cut(e, "d")
	if !ok {
		return 0, 0, fmt.Errorf("dados inválidos: %q", expr)
	}
	count = 1
	if left != "" {
		if count, err = strconv.Atoi(left); err != nil {
			return 0, 0, fmt.Errorf("dados inválidos: %q", expr)
		}
	}
	if sides, err = strconv.Atoi(right); err != nil || count < 1 || count > 100 || sides < 2 || sides > 1000 {
		return 0, 0, fmt.Errorf("dados inválidos: %q", expr)
	}
	return count, sides, nil
}

// RollDice rolls an expression like "2d6" and returns the total.
func RollDice(r Roller, expr string) (int, error) {
	n, sides, err := ParseDice(expr)
	if err != nil {
		return 0, err
	}
	total := 0
	for range n {
		total += 1 + r.Intn(sides)
	}
	return total, nil
}

// PickEvent returns the table row containing roll (1..100), or nil.
func PickEvent(events []domain.BastionEvent, roll int) *domain.BastionEvent {
	for i := range events {
		if roll >= events[i].RollMin && roll <= events[i].RollMax {
			return &events[i]
		}
	}
	return nil
}

func orderActive(f domain.BastionFacility) bool {
	return f.Kind == "special" && f.OrderName != "" && f.OrderName != "maintain" && len(f.OrderOption) > 0
}

// AllMaintain reports whether every facility is on Maintain or has no order (§6.4).
func AllMaintain(fs []domain.BastionFacility) bool {
	for _, f := range fs {
		if orderActive(f) {
			return false
		}
	}
	return true
}

// ProcessBastion resolves one Bastion turn: orders, event (when all on Maintain) and construction.
// It never touches the database; the result is applied by the repository.
func ProcessBastion(r Roller, b *domain.Bastion, events []domain.BastionEvent, turn int) domain.BastionTurnResult {
	res := domain.BastionTurnResult{BastionID: b.ID, CharacterID: b.CharacterID, TurnNumber: turn}
	maintainOnly := AllMaintain(b.Facilities)

	for _, f := range b.Facilities {
		if !orderActive(f) {
			continue
		}
		var opt domain.BastionOption
		if err := json.Unmarshal(f.OrderOption, &opt); err != nil {
			res.Log = append(res.Log, fmt.Sprintf("%s: la orden no se pudo leer y se canceló.", f.Name))
			res.Facilities = append(res.Facilities, domain.FacilityOrderState{ID: f.ID})
			continue
		}
		left := f.TurnsLeft - 1
		if left > 0 {
			res.Log = append(res.Log, fmt.Sprintf("%s: «%s» avanza (quedan %d turnos).", f.Name, opt.Name, left))
			res.Facilities = append(res.Facilities, domain.FacilityOrderState{ID: f.ID, OrderName: f.OrderName, OrderOption: f.OrderOption, TurnsLeft: left})
			continue
		}
		res.Facilities = append(res.Facilities, domain.FacilityOrderState{ID: f.ID})
		applyOption(r, &res, b, f, opt)
	}

	if maintainOnly {
		roll := 1 + r.Intn(100)
		res.EventRoll = roll
		if ev := PickEvent(events, roll); ev != nil {
			res.EventName = ev.Name
			res.Log = append(res.Log, fmt.Sprintf("Evento (d100 = %d): %s. %s", roll, ev.Name, ev.Description))
			if ev.RewardDice != "" {
				if total, err := RollDice(r, ev.RewardDice); err == nil {
					gold := int64(total) * ev.RewardMultCP
					res.GoldCP += gold
					res.Log = append(res.Log, fmt.Sprintf("%s deja %s.", ev.Name, FormatCP(gold)))
				}
			}
		} else {
			res.Log = append(res.Log, fmt.Sprintf("Evento (d100 = %d): la tabla no tiene resultado.", roll))
		}
	}

	for _, c := range b.Construction {
		left := c.DaysLeft - TurnDays
		up := domain.ConstructionUpdate{ID: c.ID, DaysLeft: max(left, 0), Done: left <= 0}
		res.Construction = append(res.Construction, up)
		label := constructionLabel(c)
		if up.Done {
			res.Log = append(res.Log, fmt.Sprintf("Obra terminada: %s.", label))
		} else {
			res.Log = append(res.Log, fmt.Sprintf("Obra en curso: %s (quedan %d días).", label, up.DaysLeft))
		}
	}
	if len(res.Log) == 0 {
		res.Log = append(res.Log, "Semana sin novedades.")
	}
	return res
}

func constructionLabel(c domain.BastionConstruction) string {
	if c.Kind == "enlarge" {
		return fmt.Sprintf("ampliación a %s", SizeLabel(c.TargetSize))
	}
	name := BasicKinds[c.BasicKind]
	if name == "" {
		name = c.BasicKind
	}
	return fmt.Sprintf("%s (%s)", name, SizeLabel(c.TargetSize))
}

// SizeLabel is the Spanish label of a size.
func SizeLabel(size string) string {
	switch size {
	case "cramped":
		return "reducida"
	case "roomy":
		return "amplia"
	case "vast":
		return "enorme"
	}
	return size
}

func applyOption(r Roller, res *domain.BastionTurnResult, b *domain.Bastion, f domain.BastionFacility, opt domain.BastionOption) {
	source := fmt.Sprintf("%s · %s", f.Name, opt.Name)
	switch opt.Kind {
	case "item":
		qty := max(opt.Qty, 1)
		res.Items = append(res.Items, domain.WarehouseItem{
			BastionID: b.ID, Name: bastionOr(opt.ItemName, opt.Name), ItemType: bastionOr(opt.ItemType, "misc"), Rarity: bastionOr(opt.Rarity, "common"),
			Quantity: qty, ValueCP: max(opt.ValueCP, 0), Description: opt.Description, Source: source,
		})
		res.Log = append(res.Log, fmt.Sprintf("%s: %d × %s al almacén.", f.Name, qty, bastionOr(opt.ItemName, opt.Name)))
	case "gold":
		total, err := RollDice(r, opt.GoldDice)
		if err != nil {
			res.Log = append(res.Log, fmt.Sprintf("%s: la tirada de «%s» no es válida.", f.Name, opt.Name))
			return
		}
		gold := int64(total) * opt.GoldMultCP
		res.GoldCP += gold
		res.Log = append(res.Log, fmt.Sprintf("%s: «%s» deja %s (%s = %d).", f.Name, opt.Name, FormatCP(gold), opt.GoldDice, total))
	case "defender":
		n := max(opt.Defenders, 1)
		for i := 0; i < n; i++ {
			res.Defenders = append(res.Defenders, domain.BastionDefender{BastionID: b.ID, Name: fmt.Sprintf("Defensor de %s", f.Name), Source: source})
		}
		res.Log = append(res.Log, fmt.Sprintf("%s: %d defensores se unen al bastión.", f.Name, n))
	default:
		text := bastionOr(opt.Text, opt.Description)
		res.Log = append(res.Log, fmt.Sprintf("%s: «%s» completada. %s", f.Name, opt.Name, text))
	}
}

func bastionOr(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

// SalePlan is the outcome of selling warehouse goods: who buys and what it pays (§6.5).
type SalePlan struct {
	PayoutCP int64
	NPCIndex int    // index in the campaign NPC list, -1 for an anonymous buyer
	Location string // inventory | home, only for NPC buyers
}

// SalePayout is value × qty × salePct / 100 (floor).
func SalePayout(valueCP int64, qty, salePct int) int64 {
	return valueCP * int64(qty) * int64(salePct) / 100
}

// PlanSale picks the buyer at random: 85 % anonymous, 15 % a campaign NPC (uniform; skipped when
// there are none). NPC purchases land in the NPC inventory (60 %) or home (40 %).
func PlanSale(r Roller, npcCount int, valueCP int64, qty, salePct int) SalePlan {
	p := SalePlan{PayoutCP: SalePayout(valueCP, qty, salePct), NPCIndex: -1}
	if npcCount > 0 && r.Intn(100) < NPCBuyerPct {
		p.NPCIndex = r.Intn(npcCount)
		p.Location = "home"
		if r.Intn(100) < NPCInventoryP {
			p.Location = "inventory"
		}
	}
	return p
}

// ValidOrderOption finds the chosen option of a facility for an order.
func ValidOrderOption(opts []domain.BastionOption, order, optionID string) (domain.BastionOption, bool) {
	for _, o := range opts {
		if o.ID == optionID && o.Order == order {
			return o, true
		}
	}
	return domain.BastionOption{}, false
}
