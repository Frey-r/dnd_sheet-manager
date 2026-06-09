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

	fmt.Println("--- DETAILED RACE DATA ---")
	row := db.QueryRow("SELECT name, speed, size, ability_bonuses, traits, languages, subraces FROM srd_races WHERE name = 'Human'")
	var name, size, abilityBonuses, traits, languages, subraces string
	var speed int
	if err := row.Scan(&name, &speed, &size, &abilityBonuses, &traits, &languages, &subraces); err != nil {
		log.Fatalf("Scan error: %v", err)
	}
	fmt.Printf("Race: %s\nSpeed: %d\nSize: %s\nAbility Bonuses: %s\nTraits: %s\nLanguages: %s\nSubraces: %s\n",
		name, speed, size, abilityBonuses, traits, languages, subraces)

	fmt.Println("\n--- DETAILED CLASS DATA ---")
	row2 := db.QueryRow("SELECT name, hit_die, primary_ability, saving_throws, armor_proficiencies, weapon_proficiencies, skill_choices, spellcasting_ability FROM srd_classes WHERE name = 'Fighter'")
	var className, primaryAbility, savingThrows, armorProf, weaponProf, skillChoices, spellcastingAbility string
	var hitDie int
	if err := row2.Scan(&className, &hitDie, &primaryAbility, &savingThrows, &armorProf, &weaponProf, &skillChoices, &spellcastingAbility); err != nil {
		log.Fatalf("Scan error: %v", err)
	}
	fmt.Printf("Class: %s\nHit Die: d%d\nPrimary: %s\nSaving Throws: %s\nArmor: %s\nWeapon: %s\nSkills: %s\nSpellcasting: %s\n",
		className, hitDie, primaryAbility, savingThrows, armorProf, weaponProf, skillChoices, spellcastingAbility)
}
