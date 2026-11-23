//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	path := filepath.Join("scratch", "dnd-data", "data", "items.json")
	f, err := os.Open(path)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	defer f.Close()

	var list []map[string]interface{}
	decoder := json.NewDecoder(f)
	err = decoder.Decode(&list)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	rarities := make(map[string]int)
	itemTypes := make(map[string]int)

	for _, item := range list {
		props, _ := item["properties"].(map[string]interface{})
		rarity := fmt.Sprintf("%v", props["Item Rarity"])
		rarities[rarity]++
		
		itemType := fmt.Sprintf("%v", props["Item Type"])
		itemTypes[itemType]++
	}

	fmt.Println("Unique Item Rarities:")
	for r, count := range rarities {
		fmt.Printf("  %s: %d\n", r, count)
	}

	fmt.Println("\nUnique Item Types (Top 20):")
	printed := 0
	for t, count := range itemTypes {
		fmt.Printf("  %s: %d\n", t, count)
		printed++
		if printed >= 20 {
			break
		}
	}
}
