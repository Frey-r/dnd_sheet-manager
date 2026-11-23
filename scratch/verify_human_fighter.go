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
	err = db.QueryRow("SELECT COUNT(*) FROM srd_races WHERE name = 'Human'").Scan(&count)
	fmt.Printf("Race 'Human': %d\n", count)

	err = db.QueryRow("SELECT COUNT(*) FROM srd_classes WHERE name = 'Fighter'").Scan(&count)
	fmt.Printf("Class 'Fighter': %d\n", count)
}
