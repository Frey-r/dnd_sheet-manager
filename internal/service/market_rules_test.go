package service

import "testing"

func TestWalletPay(t *testing.T) {
	cases := []struct {
		name  string
		w     Wallet
		price int64
		want  Wallet
		err   bool
	}{
		{"exact copper", Wallet{0, 0, 5}, 5, Wallet{0, 0, 0}, false},
		{"silver with change", Wallet{0, 2, 0}, 15, Wallet{0, 0, 5}, false},
		{"gold with change", Wallet{10, 0, 0}, 750, Wallet{2, 5, 0}, false},
		{"mixed coins", Wallet{1, 1, 3}, 18, Wallet{0, 9, 5}, false},
		{"insufficient", Wallet{0, 9, 9}, 100, Wallet{0, 9, 9}, true},
		{"free", Wallet{1, 0, 0}, 0, Wallet{1, 0, 0}, false},
	}
	for _, c := range cases {
		got, err := c.w.Pay(c.price)
		if (err != nil) != c.err || got != c.want {
			t.Errorf("%s: got %+v err=%v, want %+v err=%v", c.name, got, err, c.want, c.err)
		}
		if err == nil && c.w.TotalCP()-got.TotalCP() != c.price {
			t.Errorf("%s: value mismatch", c.name)
		}
	}
}

func TestWalletReceiveAndFormat(t *testing.T) {
	if got := (Wallet{1, 0, 0}).Receive(750); got != (Wallet{8, 5, 0}) {
		t.Fatalf("receive: %+v", got)
	}
	if s := FormatCP(753); s != "7 po 5 pp 3 pc" {
		t.Fatalf("format: %q", s)
	}
	if ApplyPct(1500, 50, false) != 750 || ApplyPct(1001, 110, true) != 1102 {
		t.Fatal("pct")
	}
	if !ShopBuysType(nil, "weapon") || ShopBuysType([]string{"armor"}, "weapon") || !ShopBuysType([]string{"Weapon"}, "weapon") {
		t.Fatal("buys type")
	}
}
