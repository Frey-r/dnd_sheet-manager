# Market & Bastions

Status: approved 2026-11-06 (decisions taken with the user). Supersedes the single
campaign-wide `marketplace_items` list.

## 1. Goals

- The GM manages a **dynamic market**: several shops, each with its own stock, prices and
  rules, that open and close with the story (a scene with a shop, a shop counter on the map).
- Players buy from open shops and sell to shops that buy.
- Players own a **Bastion** (D&D 2024 DMG rules): facilities, hirelings, orders and Bastion
  turns. What facilities produce goes to the Bastion's warehouse and can be **sold to the NPC
  market**: a random buyer is chosen; when the buyer is an NPC created in the campaign, the
  goods end up in that NPC's inventory or home, where the party may later find them.

## 2. Money

- Characters **SHALL** hold coins as `gold` (gp, existing), `silver` (sp) and `copper` (cp).
- All prices and values **SHALL** be stored in copper (`*_cp`, 1 gp = 10 sp = 100 cp).
- A payment **SHALL** be taken from the total wallet value and the change returned in the
  fewest coins (gp first). Payouts are added the same way.

## 3. Shops

| Field | Meaning |
|---|---|
| `name`, `description`, `icon` | Display |
| `npc_id` | Optional shopkeeper (campaign NPC) |
| `availability` | `open` · `closed` · `scene` (open only while `scene_id` is the active scene) |
| `scene_id` | Scene the shop belongs to (required for `scene`) |
| `object_id` | Optional map object (VTT object) acting as the counter |
| `price_pct` | Markup over the item price (100 = list price) |
| `buy_rate_pct` | % of an item's value the shop pays when buying from players (0 = does not buy, default 50) |
| `buys_types` | Item types the shop buys (empty = any) |

- A shop **SHALL** be *available* to a player when `availability = open`, or `scene` and its
  scene is the campaign's active scene. When `object_id` is set and the shop's scene is the
  active scene, the player's token **SHALL** additionally be within 1.5 cells of the object
  (same rule as interacting with objects, `vtt-modes.md`). The GM always has access.
- Shop items: `name`, `item_type`, `rarity`, `price_cp`, `weight`, `description`,
  `attunement`, `srd_ref`, `stock` (`-1` = unlimited). The GM **SHALL** be able to add items
  by hand or from the compendium (equipment / magic items, price taken from the catalogue),
  edit and delete them, and restock.
- Existing `marketplace_items` **SHALL** be migrated into one shop per campaign named
  "Mercado general" (`availability = open`).
- The map object linked to a shop **SHALL** open the shop when a player interacts with it.

### Buying: a cart haggled with the seller
- Players **SHALL NOT** buy instantly. They fill a **cart** (items and quantities of one shop,
  kept in the browser) and send it as an **order** with the price they offer (default: the list
  price `Σ ceil(price_cp × price_pct / 100) × qty`), an optional note and an optional skill
  (Persuasión, Engaño or Intimidación). Availability and stock are checked when sending.
- The haggling is **role-played on the call**. The GM sees a modal with the oldest pending order
  of the campaign (the rest wait in a queue, "N en cola"): lines, list price, offered price,
  note and — when a skill was chosen — a secret roll (`d20 + modifier`) visible to the GM only.
- The GM **SHALL** close the deal at the agreed price (any amount; default the offer), propose a
  price for the player to accept or reject on their screen, or reject the order.
- Closing a deal **SHALL** be atomic: stock of every line is checked and decreased, the agreed
  total is charged, the items go to the buyer's inventory with `value_cp` = list unit price. When
  funds or stock fail, the order stays open and the GM sees why.
- A character **SHALL** have at most one active order (pending or proposed); the player **MAY**
  withdraw it. The GM keeps a direct `buy` shortcut for handing items at list price.

### Selling to a shop
- A player **MAY** sell an inventory item with known `value_cp` to an available shop that buys
  its type. Payout = `floor(value_cp × buy_rate_pct / 100)` per unit. Quest-bound, equipped or
  trade-locked items **SHALL NOT** be sold.
- The sold item **SHALL** be added to the shop's stock at its full value.

## 4. Item value

- `inventory_items.value_cp` (nullable) **SHALL** be set when an item is bought, produced by a
  Bastion, or created from the compendium with a known cost. Items without value cannot be sold
  until the GM appraises them (sets the value).

## 5. NPC belongings

- `npc_items`: `npc_id`, `name`, `quantity`, `value_cp`, `description`, `location`
  (`inventory` | `home`), `source` (e.g. "Comprado al bastión de Kaelen"). Visible and editable
  by the GM in the NPC detail.

## 6. Bastions (DMG 2024)

### 6.1 Bastion
- A character of level ≥ 5 **MAY** found one Bastion (name, description). The GM can always
  create one (and for lower levels if the table wants).
- A Bastion **SHALL** track: basic facilities, special facilities, hirelings, defenders,
  warehouse (produced goods), construction queue, turn log.

### 6.2 Basic facilities
- Kinds: Bedroom, Dining Room, Parlor, Courtyard, Kitchen, Storage. Sizes: Cramped (4 squares),
  Roomy (16), Vast (36).
- A new Bastion **SHALL** start with two basic facilities: one Cramped and one Roomy.
- Adding a basic facility costs Cramped 500 gp / 20 days, Roomy 1,000 gp / 45 days,
  Vast 3,000 gp / 125 days. Enlarging: Cramped→Roomy 500 gp / 25 days, Roomy→Vast
  2,000 gp / 80 days. Gold is paid up front; the work completes after the days elapse in
  Bastion turns (7 days each).

### 6.3 Special facilities
- Number allowed by character level: 5 → 2, 9 → 4, 13 → 5, 17 → 6. They are gained without
  cost when the level is reached; each has a minimum level and a prerequisite that the GM
  confirms (e.g. "can use an Arcane Focus").
- The facility catalogue **SHALL** be data, seeded with the 2024 facilities and **editable by
  the GM per campaign** (to correct, extend or homebrew). Each entry: name, min level,
  prerequisite, default size, hirelings, allowed orders and the **order options** (what an
  order can produce: items with value, a gold roll, defenders, or a narrative result, with cost
  and duration in turns).
- Seeded catalogue (level): Arcane Study, Armory, Barrack, Garden, Library, Sanctuary, Smithy,
  Storehouse, Workshop (5) · Gaming Hall, Greenhouse, Laboratory, Sacristy, Scriptorium, Stable,
  Teleportation Circle, Theater, Training Area, Trophy Room (9) · Archive, Meditation Chamber,
  Menagerie, Observatory, Pub, Reliquary (13) · Demiplane, Guildhall, Sanctum, War Room (17).
  Descriptions are short paraphrases; the GM's book is the reference.

### 6.4 Orders and Bastion turns
- Orders: Craft, Empower, Harvest, Maintain, Recruit, Research, Trade. Before a turn the player
  **SHALL** give each special facility at most one order among those it allows, choosing one of
  its options.
- The GM **SHALL** run a **Bastion turn** for the campaign (7 in-game days). For every Bastion:
  - each order resolves: items go to the warehouse (with `value_cp`), gold rolls are paid to
    the owner, defenders are added, narrative results are logged; multi-turn options progress
    and finish when complete; option costs are charged when the order is issued;
  - if every facility was on Maintain (or had no order) the Bastion **SHALL** roll on the
    Bastion events table (d100, seeded, editable): All Is Well, Attack, Criminal Hireling,
    Extraordinary Opportunity, Friendly Visitors, Guest, Lost Hirelings, Magical Discovery,
    Refugees, Request for Aid, Treasure;
  - construction progresses by 7 days;
  - a log entry per Bastion records everything; owners are notified.

### 6.5 Selling Bastion goods
- The owner **MAY** sell warehouse goods (or move them to their inventory).
- Each sale **SHALL** pick a buyer at random: **85 %** an anonymous buyer ("otros": people the
  party will not meet), **15 %** one of the campaign's NPCs (uniform; skipped when there are
  none). Payout = `value_cp × bastion_sale_pct / 100` (campaign setting, default 100).
- When the buyer is a campaign NPC, the goods **SHALL** be added to that NPC's belongings with
  location `inventory` (60 %) or `home` (40 %) and source naming the Bastion. The seller sees
  the buyer's name only if it is a campaign NPC; otherwise "un comprador anónimo".

## 7. API (all under `/api/campaigns/:id`)

| Method & path | Who | Purpose |
|---|---|---|
| GET `/shops` | all | Shops (players: available ones + `available` flag + reason) |
| POST/PUT/DELETE `/shops[/:shop_id]` | GM | Manage shops |
| GET `/shops/:shop_id/items` · POST/PUT/DELETE `/shop-items[/:item_id]` | all / GM | Stock |
| POST `/shops/:shop_id/buy` `{item_id, qty}` | GM | Hand an item at list price |
| POST `/shops/:shop_id/sell` `{inventory_item_id, qty}` | player | Sell to the shop |
| POST `/shops/:shop_id/offers` `{lines:[{item_id, qty}], offered_cp, message, skill}` | player | Send the cart to the seller |
| GET `/offers` | GM: pending queue · player: own active | Offers |
| POST `/offers/:offer_id/:action` (`accept` `{price_cp}`·`reject`·`counter` `{price_cp}`·`withdraw`) | GM / player | Resolve an order |
| GET/POST `/npcs/:npc_id/items` · PUT/DELETE `/npc-items/:id` | GM | NPC belongings |
| GET `/bastions` · GET `/bastions/:bid` | owner / GM | Bastions |
| POST `/bastions` · PUT `/bastions/:bid` | owner (lvl ≥ 5) / GM | Found / rename |
| POST `/bastions/:bid/facilities` · DELETE `/bastion-facilities/:fid` | owner / GM | Add special or basic facility, enlarge |
| PUT `/bastion-facilities/:fid/order` `{order, option}` | owner | Issue order |
| POST `/bastions/turn` | GM | Run a Bastion turn |
| POST `/bastions/:bid/sell` `{warehouse_id, qty}` · POST `/bastions/:bid/take` | owner | Sell / move to inventory |
| GET/PUT `/bastion-catalog` | GM | Facility catalogue and events table |

## 8. Scenarios

```gherkin
Scenario: A shop opens with its scene
  Given the shop "Herrería de Brom" has availability "scene" on scene "Pueblo"
  When the GM activates scene "Pueblo"
  Then players see "Herrería de Brom" as available
  And when another scene is activated it becomes unavailable

Scenario: Shop counter on the map
  Given "Herrería de Brom" is linked to the map object "Mostrador"
  When Kaelen's token is 4 cells away
  Then buying is refused with "Acércate al mostrador"
  When Kaelen walks next to the counter and interacts with it
  Then the shop opens and he can buy

Scenario: Haggling a cart on the call
  Given Kaelen's cart holds 2 Daggers (2 gp each) and a Longsword (15 gp)
  When he sends the order offering 15 gp with Persuasión
  Then nothing is charged yet
  And the GM sees the 3 lines, list price 19 gp, the offer and Kaelen's secret roll
  When they agree on 17 gp on the call and the GM closes the deal
  Then Kaelen pays 17 gp and receives the daggers and the longsword
  And he could not send another order while this one was open

Scenario: Selling to a shop
  Given a shop that pays 50 % and buys weapons
  When Kaelen sells a Longsword worth 15 gp
  Then he receives 7 gp 5 sp and the shop lists a Longsword at 15 gp

Scenario: Bastion goods bought by a campaign NPC
  Given Kaelen's warehouse holds "Poción de curación" worth 50 gp
  And the random buyer is the campaign NPC "Mira la boticaria"
  When Kaelen sells it
  Then Kaelen receives 50 gp
  And "Mira la boticaria" owns a "Poción de curación" at her home or in her inventory

Scenario: Maintain-only turn rolls an event
  Given every special facility of a Bastion is on Maintain
  When the GM runs a Bastion turn
  Then the Bastion rolls on the events table and the result is logged
```

## Decisiones de implementación (2026-11-21)

- El turno de bastión emite `BASTION_TURN`; los jugadores ven un aviso con enlace a su bastión
  (solo para turnos de los últimos 2 minutos, para no repetirlo al reproducir el historial).
- `bastion_sale_pct` es editable por el GM (0–100) en la pestaña Tasación.
- Los rangos d100 y las opciones de orden sembrados son editables por el GM; las mecánicas de
  cada evento las resuelve el GM a partir del texto.
