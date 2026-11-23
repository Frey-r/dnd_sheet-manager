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

	var count int
	db.QueryRow("SELECT COUNT(*) FROM srd_races WHERE traits <> '[]' AND traits IS NOT NULL").Scan(&count)
	fmt.Printf("Races with traits: %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM srd_races WHERE subraces <> '[]' AND subraces IS NOT NULL").Scan(&count)
	fmt.Printf("Races with subraces: %d\n", count)

	if count > 0 {
		var name, sub string
		db.QueryRow("SELECT name, subraces FROM srd_races WHERE subraces <> '[]' LIMIT 1").Scan(&name, &sub)
		fmt.Printf("Race %s has subraces: %s\n", name, sub)
	}
}
