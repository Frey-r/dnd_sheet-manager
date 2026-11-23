// Command foundry-export reads the Postgres srd_* reference catalogs and writes a
// Foundry VTT MODULE (dnd5e source JSON) with compendium packs. Compile the packs
// with the official Foundry CLI and install the module so Foundry holds the data;
// thereafter Foundry is the source of truth (see openspec/specs/foundry-integration.md).
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/foundry"
	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func main() {
	out := flag.String("out", "dist/foundry-module", "output module directory")
	moduleID := flag.String("module-id", "dnd-manager-srd", "Foundry module id")
	configPath := flag.String("config", "config.yaml", "config file path")
	stamp := flag.Bool("stamp", true, "write the generated compendium UUID back into srd_*.foundry_uuid")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	db, err := sqlx.Connect("postgres", cfg.Database.DSN)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer db.Close()
	repo := repository.NewFoundryRepository(db)
	ctx := context.Background()

	ex := &exporter{outDir: *out, moduleID: *moduleID, repo: repo, ctx: ctx, stamp: *stamp}

	// pack name -> document type (for the compendium UUID and module.json).
	// Classes/subclasses/races are intentionally NOT exported here: dnd5e class
	// machinery (advancement, features) is not reconstructable from the flat srd_*
	// schema. Use Plutonium to import those from 5etools (see FOUNDRY_PLUTONIUM.md).
	packs := []packDef{
		{"spells", "Item", "Spells"},
		{"monsters", "Actor", "Monsters"},
		{"items", "Item", "Items"},
	}

	// Spells
	spells, err := repo.AllSpells(ctx)
	must(err, "spells")
	for _, s := range spells {
		ex.write("spells", "Item", "srd_spells", s.ID, foundry.BuildSpellDoc(s))
	}
	// Monsters
	monsters, err := repo.AllMonsters(ctx)
	must(err, "monsters")
	for _, m := range monsters {
		ex.write("monsters", "Actor", "srd_monsters", m.ID, foundry.BuildMonsterDoc(m))
	}
	// Equipment + magic items -> items pack
	equip, err := repo.AllEquipment(ctx)
	must(err, "equipment")
	for _, e := range equip {
		ex.write("items", "Item", "srd_equipment", e.ID, foundry.BuildEquipmentDoc(e))
	}
	magic, err := repo.AllMagicItems(ctx)
	must(err, "magic items")
	for _, mi := range magic {
		ex.write("items", "Item", "srd_magic_items", mi.ID, foundry.BuildMagicItemDoc(mi))
	}
	// Classes / subclasses / races are handled by Plutonium (see FOUNDRY_PLUTONIUM.md),
	// not exported here.

	if err := ex.writeModuleJSON(packs); err != nil {
		log.Fatalf("module.json: %v", err)
	}

	log.Printf("exported %d documents to %s", ex.count, *out)
	log.Printf("next: compile packs, e.g.")
	for _, p := range packs {
		log.Printf("  npx @foundryvtt/foundryvtt-cli package pack -n %s --in %s --out %s",
			p.name,
			filepath.ToSlash(filepath.Join(*out, "packs", "_source", p.name)),
			filepath.ToSlash(filepath.Join(*out, "packs", p.name)))
	}
}

type packDef struct{ name, docType, label string }

type exporter struct {
	outDir   string
	moduleID string
	repo     *repository.FoundryRepository
	ctx      context.Context
	stamp    bool
	count    int
	seen     map[string]bool
}

func (e *exporter) write(pack, docType, table string, rowID int64, doc foundry.Doc) {
	if e.seen == nil {
		e.seen = map[string]bool{}
	}
	dir := filepath.Join(e.outDir, "packs", "_source", pack)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Fatalf("mkdir %s: %v", dir, err)
	}
	fname := foundry.Slug(doc.Name)
	if fname == "" {
		fname = doc.ID
	}
	key := pack + "/" + fname
	if e.seen[key] {
		fname = fname + "-" + doc.ID[:6]
	}
	e.seen[pack+"/"+fname] = true

	// The Foundry CLI requires a _key (!collection!id) to pack a document into a
	// ClassicLevel compendium; without it the pack is silently empty.
	collection := "items"
	if docType == "Actor" {
		collection = "actors"
	}
	doc.Body["_key"] = "!" + collection + "!" + doc.ID

	data, err := json.MarshalIndent(doc.Body, "", "  ")
	if err != nil {
		log.Fatalf("marshal %s: %v", doc.Name, err)
	}
	if err := os.WriteFile(filepath.Join(dir, fname+".json"), data, 0o644); err != nil {
		log.Fatalf("write %s: %v", fname, err)
	}
	e.count++

	if e.stamp {
		uuid := fmt.Sprintf("Compendium.%s.%s.%s.%s", e.moduleID, pack, docType, doc.ID)
		if err := e.repo.SetSRDFoundryUUID(e.ctx, table, rowID, uuid); err != nil {
			log.Printf("warn: stamp %s#%d: %v", table, rowID, err)
		}
	}
}

func (e *exporter) writeModuleJSON(packs []packDef) error {
	type packEntry struct {
		Name   string `json:"name"`
		Label  string `json:"label"`
		Path   string `json:"path"`
		Type   string `json:"type"`
		System string `json:"system"`
	}
	var entries []packEntry
	for _, p := range packs {
		entries = append(entries, packEntry{
			Name:   p.name,
			Label:  "DM SRD " + p.label,
			Path:   "packs/" + p.name,
			Type:   p.docType,
			System: "dnd5e",
		})
	}
	module := map[string]interface{}{
		"id":          e.moduleID,
		"title":       "DnD Manager SRD",
		"description": "Reference catalogs (monsters, spells, items, classes, subclasses, races) exported from dnd-campaign-manager.",
		"version":     "1.0.0",
		"compatibility": map[string]interface{}{
			"minimum": "11", "verified": "12",
		},
		"relationships": map[string]interface{}{
			"systems": []map[string]interface{}{{"id": "dnd5e", "type": "system"}},
		},
		"packs": entries,
	}
	if err := os.MkdirAll(e.outDir, 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(module, "", "  ")
	return os.WriteFile(filepath.Join(e.outDir, "module.json"), data, 0o644)
}

func must(err error, what string) {
	if err != nil {
		log.Fatalf("read %s: %v", what, err)
	}
}
