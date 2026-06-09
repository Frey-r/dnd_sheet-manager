package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "./dnd.sqlite")
	if err != nil {
		log.Fatalf("failed to open sqlite: %v", err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT name, hit_die, saving_throws, proficiencies, spellcasting_ability, features, subclasses FROM classes LIMIT 1")
	if err != nil {
		log.Fatalf("query error: %v", err)
	}
	defer rows.Close()

	if rows.Next() {
		var name, savingThrows, proficiencies string
		var spellcastingAbility, features, subclasses *string
		var hitDie int
		err := rows.Scan(&name, &hitDie, &savingThrows, &proficiencies, &spellcastingAbility, &features, &subclasses)
		if err != nil {
			log.Fatalf("scan error: %v", err)
		}

		fmt.Println("CLASS:", name)
		fmt.Println("HIT DIE:", hitDie)
		fmt.Println("SAVING THROWS:", savingThrows)
		fmt.Println("PROFICIENCIES (first 200 chars):", truncate(proficiencies, 200))
		fmt.Println("SPELLCASTING ABILITY:", deref(spellcastingAbility))
		fmt.Println("FEATURES (first 500 chars):", truncate(deref(features), 500))
		fmt.Println("SUBCLASSES:", deref(subclasses))
	}
}

func deref(sp *string) string {
	if sp == nil {
		return "NULL"
	}
	return *sp
}

func truncate(s string, limit int) string {
	if len(s) > limit {
		return s[:limit] + "..."
	}
	return s
}
