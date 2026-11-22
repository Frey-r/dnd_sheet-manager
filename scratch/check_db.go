//go:build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func main() {
	dsn := "postgres://dnduser:dndsharp@localhost:5432/dndmanager?sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to open DB: %v", err)
	}
	defer db.Close()

	tables := []string{
		"srd_monsters",
		"srd_spells",
		"srd_equipment",
		"srd_magic_items",
		"srd_classes",
		"srd_class_features",
		"srd_class_spell_slots",
		"srd_races",
		"srd_conditions",
		"srd_rules",
	}

	fmt.Println("Existing Database Row Counts:")
	for _, t := range tables {
		var count int
		err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", t)).Scan(&count)
		if err != nil {
			fmt.Printf("  %s: error: %v\n", t, err)
		} else {
			fmt.Printf("  %s: %d rows\n", t, count)
		}
	}
}
