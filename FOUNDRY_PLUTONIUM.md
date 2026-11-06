# Reference content from 5etools via Plutonium

The flat `srd_*` schema cannot reconstruct dnd5e **class machinery** (advancement,
per-level features, spellcasting progression). Our own exporter therefore only ships
**monsters, spells and items** (the `dnd-manager-srd` module). For **classes,
subclasses, class features, feats, backgrounds and races**, use **Plutonium**, the
5etools community importer for Foundry, which converts the 5etools data to full-fidelity
Foundry documents.

## What Plutonium is (and the caveats)

- Plutonium is an **importer module**. It does **not** contain WotC content — it reads
  the 5etools data you already have (`C:\Users\eduar\Downloads\5etools-v2.30.0\data`).
  So it works without any in-app purchase.
- The module is **gated**: it is distributed through the 5etools Discord (free to
  members), **not** on Foundry's public package list. You install it yourself with your
  Discord access — it cannot be fetched/installed by tooling here.
- **Legal**: non-SRD 5e content is copyrighted by Wizards of the Coast. Importing it is a
  personal-use gray area and your responsibility.

## Install & import

1. Get the Plutonium manifest URL from the 5etools Discord (`#plutonium` / pinned).
2. Foundry → **Add-on Modules → Install Module** → paste the manifest URL → Install.
3. Enable Plutonium in your world (**Manage Modules**) and reload.
4. Point Plutonium at your local data if needed (Plutonium Config → data source) or use
   its **Import** UI. Import these categories **into compendiums** (not just the world):
   - Classes, Subclasses, Class Features, Subclass Features
   - Feats, Backgrounds, Races
   - (Optional) Bestiary, Spells, Items — but see note below.

Exact menu labels vary by Plutonium version; follow its in-app docs.

## Recommended division of content

- **Plutonium**: classes/subclasses/features, feats, backgrounds, races (the parts that
  need advancement automation).
- **`dnd-manager-srd` module** (ours): the large monster/spell/item catalog exported
  from Postgres (`go run ./cmd/foundry-export` + `scripts/compile-foundry-module.ps1`).

If you also import Bestiary/Spells/Items via Plutonium you'll have **duplicate
compendiums** (ours + Plutonium's). Pick one source for those to avoid confusion; if you
prefer Plutonium for everything, you can skip/disable our module.

## Sync back into the app (Postgres)

Once the compendiums exist in Foundry, Foundry is the source of truth. Mirror reference
data into Postgres with the existing endpoint (GM/admin):

```
POST /api/foundry/sync/reference
```

It reads compendiums via the relay (`GET /search`, compendiums included) and upserts into
`srd_*` by `foundry_uuid`. Covered today: spells, monsters, classes, subclasses, races,
items. **feats/backgrounds are not mirrored** (no `srd_feats`/`srd_backgrounds` tables);
they live in Foundry only unless those tables are added later.

## Notes

- Our exporter (`cmd/foundry-export`) no longer emits classes/subclasses/races; the old
  broken "classes" compendium (garbage entries like "Accursed/Acolyte") has been removed
  from the module.
- The app DB also has the real 5etools classes/subclasses loaded directly
  (`scripts/import_5etools_classes.py`) for the app's own browsers, independent of Foundry.
