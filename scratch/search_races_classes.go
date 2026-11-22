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
	err = db.QueryRow("SELECT COUNT(*) FROM srd_races WHERE LOWER(name) LIKE '%humano%'").Scan(&count)
	if err != nil {
		log.Fatalf("Query error: %v", err)
	}
	fmt.Printf("Races matching 'humano': %d\n", count)

	err = db.QueryRow("SELECT COUNT(*) FROM srd_classes WHERE LOWER(name) LIKE '%guerrero%'").Scan(&count)
	if err != nil {
		log.Fatalf("Query error: %v", err)
	}
	fmt.Printf("Classes matching 'guerrero': %d\n", count)

	fmt.Println("\nSome race names:")
	rows, _ := db.Query("SELECT name FROM srd_races ORDER BY name LIMIT 20")
	for rows.Next() {
		var name string
		rows.Scan(&name)
		fmt.Println(" -", name)
	}
	rows.Close()
}
