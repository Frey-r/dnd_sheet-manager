package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/content"
	"dnd-campaign-manager/migrations"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func main() {
	root := flag.String("dir", "", "path to the local 5etools data directory")
	configPath := flag.String("config", getenv("CONFIG_PATH", "config.yaml"), "application configuration file")
	dryRun := flag.Bool("dry-run", false, "parse and validate without writing to PostgreSQL")
	flag.Parse()
	if *root == "" {
		log.Fatal("the -dir flag is required; content is never downloaded automatically")
	}
	started := time.Now()
	loaded, err := content.Load(*root)
	if err != nil {
		log.Fatalf("load content: %v", err)
	}
	printInventory(loaded)
	if *dryRun {
		log.Printf("validated %d entities in %s; database unchanged", len(loaded.Entities), time.Since(started).Round(time.Millisecond))
		return
	}
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	db, err := sqlx.Connect("postgres", cfg.Database.DSN)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer db.Close()
	if err := migrations.Up(context.Background(), db.DB); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	summary, err := content.Import(context.Background(), db.DB, *root, loaded)
	if err != nil {
		log.Fatalf("import content: %v", err)
	}
	encoded, _ := json.MarshalIndent(summary, "", "  ")
	fmt.Println(string(encoded))
	log.Printf("import completed in %s", time.Since(started).Round(time.Millisecond))
}

func printInventory(loaded *content.LoadResult) {
	keys := make([]string, 0, len(loaded.Counts))
	for key := range loaded.Counts {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		fmt.Printf("%-28s %d\n", key, loaded.Counts[key])
	}
	if len(loaded.Warnings) > 0 {
		log.Printf("copy resolution warnings: %d", len(loaded.Warnings))
		for _, warning := range loaded.Warnings[:min(10, len(loaded.Warnings))] {
			log.Printf("warning: %s", warning)
		}
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
