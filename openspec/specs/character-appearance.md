# Character Appearance (pixel-art avatar)

Every player character **SHALL** have a pixel-art avatar in the style of a 2D side-scrolling sandbox game (small sprite, hard pixels, flat colours with one shade). Avatars are drawn by code from layered sprite masks; the app ships no image assets for them.

## Data model

- `characters.appearance` (JSONB, nullable) **SHALL** hold:

  ```json
  { "v": 1, "body": 0, "skin": "#c68642", "eyes": "#3b6ea5",
    "hair": 3, "hairColor": "#2b1a10",
    "outfit": 5, "outfitColors": ["#7a2e2e", "#d9b26f"],
    "feature": 1 }
  ```

  - `body`: 0 or 1, the two silhouettes (A and B).
  - `hair`: 0–8. 0 is bald; 1–4 are set A styles and 5–8 are set B styles. **Any body SHALL be able to use any hair style.**
  - `outfit`: 0–7. Eight preset outfits: four set A and four set B, each a distinct design (set B is not a recolour of set A). **Any body SHALL be able to use any outfit.** Each outfit has a primary and a secondary colour.
  - `feature`: 0–3, the race-specific option (ear shape, horn shape, crest, element…). Its meaning depends on the race.
  - Colours **SHALL** be `#rrggbb`.
- The server **SHALL** reject an appearance with unknown keys, `v` other than 1, indices out of range, malformed colours, or more than 1 KB.
- The visual family is **not** stored: it **SHALL** be derived from the character's `race` every time it is drawn. A stored `feature` or `skin` that does not fit the race **SHALL** be clamped or replaced by the race default when drawn.
- A character with no appearance **SHALL** be drawn with the default look of its race.

## Race families

- Catalogue races **SHALL** be grouped by **base race** (the catalogue name without its trailing source, e.g. `"Elf (Player's Handbook (2024))"` → `Elf`). The race picker **SHALL** show one entry per base race, then let the player choose the specific catalogue entry (book or variant).
- Each base race **SHALL** map to a visual definition: size (small, medium, large), head type (humanoid, beast snout, beak, reptile, elephant, insect, skull, ooze), a skin palette and two to four named race options. Matching **SHALL** work on English and Spanish names; unknown or homebrew races **SHALL** fall back to a humanoid of the catalogue size.

## Class aura

- The class **SHALL NOT** change clothing. Each class **SHALL** have a colour, and the avatar **SHALL** show a 1–2 pixel aura of that colour around its silhouette. Unknown classes get a colour derived from their name.

## Where the avatar appears

- Character creation (large, centre stage), the character sheet portrait, party roster and campaign hub cards (bust crop), and VTT tokens linked to a character (bust crop inside the token circle, ring in the class colour, drawn without smoothing).
- The owner or the campaign GM **MAY** change the appearance later: `PUT /api/characters/:id/appearance` with the appearance JSON. Others get 403.

## Creation wizard

Character creation **SHALL** be a step-by-step wizard with the avatar always visible:
1. Race: base race grid with thumbnails and search, then the catalogue entry and its traits.
2. Appearance: body, skin, eyes, hair style and colour, outfit and its two colours, race option; a random button.
3. Class: class grid with each class colour; choosing one sets the aura.
4. Ability scores (see `characters.md`).
5. Details: name, background, alignment, summary, create.

```gherkin
GIVEN a player in the appearance step with a Tiefling
WHEN they choose outfit 6 (set B) on body A and hair style 2
THEN the avatar SHALL show that outfit and hair on body A
AND the race option SHALL offer the Tiefling horn shapes
```

```gherkin
GIVEN a created character with an appearance
WHEN the owner sends PUT /api/characters/:id/appearance with "hair": 12
THEN the server SHALL answer 400 and keep the previous appearance
WHEN another player who is not the GM sends a valid appearance
THEN the server SHALL answer 403
```

```gherkin
GIVEN a character created before avatars existed (appearance null)
WHEN its sheet is opened
THEN the avatar SHALL be drawn with the default look of its race
```
