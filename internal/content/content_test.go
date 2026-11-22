package content

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Regression: 5etools v2.30 magic variants carry a whole item template in "inherits";
// printing it into the name produced multi-KB identities that broke the unique index.
func TestMagicVariantNameStaysShort(t *testing.T) {
	dir := t.TempDir()
	long := strings.Repeat("lore ", 800)
	doc := `{"magicvariant":[{"name":"Moonblade","inherits":{"source":"XDMG","rarity":"legendary","entries":["` + long + `"]}}]}`
	if err := os.WriteFile(filepath.Join(dir, "magicvariants.json"), []byte(doc), 0o600); err != nil {
		t.Fatal(err)
	}
	entities, err := loadFile(dir, filepath.Join(dir, "magicvariants.json"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entities) != 1 {
		t.Fatalf("got %d entities, want 1", len(entities))
	}
	if got := entities[0].Name; got != "Moonblade [XDMG]" {
		t.Fatalf("name = %q, want %q", got, "Moonblade [XDMG]")
	}
}

func TestFlatIdentityTextBoundsNonScalars(t *testing.T) {
	cases := map[string]any{
		"scalar string": "Fighter",
		"number":        float64(3),
		"map":           map[string]any{"entries": []any{strings.Repeat("x", 5000)}},
		"list":          []any{strings.Repeat("y", 5000)},
	}
	for name, value := range cases {
		if got := flatIdentityText(value); len(got) > 64 {
			t.Errorf("%s: identity text is %d bytes, want <= 64", name, len(got))
		}
	}
	a := flatIdentityText(map[string]any{"k": "v"})
	if a != flatIdentityText(map[string]any{"k": "v"}) {
		t.Error("hash for equal maps is not stable")
	}
	if flatIdentityText(nil) != "" {
		t.Error("nil should qualify as empty")
	}
}
