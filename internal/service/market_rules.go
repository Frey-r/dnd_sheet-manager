package service

import (
	"errors"
	"fmt"
	"strings"
)

// Coins and prices (openspec/specs/market-bastions.md §2). Values are in copper.

var ErrInsufficientFunds = errors.New("no te alcanza el dinero")

// Wallet is a character's coins.
type Wallet struct {
	Gold, Silver, Copper int
}

// TotalCP is the wallet value in copper.
func (w Wallet) TotalCP() int64 {
	return int64(w.Gold)*100 + int64(w.Silver)*10 + int64(w.Copper)
}

// Pay spends price copper: copper first, then silver, then gold; change comes back as
// silver and copper. The wallet is unchanged when it cannot cover the price.
func (w Wallet) Pay(price int64) (Wallet, error) {
	if price <= 0 {
		return w, nil
	}
	if w.TotalCP() < price {
		return w, ErrInsufficientFunds
	}
	rem := price
	use := min(int64(w.Copper), rem)
	w.Copper -= int(use)
	rem -= use
	if rem > 0 {
		need := (rem + 9) / 10
		use = min(int64(w.Silver), need)
		w.Silver -= int(use)
		rem -= use * 10
	}
	if rem > 0 {
		need := (rem + 99) / 100
		w.Gold -= int(need)
		rem -= need * 100
	}
	change := -rem // rem <= 0 here
	w.Silver += int(change / 10)
	w.Copper += int(change % 10)
	return w, nil
}

// Receive adds amount copper in the fewest coins.
func (w Wallet) Receive(amount int64) Wallet {
	if amount <= 0 {
		return w
	}
	w.Gold += int(amount / 100)
	w.Silver += int(amount % 100 / 10)
	w.Copper += int(amount % 10)
	return w
}

// FormatCP renders copper as "7 po 5 pp" (po/pp/pc, Spanish coin names).
func FormatCP(cp int64) string {
	if cp <= 0 {
		return "0 po"
	}
	parts := []string{}
	if g := cp / 100; g > 0 {
		parts = append(parts, fmt.Sprintf("%d po", g))
	}
	if s := cp % 100 / 10; s > 0 {
		parts = append(parts, fmt.Sprintf("%d pp", s))
	}
	if c := cp % 10; c > 0 {
		parts = append(parts, fmt.Sprintf("%d pc", c))
	}
	return strings.Join(parts, " ")
}

// ApplyPct returns ceil(value × pct / 100) for prices and floor for payouts.
func ApplyPct(value int64, pct int, roundUp bool) int64 {
	n := value * int64(pct)
	if roundUp {
		return (n + 99) / 100
	}
	return n / 100
}

// ShopBuysType reports whether a shop buying `types` (empty = any) accepts itemType.
func ShopBuysType(types []string, itemType string) bool {
	if len(types) == 0 {
		return true
	}
	for _, t := range types {
		if strings.EqualFold(t, itemType) {
			return true
		}
	}
	return false
}
