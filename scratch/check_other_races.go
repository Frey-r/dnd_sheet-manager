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

	rows, err := db.Query("SELECT name, ability_bonuses, traits, subraces FROM srd_races WHERE name IN ('High Elf', 'Dwarf', 'Elf', 'Hill Dwarf') OR ability_bonuses <> '{}' LIMIT 5")
	if err != nil {
		log.Fatalf("Query error: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var name, abilityBonuses, traits, subraces string
		if err := rows.Scan(&name, &abilityBonuses, &traits, &subraces); err != nil {
			log.Fatalf("Scan error: %v", err)
		}
		fmt.Printf("Race: %s\n - Ability Bonuses: %s\n - Traits: %s\n - Subraces: %s\n\n", name, abilityBonuses, traits, subraces)
	}
}
