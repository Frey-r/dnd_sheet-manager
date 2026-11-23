package service

import (
	"encoding/json"
	"strings"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

// seqRoller returns scripted values (each already within [0,n)); it falls back to 0.
type seqRoller struct {
	vals []int
	i    int
}

func (s *seqRoller) Intn(n int) int {
	if s.i >= len(s.vals) {
		return 0
	}
	v := s.vals[s.i]
	s.i++
	if v >= n {
		v = n - 1
	}
	return v
}

func opt(t *testing.T, o domain.BastionOption) domain.JSONB {
	t.Helper()
	b, err := json.Marshal(o)
	if err != nil {
		t.Fatal(err)
	}
	return domain.JSONB(b)
}

func TestSpecialSlots(t *testing.T) {
	cases := []struct{ level, want int }{{1, 0}, {4, 0}, {5, 2}, {8, 2}, {9, 4}, {12, 4}, {13, 5}, {16, 5}, {17, 6}, {20, 6}}
	for _, c := range cases {
		if got := SpecialSlots(c.level); got != c.want {
			t.Errorf("level %d: got %d want %d", c.level, got, c.want)
		}
	}
}

func TestBuildSpecs(t *testing.T) {
	for _, c := range []struct {
		size string
		cp   int64
		days int
	}{{"cramped", 50000, 20}, {"roomy", 100000, 45}, {"vast", 300000, 125}} {
		s, ok := BasicBuildSpec(c.size)
		if !ok || s.CostCP != c.cp || s.Days != c.days {
			t.Errorf("%s: %+v", c.size, s)
		}
	}
	if _, ok := BasicBuildSpec("huge"); ok {
		t.Error("unknown size accepted")
	}
	enl := []struct {
		from, to string
		cp       int64
		days     int
		ok       bool
	}{{"cramped", "roomy", 50000, 25, true}, {"roomy", "vast", 200000, 80, true}, {"vast", "", 0, 0, false}}
	for _, c := range enl {
		to, s, ok := EnlargeSpec(c.from)
		if ok != c.ok || to != c.to || s.CostCP != c.cp || s.Days != c.days {
			t.Errorf("enlarge %s: %s %+v %v", c.from, to, s, ok)
		}
	}
}

func TestRollDice(t *testing.T) {
	cases := []struct {
		expr string
		vals []int
		want int
		err  bool
	}{
		{"1d6", []int{2}, 3, false},
		{"2d6", []int{0, 5}, 7, false},
		{"d20", []int{19}, 20, false},
		{"4d6", []int{5, 5, 5, 5}, 24, false},
		{"abc", nil, 0, true},
		{"0d6", nil, 0, true},
		{"2d1", nil, 0, true},
	}
	for _, c := range cases {
		got, err := RollDice(&seqRoller{vals: c.vals}, c.expr)
		if (err != nil) != c.err || (!c.err && got != c.want) {
			t.Errorf("%s: got %d err=%v", c.expr, got, err)
		}
	}
}

func TestPickEvent(t *testing.T) {
	events := []domain.BastionEvent{
		{RollMin: 1, RollMax: 50, Name: "calma"}, {RollMin: 51, RollMax: 55, Name: "ataque"}, {RollMin: 99, RollMax: 100, Name: "tesoro"},
	}
	cases := []struct {
		roll int
		want string
	}{{1, "calma"}, {50, "calma"}, {51, "ataque"}, {55, "ataque"}, {56, ""}, {100, "tesoro"}}
	for _, c := range cases {
		got := PickEvent(events, c.roll)
		name := ""
		if got != nil {
			name = got.Name
		}
		if name != c.want {
			t.Errorf("roll %d: got %q want %q", c.roll, name, c.want)
		}
	}
}

func TestAllMaintain(t *testing.T) {
	busy := opt(t, domain.BastionOption{ID: "x", Order: "craft", Turns: 1, Kind: "narrative"})
	cases := []struct {
		name string
		fs   []domain.BastionFacility
		want bool
	}{
		{"empty", nil, true},
		{"no orders", []domain.BastionFacility{{Kind: "special"}}, true},
		{"maintain", []domain.BastionFacility{{Kind: "special", OrderName: "maintain"}}, true},
		{"basic ignored", []domain.BastionFacility{{Kind: "basic", OrderName: "craft", OrderOption: busy}}, true},
		{"craft order", []domain.BastionFacility{{Kind: "special", OrderName: "maintain"}, {Kind: "special", OrderName: "craft", OrderOption: busy}}, false},
	}
	for _, c := range cases {
		if got := AllMaintain(c.fs); got != c.want {
			t.Errorf("%s: got %v", c.name, got)
		}
	}
}

func TestProcessBastionMaintainRollsEvent(t *testing.T) {
	events := []domain.BastionEvent{{RollMin: 1, RollMax: 50, Name: "Todo en calma"}, {RollMin: 51, RollMax: 100, Name: "Tesoro", RewardDice: "2d6", RewardMultCP: 100}}
	b := &domain.Bastion{ID: 1, CharacterID: 9, Facilities: []domain.BastionFacility{{ID: 3, Kind: "special", Name: "Biblioteca", OrderName: "maintain"}}}
	// event roll 80 -> index 79; reward 2d6 -> 2 and 3 (indexes 1, 2)
	res := ProcessBastion(&seqRoller{vals: []int{79, 1, 2}}, b, events, 4)
	if res.EventName != "Tesoro" || res.EventRoll != 80 || res.GoldCP != 500 || res.TurnNumber != 4 {
		t.Fatalf("unexpected result: %+v", res)
	}
	// a calm roll gives no gold
	res = ProcessBastion(&seqRoller{vals: []int{0}}, b, events, 5)
	if res.EventName != "Todo en calma" || res.GoldCP != 0 {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestProcessBastionOrders(t *testing.T) {
	cases := []struct {
		name      string
		option    domain.BastionOption
		turnsLeft int
		vals      []int
		check     func(t *testing.T, r domain.BastionTurnResult)
	}{
		{"item completes", domain.BastionOption{ID: "a", Order: "craft", Name: "Poción", Turns: 1, Kind: "item", ItemName: "Poción de curación", ItemType: "potion", Qty: 2, ValueCP: 5000}, 1, nil,
			func(t *testing.T, r domain.BastionTurnResult) {
				if len(r.Items) != 1 || r.Items[0].Quantity != 2 || r.Items[0].ValueCP != 5000 || r.Items[0].Name != "Poción de curación" {
					t.Errorf("items: %+v", r.Items)
				}
				if r.Facilities[0].OrderName != "" || r.Facilities[0].TurnsLeft != 0 {
					t.Errorf("order not cleared: %+v", r.Facilities[0])
				}
				if r.EventName != "" {
					t.Error("event rolled although an order was active")
				}
			}},
		{"gold roll", domain.BastionOption{ID: "b", Order: "trade", Name: "Comerciar", Turns: 1, Kind: "gold", GoldDice: "1d6", GoldMultCP: 3000}, 1, []int{3},
			func(t *testing.T, r domain.BastionTurnResult) {
				if r.GoldCP != 12000 {
					t.Errorf("gold: %d", r.GoldCP)
				}
			}},
		{"defenders", domain.BastionOption{ID: "c", Order: "recruit", Name: "Reclutar", Turns: 1, Kind: "defender", Defenders: 4}, 1, nil,
			func(t *testing.T, r domain.BastionTurnResult) {
				if len(r.Defenders) != 4 || r.Defenders[0].BastionID != 1 {
					t.Errorf("defenders: %+v", r.Defenders)
				}
			}},
		{"narrative", domain.BastionOption{ID: "d", Order: "research", Name: "Investigar", Turns: 1, Kind: "narrative", Text: "Un secreto."}, 1, nil,
			func(t *testing.T, r domain.BastionTurnResult) {
				if len(r.Log) != 1 || !strings.Contains(r.Log[0], "Un secreto.") {
					t.Errorf("log: %v", r.Log)
				}
			}},
		{"multi-turn progresses", domain.BastionOption{ID: "e", Order: "craft", Name: "Armadura", Turns: 3, Kind: "item", ItemName: "Armadura", Qty: 1}, 3, nil,
			func(t *testing.T, r domain.BastionTurnResult) {
				if len(r.Items) != 0 || r.Facilities[0].TurnsLeft != 2 || r.Facilities[0].OrderName != "craft" || len(r.Facilities[0].OrderOption) == 0 {
					t.Errorf("progress: %+v items=%d", r.Facilities[0], len(r.Items))
				}
			}},
		{"multi-turn finishes", domain.BastionOption{ID: "f", Order: "craft", Name: "Armadura", Turns: 3, Kind: "item", ItemName: "Armadura", Qty: 1}, 1, nil,
			func(t *testing.T, r domain.BastionTurnResult) {
				if len(r.Items) != 1 || r.Facilities[0].OrderName != "" {
					t.Errorf("finish: %+v", r)
				}
			}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			b := &domain.Bastion{ID: 1, CharacterID: 2, Facilities: []domain.BastionFacility{
				{ID: 10, Kind: "special", Name: "Taller", OrderName: c.option.Order, OrderOption: opt(t, c.option), TurnsLeft: c.turnsLeft},
			}}
			c.check(t, ProcessBastion(&seqRoller{vals: c.vals}, b, nil, 1))
		})
	}
}

func TestProcessBastionConstruction(t *testing.T) {
	b := &domain.Bastion{ID: 1, Construction: []domain.BastionConstruction{
		{ID: 1, Kind: "add", BasicKind: "kitchen", TargetSize: "cramped", DaysLeft: 20},
		{ID: 2, Kind: "enlarge", TargetSize: "roomy", DaysLeft: 7},
		{ID: 3, Kind: "add", BasicKind: "bedroom", TargetSize: "vast", DaysLeft: 3},
	}}
	res := ProcessBastion(&seqRoller{vals: []int{60}}, b, nil, 1)
	want := []domain.ConstructionUpdate{{ID: 1, DaysLeft: 13}, {ID: 2, DaysLeft: 0, Done: true}, {ID: 3, DaysLeft: 0, Done: true}}
	if len(res.Construction) != len(want) {
		t.Fatalf("got %+v", res.Construction)
	}
	for i, w := range want {
		if res.Construction[i] != w {
			t.Errorf("construction %d: got %+v want %+v", i, res.Construction[i], w)
		}
	}
}

func TestSalePayout(t *testing.T) {
	cases := []struct {
		value int64
		qty   int
		pct   int
		want  int64
	}{{5000, 1, 100, 5000}, {5000, 3, 100, 15000}, {5000, 1, 50, 2500}, {333, 1, 50, 166}, {5000, 2, 0, 0}, {1000, 1, 150, 1500}}
	for _, c := range cases {
		if got := SalePayout(c.value, c.qty, c.pct); got != c.want {
			t.Errorf("%+v: got %d", c, got)
		}
	}
}

func TestPlanSale(t *testing.T) {
	cases := []struct {
		name     string
		npcs     int
		vals     []int // buyer roll, [npc index, location roll]
		wantNPC  int
		wantLoc  string
		wantPays int64
	}{
		{"anonymous 85%", 3, []int{15}, -1, "", 5000},
		{"anonymous high roll", 3, []int{99}, -1, "", 5000},
		{"npc buyer inventory", 3, []int{14, 2, 59}, 2, "inventory", 5000},
		{"npc buyer home", 3, []int{0, 1, 60}, 1, "home", 5000},
		{"no npcs skips npc buyer", 0, []int{0}, -1, "", 5000},
	}
	for _, c := range cases {
		p := PlanSale(&seqRoller{vals: c.vals}, c.npcs, 5000, 1, 100)
		if p.NPCIndex != c.wantNPC || p.Location != c.wantLoc || p.PayoutCP != c.wantPays {
			t.Errorf("%s: %+v", c.name, p)
		}
	}
	// Payout honours the campaign setting.
	if p := PlanSale(&seqRoller{vals: []int{50}}, 2, 5000, 2, 80); p.PayoutCP != 8000 {
		t.Errorf("payout: %d", p.PayoutCP)
	}
}

func TestPlanSaleDistribution(t *testing.T) {
	r := defaultRoller{}
	npc, home := 0, 0
	const n = 20000
	for i := 0; i < n; i++ {
		p := PlanSale(r, 4, 100, 1, 100)
		if p.NPCIndex >= 0 {
			npc++
			if p.Location == "home" {
				home++
			}
		}
	}
	if share := float64(npc) / n; share < 0.12 || share > 0.18 {
		t.Errorf("npc share %.3f outside 12-18%%", share)
	}
	if share := float64(home) / float64(npc); share < 0.33 || share > 0.47 {
		t.Errorf("home share %.3f outside 33-47%%", share)
	}
}

func TestValidOrderOption(t *testing.T) {
	opts := []domain.BastionOption{{ID: "a", Order: "craft"}, {ID: "b", Order: "trade"}}
	if _, ok := ValidOrderOption(opts, "craft", "a"); !ok {
		t.Error("valid option rejected")
	}
	if _, ok := ValidOrderOption(opts, "craft", "b"); ok {
		t.Error("option of another order accepted")
	}
	if _, ok := ValidOrderOption(opts, "craft", "zzz"); ok {
		t.Error("unknown option accepted")
	}
}

func TestValidateCatalog(t *testing.T) {
	good := func() *CatalogPayload {
		return &CatalogPayload{
			Facilities: []domain.BastionCatalogEntry{{Name: "Taller", MinLevel: 5, Size: "roomy", Orders: []string{"craft"},
				Options: domain.BastionOptions{{ID: "a", Order: "craft", Name: "Algo", Turns: 1, Kind: "item"}}}},
			Events: []domain.BastionEvent{{Name: "Calma", RollMin: 1, RollMax: 100}},
		}
	}
	cases := []struct {
		name string
		mut  func(p *CatalogPayload)
		err  bool
	}{
		{"valid", func(p *CatalogPayload) {}, false},
		{"empty name", func(p *CatalogPayload) { p.Facilities[0].Name = " " }, true},
		{"bad level", func(p *CatalogPayload) { p.Facilities[0].MinLevel = 0 }, true},
		{"unknown order", func(p *CatalogPayload) { p.Facilities[0].Orders = []string{"steal"} }, true},
		{"maintain not listed", func(p *CatalogPayload) { p.Facilities[0].Orders = []string{"maintain"} }, true},
		{"option order not allowed", func(p *CatalogPayload) { p.Facilities[0].Options[0].Order = "trade" }, true},
		{"duplicate option id", func(p *CatalogPayload) {
			p.Facilities[0].Options = append(p.Facilities[0].Options, p.Facilities[0].Options[0])
		}, true},
		{"bad kind", func(p *CatalogPayload) { p.Facilities[0].Options[0].Kind = "magic" }, true},
		{"zero turns", func(p *CatalogPayload) { p.Facilities[0].Options[0].Turns = 0 }, true},
		{"gold needs dice", func(p *CatalogPayload) { p.Facilities[0].Options[0].Kind = "gold" }, true},
		{"gold with dice", func(p *CatalogPayload) {
			p.Facilities[0].Options[0].Kind, p.Facilities[0].Options[0].GoldDice = "gold", "2d6"
		}, false},
		{"event inverted range", func(p *CatalogPayload) { p.Events[0].RollMin, p.Events[0].RollMax = 60, 10 }, true},
		{"event out of range", func(p *CatalogPayload) { p.Events[0].RollMax = 101 }, true},
		{"event bad dice", func(p *CatalogPayload) { p.Events[0].RewardDice = "lots" }, true},
	}
	for _, c := range cases {
		p := good()
		c.mut(p)
		if err := ValidateCatalog(p); (err != nil) != c.err {
			t.Errorf("%s: err=%v", c.name, err)
		}
	}
}
