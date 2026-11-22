# Character Appearance (pixel-art avatar)

Every player character **SHALL** have a pixel-art avatar in the style of the **sprites of HD-2D tactics and JRPG games** (the user's references are *Octopath Traveler* and *Triangle Strategy*): a **chibi (super-deformed) figure about 2.5 heads tall**, as in both references (big head, compact torso, short legs), a calm idle stance in front three-quarter view, a small simple face, chunky hair clusters, detailed layered clothing, rich hue-shifted shading and a complete dark outline. Avatars are drawn by code from hand-written pixel templates (one character per pixel, tone letters mapped to colour ramps); the app ships no image assets for them.

## Art direction

Only the **style** of the references is taken (grid, figure, proportions, face construction and rendering technique). No character, costume or pixel of those games **SHALL** be copied, and the reference images stay outside the repository (`sprites ideas/` is excluded from git).

- **Grid:** the canvas stays **48 × 56** for every consumer. The figure of the medium body (without prop or aura) **SHALL** measure about **24–34 × 44–50** pixels, feet resting on row 53, centred horizontally. The free border holds the outline, the aura and the held prop.
- **Figure and proportions:** chibi (super-deformed) like both references, about **2.5 heads tall**: head with hair **16–19 px** tall (aim for 18–19), 33–42 % of the figure height (aim for 38–42 %); a compact torso and **short legs**: shoulder to belt about 10 rows, hip to sole about 11–12 rows and belt to sole at most 15 rows (sturdy boots 5–6 px wide, 4–5 rows); shirts and tunics fall 1–2 rows past the belt so trousers never show a long leg; head with hair 14–18 px wide; face plane **8–11 px** wide. Shoulders 13–16 px wide (more with pauldrons), a solid torso and hips (never stick limbs); arms 3–4 px; hands 2–3 px blocks of skin near the hips; legs 5 px (the far one 4–5) with a 1–2 px gap, thigh wider than the ankle; boots dark and planted. Small, stocky and large bodies are derived from the medium body by repeating or removing whole rows and columns at fixed seams, so every outfit fits every size; the head never changes size.
- **Pose:** a calm idle stance in **front three-quarter view**: body and face turned slightly towards the viewer's left, both feet on the ground slightly apart, arms hanging at the sides with the hands near the hips. The near hand (viewer's right) holds the class prop at the side. The pose is the same for every outfit and race.
- **Face:** the face of the references (not big anime eyes): small and simple. The face plane shows on the left two thirds of the head, framed by the hair (bangs over the forehead, locks down the sides). **Eyes are 1–2 px wide and 2–3 px tall** (a near-black lash or pupil and the iris colour, at most one highlight pixel); **both eyes use the same design** (2 × 3: dark lash on top, iris, one highlight pixel), the far eye is not drawn narrower; about 2–4 px apart, in the lower half of the head. Optional 1-px nose shadow and a 1–2 px mouth in a darker skin tone. A soft chin that narrows over the last two rows. No large anime eyes and no blush blobs. Glowing eyes (`glow-eyes`) use the light end of the ramp. Non-human heads (beast snout, beak, reptile snout, elephant, insect, skull, fish, frog, ooze) keep their own silhouettes at this scale with the same eye size.
- **Hair:** chunky clusters of 3–5 px locks with 4 tones (highlight, light, base, shadow) and a **highlight band** of short 1-px streaks on the lit top-left of the crown. The silhouette is broken by a few locks but sized to the head: at most 3 px beyond the skull on each side, except long styles, which fall down the back and over the shoulders. Never a smooth cap and never a mass bigger than the head. Split into a back layer (behind the body) and a front layer (over the face).
- **Shading:** every material uses a 4–5 tone ramp, **hue-shifted** (shadows cooler and more saturated, highlights warmer), light from the top left. Clean clusters: no isolated noise pixels, no pillow shading, no dithering. Clothing has folds and **detail**: gold or metal trims, belts, buckles, clasps and layered garments (tabard over tunic, coat over shirt, cloak over armour).
- **Outline:** a **complete 1-px dark outline** around the whole silhouette (near-black warm brown or a very dark tint of the adjacent material, luminance at most 25 %), plus internal contour lines in the darkest tone of each material where shapes overlap (arm over torso, hair over face, belt over tunic). Lashes and pupils are near black.
- **Palette:** at most **40 distinct colours** per sprite, aura excluded; colours rich but slightly desaturated, as in the references.
- **Held prop:** derived from the class, like the aura: staff (wizard, sorcerer, warlock, druid, unknown spellcasters), sword (fighter, paladin, blood hunter), axe (barbarian), bow (ranger), dagger (rogue), mace (cleric), lute (bard), hammer (artificer), none for monks and characters without a class. It is held in the near hand at the side: upright (staff, mace, hammer, bow) or lowered (sword, axe, dagger); the lute is slung on the back. Staves carry an orb in the class colour. The prop is drawn only in the full sprite, never in the head crop.
- **Capes and robes** hang behind or around the body in the outfit's second colour; nothing has to fly sideways.
- **Metrics:** `spriteMetrics(appearance, visual)` **SHALL** return the figure, head, face and eye boxes of a rendered sprite, so the proportions above are checked by tests.
- **Rendering:** the canvas is shown with `image-rendering: pixelated`; fixed-size spots use integer CSS scales where the layout allows it.
- **Review:** the art is accepted only when a preview sheet (`node frontend/scripts/avatar-sheet.mjs`) placed next to the references at the same pixel scale reads as the same style (grid, figure, proportions, face).

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
- **Backward compatibility:** appearances saved before the chibi redesign (hair 0–8, outfit 0–7) and before the three-quarter and HD-2D redesigns (hair 0–11, outfit 0–9) keep `v: 1` and their ids keep their meaning: each id maps to the redrawn style of the same name, so no stored data changes.
- The server **SHALL** reject an appearance with unknown keys, `v` other than 1, indices out of range, malformed colours, or more than 1 KB.
- The visual family is **not** stored: it **SHALL** be derived from the character's `race` every time it is drawn. A stored `feature` that does not fit the race **SHALL** be clamped when drawn. Any valid skin colour **SHALL** be drawn as stored, even outside the race palette (the palette is a suggestion and the custom colour picker is honoured); only changing the race in the creator resets the skin to the new family default.
- A character with no appearance **SHALL** be drawn with the default look of its race.

## Race families

- Catalogue races **SHALL** be grouped by **base race** (the catalogue name without its trailing source, e.g. `"Elf (Player's Handbook (2024))"` → `Elf`). The race picker **SHALL** show one entry per base race, then let the player choose the specific catalogue entry (book or variant).
- Each base race **SHALL** map to a visual definition: size (small, stocky, medium, large), head type (humanoid, beast snout, beak, reptile, elephant, insect, skull, fish, frog, ooze), a skin palette and two to four named race options. Race parts (pointed or animal ears, horns, tusks and fangs, tails, wings, beards, crests, fins, elemental hair, halos, marks…) are drawn for the front three-quarter view facing the viewer's left and anchored to the head frame and the canonical body, never to absolute coordinates: snouts, beaks and trunks point left from the lower face; the visible (near-side) ear sits at the right edge of the face on the eye row; horns grow from the temples outside the hair and sweep back (right); tails and wings come out from behind on the right; far-side parts are smaller or partly hidden; no part floats detached from the silhouette. Matching **SHALL** work on English and Spanish names; unknown or homebrew races **SHALL** fall back to a humanoid of the catalogue size.

## Class aura

- The class **SHALL NOT** change clothing. Each class **SHALL** have a colour, and the avatar **SHALL** show a 1–2 pixel aura of that colour around its silhouette. Unknown classes get a colour derived from their name.
- The class also chooses the held prop of the full sprite (see "Held prop"); a homebrew class with no match holds nothing.

## Where the avatar appears

- Character creation (large, centre stage), the character sheet portrait, party roster and campaign hub cards (head crop), and VTT tokens linked to a character (head crop inside the token circle, ring in the class colour, drawn without smoothing).
- The head crop is a 24 × 24 square around the face and hair, so the fixed-size spots that show it keep their size.
- The owner or the campaign GM **MAY** change the appearance later: `PUT /api/characters/:id/appearance` with the appearance JSON. Others get 403.

## Creation wizard (World of Warcraft layout)

Character creation **SHALL** follow the layout of the *World of Warcraft* character creator: the avatar centre stage, the choices around it and a bottom action bar. The avatar **SHALL** stay visible and mounted on every step.

1. **Origen** (race and class), three columns on desktop:
   - **Left:** the **body type** toggle (two buttons: Complexión ancha, Complexión esbelta) on top, then the **race selector**: a grid of square race portrait tiles (head crop of a stable look per base race: the family default skin and race option, with hair style, hair colour and outfit colour picked deterministically from the race name, drawn with the body type chosen in the toggle; name under the tile), common races first (`COMMON_RACES`), then the rest alphabetically, with search. When the chosen race has several catalogue entries, a version or book select appears under the grid.
   - **Centre:** the **stage**: the full avatar large (integer scale of at least 5 on desktop) on a lit pedestal and backdrop, with the race and class names above it. The class aura pulses.
   - **Right:** the **class selector**: a grid of class tiles, each with a pixel emblem of the class prop in the class colour and the name. Choosing one sets the aura and the held prop.
   - Race traits and class details **SHALL** be readable from this screen (collapsible cards under each column or an info drawer).
2. **Personalización**: the avatar stays centre stage. A **customization panel** on the left lists every option as a row with its label and **◀ current value ▶**: Tipo de cuerpo, Piel, Ojos, Peinado, Color de pelo (or the race accent), Rasgo racial (when the race has more than one option), Atuendo, Color principal and Color secundario. Colour rows show the current swatch and open a swatch grid (with the custom colour picker); ◀ ▶ also cycle through the swatches. An **Aleatorio** button randomises the look. The right side shows the head crop as it will appear on tokens and cards.
3. **Características**: ability scores (see `characters.md`) with the avatar still on stage.
4. **Detalles**: the **name** input centred under the stage, as in WoW, then background, alignment, the HP and AC preview, and **Crear personaje**.

- A bottom **action bar** is always visible: **Atrás** on the left, the step indicator in the middle and the primary action on the right (**Personalizar**, **Siguiente**, **Crear personaje**). A step is reachable only when the previous steps are valid.
- When the creator area is narrower than 880 px (container query, so a collapsed sidebar counts) the stage comes first, then the left and right panels stacked, with the bottom action bar kept.
- The appearance editor page (`/campaign/:id/character/:cid/appearance`) **SHALL** reuse the customization screen (stage, panel and head-crop preview).

```gherkin
GIVEN a player opening character creation
THEN the race selector SHALL be left of the stage, the class selector right of it
AND the body type toggle SHALL be above the race selector
WHEN they choose Elf and Wizard
THEN the stage SHALL show the elf with the wizard aura and staff
AND the caption SHALL read "Elf · Wizard"
```

```gherkin
GIVEN a player on the Personalización screen
WHEN they press ▶ on Peinado
THEN the hair style SHALL advance to the next style and the avatar SHALL update
WHEN they open Piel
THEN a swatch grid with the race skin palette SHALL appear
```

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
