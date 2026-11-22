# Character Appearance (pixel-art avatar)

Every player character **SHALL** have a pixel-art avatar in the style of a **hand-made RPG character sprite**: a three-quarter view, a dynamic pose, a large head with a huge stylised hair mass, a slim body, hue-shifted cel shading and selective outlines. Avatars are drawn by code from hand-written pixel templates (one character per pixel, tone letters mapped to colour ramps); the app ships no image assets for them.

## Art direction

The reference is a 55 × 50 hand-drawn sprite (silver-haired mage with a crescent staff and a golden energy wing). The avatar **SHALL** read as the same style when the two are shown side by side at the same scale.

- **Grid:** **48 × 56** pixels, feet resting on row 53. The sprite is **not** symmetric: three-quarter view, the face turned towards the viewer's right. The free border (at least 2 px) holds the outline and the class aura.
- **Pose:** weight on the near leg (viewer's left, straight), the far leg stepping out, so the feet are apart. The near arm hangs out and away from the body with an open hand at hip height; the far arm is bent with the hand raised to shoulder height, holding the class prop. The pose is the same for every outfit and race.
- **Proportions (medium body):** head with hair about 40–45 % of the height (hair about 30 px wide and 23 px tall, face about 12 px wide). Torso and limbs are **slim**: torso about 13 px wide at the shoulders, arms 3 px, legs 3–4 px, hands 2–3 px, feet 3–4 px. Small, stocky and large bodies are derived from the medium body by repeating or removing whole rows and columns at fixed seams (mid torso, mid legs, torso middle column), so every outfit fits every size; the head never changes size.
- **Face:** young adult, seen in three-quarter view: the face plane sits on the right of the head (the back of the skull, on the left, is under the hair), straight cheek on the near side, a jaw that tapers to a **narrow pointed chin** right of centre. **Small eyes placed low** (in the lower half of the head with hair): the near eye 4 × 4 (dark lash on top, longer at the outer corner, iris dark to light in the eye colour, a white highlight pixel), the far eye 3 px wide and closer to the edge of the face. Nose one shadow pixel, mouth 2 px, a light blush. Glowing eyes (`glow-eyes`) use the light end of the ramp. Non-human heads (beast snout, beak, reptile snout, elephant, insect, skull, fish, frog, ooze) keep their own three-quarter silhouettes with the snout or beak pointing right and the same eye scale.
- **Hair:** the largest shape of the sprite. A mass of **clustered, spiky locks** that grow beyond the skull on every side, fall over the forehead and both sides of the face and stick out of the silhouette; locks are grouped in clusters with 4 tones (light, base, shadow, deep) and **bright rim highlights** (1–2 px streaks on the lit top-left edge of each cluster). Never a smooth cap. Split into a back layer (behind the body) and a front layer (over the face).
- **Shading:** every material uses a ramp (highlight, light, base, shadow, deep) **hue-shifted**: shadows cooler and more saturated, highlights warmer. Light comes from the top left. Cloth shows folds with 3 tones; trims, buckles and clasps are gold.
- **Outline (selective):** only the outer silhouette gets a 1-px outline, in a dark tint of the neighbouring material (dark slate around grey hair, brown around skin, near black around dark cloth). Inside the sprite, shapes are separated by colour or by shadow tones, never by black lines (only lashes and pupils are near black).
- **Flowing elements:** every outfit has a flowing element in its second colour (scarf, cape, sash or ribbons) that extends beyond the body silhouette to the viewer's left.
- **Held prop:** derived from the class, like the aura: staff (wizard, sorcerer, warlock, druid, unknown spellcasters), sword (fighter, paladin, blood hunter), axe (barbarian), bow (ranger), dagger (rogue), mace (cleric), lute (bard), hammer (artificer), none for monks and characters without a class (the raised hand stays open). Staves carry an orb in the class colour. The prop is drawn only in the full sprite, never in the head crop.
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
- **Backward compatibility:** appearances saved before the chibi redesign (hair 0–8, outfit 0–7) and before the three-quarter redesign (hair 0–11, outfit 0–9) keep `v: 1` and their ids keep their meaning: each id maps to the redrawn style of the same name, so no stored data changes.
- The server **SHALL** reject an appearance with unknown keys, `v` other than 1, indices out of range, malformed colours, or more than 1 KB.
- The visual family is **not** stored: it **SHALL** be derived from the character's `race` every time it is drawn. A stored `feature` or `skin` that does not fit the race **SHALL** be clamped or replaced by the race default when drawn.
- A character with no appearance **SHALL** be drawn with the default look of its race.

## Race families

- Catalogue races **SHALL** be grouped by **base race** (the catalogue name without its trailing source, e.g. `"Elf (Player's Handbook (2024))"` → `Elf`). The race picker **SHALL** show one entry per base race, then let the player choose the specific catalogue entry (book or variant).
- Each base race **SHALL** map to a visual definition: size (small, stocky, medium, large), head type (humanoid, beast snout, beak, reptile, elephant, insect, skull, fish, frog, ooze), a skin palette and two to four named race options. Race parts (pointed or animal ears, horns, tusks and fangs, tails, wings, beards, crests, fins, elemental hair, halos, marks…) are drawn for the three-quarter view (near-side ear at the left edge of the face, far-side parts smaller or partly hidden). Matching **SHALL** work on English and Spanish names; unknown or homebrew races **SHALL** fall back to a humanoid of the catalogue size.

## Class aura

- The class **SHALL NOT** change clothing. Each class **SHALL** have a colour, and the avatar **SHALL** show a 1–2 pixel aura of that colour around its silhouette. Unknown classes get a colour derived from their name.
- The class also chooses the held prop of the full sprite (see "Held prop"); a homebrew class with no match holds nothing.

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
