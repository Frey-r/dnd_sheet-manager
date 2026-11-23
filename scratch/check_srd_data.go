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

	fmt.Println("--- RACES ---")
	rows, err := db.Query("SELECT id, name, LEFT(description, 100) FROM srd_races ORDER BY name LIMIT 10")
	if err != nil {
		log.Fatalf("Query races error: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id int
		var name, desc string
		if err := rows.Scan(&id, &name, &desc); err != nil {
			log.Fatalf("Scan error: %v", err)
		}
		fmt.Printf("Race %d: %s - %s...\n", id, name, desc)
	}

	fmt.Println("\n--- CLASSES ---")
	rows2, err := db.Query("SELECT id, name, LEFT(description, 100) FROM srd_classes ORDER BY name LIMIT 10")
	if err != nil {
		log.Fatalf("Query classes error: %v", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var id int
		var name, desc string
		if err := rows2.Scan(&id, &name, &desc); err != nil {
			log.Fatalf("Scan error: %v", err)
		}
		fmt.Printf("Class %d: %s - %s...\n", id, name, desc)
	}
}
