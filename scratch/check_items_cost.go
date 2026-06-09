package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	path := filepath.Join("scratch", "dnd-data", "data", "classes.json")
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

	for _, c := range list {
		name := fmt.Sprintf("%v", c["name"])
		book := fmt.Sprintf("%v", c["book"])
		if name == "Wizard" && book == "Free Basic Rules (2024)" {
			props, _ := c["properties"].(map[string]interface{})
			if recs, ok := props["data-datarecords"]; ok {
				// Format and print it nicely
				var parsed []interface{}
				// Check if it's already an array or a JSON string
				if str, ok := recs.(string); ok {
					json.Unmarshal([]byte(str), &parsed)
				} else {
					bytes, _ := json.Marshal(recs)
					json.Unmarshal(bytes, &parsed)
				}
				
				fmt.Printf("=== Class %s Wizard Features ===\n", name)
				for _, r := range parsed {
					rBytes, _ := json.MarshalIndent(r, "  ", "  ")
					fmt.Println(string(rBytes))
				}
			}
		}
	}
}
