package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	path := filepath.Join("scratch", "dnd-data", "data", "species.json")
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

	for _, s := range list {
		props, _ := s["properties"].(map[string]interface{})
		if _, ok := props["Speed"]; ok {
			s["description"] = "..."
			bytes, _ := json.MarshalIndent(s, "", "  ")
			fmt.Println(string(bytes))
		}
	}
}
