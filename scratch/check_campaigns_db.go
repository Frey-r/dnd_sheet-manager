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

	rows, err := db.Query("SELECT id, name, join_code, gm_user_id, status FROM campaigns")
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	defer rows.Close()

	fmt.Println("Campaigns in DB:")
	for rows.Next() {
		var id int64
		var name, joinCode, status string
		var gmUserID int64
		if err := rows.Scan(&id, &name, &joinCode, &gmUserID, &status); err != nil {
			log.Fatalf("Scan failed: %v", err)
		}
		fmt.Printf("ID: %d | Name: %s | JoinCode: %s | GMUserID: %d | Status: %s\n", id, name, joinCode, gmUserID, status)
	}
}
