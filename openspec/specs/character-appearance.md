# Character Appearance (pixel-art avatar)

Every player character **SHALL** have a pixel-art avatar in a **chibi** style: a big head, large expressive eyes, a small body with short legs, a dark one-pixel outline and cel shading. Avatars are drawn by code from layered pixel layers (shapes and hand-written pixel templates); the app ships no image assets for them.

## Art direction

- **Grid:** the sprite is drawn on a **48 × 56** pixel grid, facing the viewer, symmetric around the vertical axis between columns 23 and 24, feet resting on row 52. The free border (at least 3 px) holds the outline and the class aura.
- **Proportions (medium body):** the head, hair included, **SHALL** take 45–50 % of the character height (head 20 px wide, about 23 px tall with hair); torso about 12 px, legs about 11 px. Small bodies keep the same head and shorten torso and legs; stocky (dwarf) bodies are wider and short; large bodies are wider and taller. Heads are the same size for every body so hair and race parts fit all of them.
- **Face:** big, shiny anime-style eyes, 5 px wide × 6 px tall (columns 16–20 and 27–31, from the frame's eye row down): a dark upper lash two pixels thick at the outer corner (body B adds an outward flick), a white sliver on the outer side, an iris in the eye colour that goes from dark at the top to light at the bottom, a 2-px white highlight at its top left and a 1-px highlight at its bottom right. Highlights are on the same side of both eyes (light from the top left); only lash and white are mirrored. Glowing eyes (`glow-eyes`) use the light end of the ramp. Small mouth and blush sit right under the eyes. Non-human heads (snout, beak, reptile, elephant, insect, skull, fish, frog, ooze) replace the lower face or the whole head and keep eyes of the same scale with the same two highlights: slit pupils for reptiles, faceted eyes for insects, round side eyes for fish, eyes on top bumps for frogs, round dark sockets (a glowing pinpoint with `glow-eyes`) for skulls, one centred 6 × 7 eye for cyclopes; the warforged visor covers all six eye rows with a glowing band in the eye colour. Face marks (freckles, tattoo, mark, whiskers) sit on the cheeks below the eyes, never over them. Eyes must stay fully visible in the 24 × 24 head crop.
- **Shading:** every material (skin, hair, each outfit colour, leather, metal) **SHALL** use a ramp of up to five tones derived from its base colour (highlight, light, base, shadow, deep shadow); shadows shift towards cool hues and highlights towards warm hues. Light comes from the top left: left and top edges lighter, right and bottom edges darker.
- **Outline:** a one-pixel outline is drawn around the silhouette in a dark tint of the neighbouring colour; internal contour lines separate hair from face, arms from torso and the locks of hair.
- **Hair:** stylised with volume above the skull, locks ending in points, dark strand lines between locks and a highlight streak on the crown. Hair is split into a back layer (behind the body) and a front layer (crown, bangs, side locks).
- **Rendering:** the canvas is shown with `image-rendering: pixelated`; fixed-size spots use integer CSS scales where the layout allows it.

## Data model

- `characters.appearance` (JSONB, nullable) **SHALL** hold:

  ```json
  { "v": 1, "body": 0, "skin": "#c68642", "eyes": "#3b6ea5",
    "hair": 3, "hairColor": "#2b1a10",
    "outfit": 5, "outfitColors": ["#7a2e2e", "#d9b26f"],
    "feature": 1 }
  ```

  - `body`: 0 or 1, the two silhouettes (A broader shoulders, B slimmer waist).
  - `hair`: 0–11. **Any body SHALL be able to use any hair style.**

    | id | style | id | style |
    |----|-------|----|-------|
    | 0 | Calvo (bald) | 6 | Trenza (side braid) |
    | 1 | Corto (short, tousled) | 7 | Moño (top bun) |
    | 2 | Puntas (spiky) | 8 | Melena (wild mane) |
    | 3 | Coleta (ponytail) | 9 | Media melena (bob with bangs) |
    | 4 | Cresta (mohawk) | 10 | Dos coletas (twin tails) |
    | 5 | Largo (long, straight) | 11 | Ondas (long, wavy, side parting) |

  - `outfit`: 0–9. **Any body SHALL be able to use any outfit.** Each outfit has a primary and a secondary colour.

    | id | outfit | id | outfit |
    |----|--------|----|--------|
    | 0 | Túnica (belted tunic) | 5 | Corsé y falda |
    | 1 | Jubón (doublet) | 6 | Blusa y pantalón |
    | 2 | Camisa y chaleco | 7 | Capa corta (flowing cape) |
    | 3 | Abrigo largo | 8 | Armadura ligera (light armour) |
    | 4 | Vestido | 9 | Túnica de mago (robe) |

  - `feature`: 0–3, the race-specific option (ear shape, horn shape, crest, element…). Its meaning depends on the race.
  - Colours **SHALL** be `#rrggbb`.
- **Backward compatibility:** appearances saved before the chibi redesign (hair 0–8, outfit 0–7) keep `v: 1` and their ids keep their meaning: each old id maps to the redrawn style of the same name, so no stored data changes. Ids 9–11 (hair) and 8–9 (outfit) are new.
- The server **SHALL** reject an appearance with unknown keys, `v` other than 1, indices out of range, malformed colours, or more than 1 KB.
- The visual family is **not** stored: it **SHALL** be derived from the character's `race` every time it is drawn. A stored `feature` or `skin` that does not fit the race **SHALL** be clamped or replaced by the race default when drawn.
- A character with no appearance **SHALL** be drawn with the default look of its race.

## Race families

- Catalogue races **SHALL** be grouped by **base race** (the catalogue name without its trailing source, e.g. `"Elf (Player's Handbook (2024))"` → `Elf`). The race picker **SHALL** show one entry per base race, then let the player choose the specific catalogue entry (book or variant).
- Each base race **SHALL** map to a visual definition: size (small, stocky, medium, large), head type (humanoid, beast snout, beak, reptile, elephant, insect, skull, fish, frog, ooze), a skin palette and two to four named race options. Race parts (pointed or animal ears, horns, tusks and fangs, tails, wings, beards, crests, fins, elemental hair, halos, marks…) are drawn for the front view. Matching **SHALL** work on English and Spanish names; unknown or homebrew races **SHALL** fall back to a humanoid of the catalogue size.

## Class aura

- The class **SHALL NOT** change clothing. Each class **SHALL** have a colour, and the avatar **SHALL** show a 1–2 pixel aura of that colour around its silhouette. Unknown classes get a colour derived from their name.

## Where the avatar appears

- Character creation (large, centre stage), the character sheet portrait, party roster and campaign hub cards (head crop), and VTT tokens linked to a character (head crop inside the token circle, ring in the class colour, drawn without smoothing).
- The head crop is a 24 × 24 square around the face and hair, so the fixed-size spots that show it keep their size.
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
WHEN they choose outfit 6 on body A and hair style 2
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

```gherkin
GIVEN a character saved before the chibi redesign with "hair": 8 and "outfit": 7
WHEN its sheet is opened
THEN the avatar SHALL be drawn with the redrawn "Melena" hair and "Capa corta" outfit
AND the stored appearance SHALL NOT change
```
