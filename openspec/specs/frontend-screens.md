# Frontend Screens Specification

*Este documento refleja las vistas de los mockups en `mockups_views/` e incluye features no contempladas previamente: Combat Tracker, NPC Manager, Bestiary, Maps, Calendar, Bot Manager, Notes, GM Console.*

## 1. Authentication Screens

### 1.1 Login Screen (`iniciar_sesi_n/code.html`)
- **Purpose**: Authenticate users and establish session with JWT.
- **Layout**: Two-column (brand left / form right on desktop, stacked on mobile)
- **Elements**:
  - Email input with floating label
  - Password input with show/hide toggle
  - "Recordarme" checkbox
  - Submit button ("Iniciar Sesión")
  - Link to registration ("¿No tienes cuenta? Regístrate")
- **Behavior**:
  - On success: stores JWT, redirects to campaign list
  - On failure: displays error message inline

### 1.2 Registration Screen (`registro_de_usuario/code.html`)
- **Layout**: Two-column brand/form (mirrors login)
- **Elements**:
  - Username, Email, Password, Confirm Password fields
  - Password visibility toggle
  - Submit ("Crear Cuenta")
  - Link to login ("¿Ya tienes cuenta?")
- **Behavior**: Password confirmation must match

---

## 2. Campaign Screens

### 2.1 Campaign List / Hub (`campa_as/code.html`)
- **Layout**: Sidebar nav (desktop) + bento grid of campaign cards + bottom nav (mobile)
- **Sidebar elements**:
  - User avatar + username + role badge
  - Nav links: Campaigns, Party Roster, Combat Log, Campaign Notes, Settings
- **Top bar**: Search bar, user avatar, logo
- **Campaign cards**: Image, status badge (Activa/En Pausa), name, description, GM name, player count
- **"Crear Campaña" FAB** (GM only, desktop button + mobile FAB)

### 2.2 Campaign Session Hub (`sesi_n_de_juego/code.html`)
- **Purpose**: Central hub inside a campaign — provides access to all sub-sections.
- **Layout**: Sidebar (desktop) + main canvas + floating HP bar + bottom nav (mobile)
- **Top bar**: Campaign name + connection status (Connected indicator)
- **Quick Stats**: AC, Initiative, Speed, Passive Perception cards
- **Quick Rolls**: Grid of button shortcuts (e.g., Longsword +5, Stealth +5, Perception +4, Acrobatics +3)
- **Party Status**: List of party members with HP bars
- **Floating Character Quick View**: HP bar with "D20 Roll" button
- **Bottom nav mobile**: Sheet | Plot | Chat | Market | Inbox

### 2.3 GM Console / Dashboard (`panel_del_gm/code.html`)
- **Purpose**: GM-only central hub with access to all GM tools.
- **Layout**: TopAppBar + Quick Actions row + two-column bento (Initiative Tracker + Party Status)
- **TopAppBar**: Logo, navigation tabs: Combat | NPCs | Party | Events
- **Quick Actions**: "Tirada Secreta", "Encuentro Aleatorio", "Añadir Nota"
- **Initiative Tracker**: Ordered list of combatants (players + enemies) with HP bars, current turn highlighted
- **Party Status**: Grid of party member cards with HP bars
- **Bottom nav mobile**: Combat | NPCs | Party | Events

---

## 3. Character Sheet Screens

All character sheet views share: TopAppBar + sub-tab navigation (Stats | Spells | Inventory | Bio on mobile; inline tabs on desktop)

### 3.1 Character Sheet — Core Stats Tab (`hoja_de_personaje/code.html`)
- **Header**: Avatar + character name + class/level/race
- **Quick Stats row**: AC, Init, Speed (3 cards)
- **HP Section**: Current/Max HP with bar + Heal button
- **Ability Scores bento grid** (2×3): STR/DEX/CON/INT/WIS/CHA — each shows modifier (large) + score (small badge)
- **Spellcasting ability highlighted** with primary border
- **Skills/Proficiencies list**: skill name, ability modifier badge, total bonus
- **FAB**: D20 Roll button (bottom-right)
- **Bottom nav**: Sheet (active) | Plot | Chat | Market | Inbox

### 3.2 Character Sheet — Spells Tab (`hechizos_y_conjuros/code.html`)
- **Spellcasting Summary row**: Save DC + Attack Bonus cards
- **Spell Slots Tracker** (left column on desktop): Per-level slots with filled/empty dot indicators
- **Prepared Spells list** (right/main area): Spell cards organized by level, each with:
  - Spell name, school badge
  - Description (collapsed, expandable)
  - Casting time, range, duration metadata
  - "Lanzar" button
- **Spell Search FAB** (bottom-right)
- **Long Rest action**: Restores all spell slots

### 3.3 Character Sheet — Features & Abilities Tab (`rasgos_y_habilidades/code.html`)
- **Passive Senses card**: Passive Perception, Investigation, Insight
- **Languages & Proficiencies card**: Armor, Weapons, Languages tags
- **Class Features list**: Feature name + level badge + uses counter (if applicable) + description
- **Feats list**: Feat name + bullet list of effects
- **Racial Traits list**: Trait name + description
- **Sidebar**: Navigation (Campaigns | Character Hub | Encounter Builder | Bestiary | Maps | Notes | Marketplace | Chat)

### 3.4 Character Sheet — Inventory Tab (`inventario_de_personaje/code.html`)
- **Gold Tracker card**: Current wealth with edit button
- **Equipment Slots grid** (2×4): Head, Chest, Main Hand, Off Hand, Hands, Feet, Rings, Amulet — each shows icon + slot name + equipped item name (or "Vacío")
- **Mochila (Backpack)**: Scrollable item list with:
  - Item icon + name + quantity
  - Item type, weight, rarity badge
  - "Usar" / "Equipar" / "Delete" action buttons
- **Weight Tracker** (sticky footer above nav): 45/150 lbs progress bar
- **Add Item FAB** (bottom-right)
- **Attuned Items section**: Items requiring attunement (max 3)

### 3.5 Character Sheet — Biography Tab (`biograf_a_de_personaje/code.html`)
- **Layout**: Sidebar nav (desktop) + bento grid of text areas
- **Physical specs card**: Alignment, Age, Height, Weight, Eyes, Skin, Hair
- **Personality Traits / Ideals / Bonds / Flaws**: Textareas with Material icon labels
- **Backstory textarea**: Large, auto-expanding, auto-save indicator ("Last auto-saved 2 mins ago")
- **Additional Notes textarea**: Campaign notes, allies, enemies
- **Save button** (sticky footer)
- **Bottom nav**: Stats | Spells | Inventory | Bio (active)

---

## 4. Trade Screen

### 4.1 Trade Modal (`intercambio_de_objetos/code.html`)
- **Layout**: Two-panel (desktop) / stacked (mobile)
- **Left panel (Offeror)**:
  - Player avatar + name + character name/level
  - Gold transfer input field (number)
  - Selected items list with remove button
  - "Añadir Objeto" button (dashed border)
- **Right panel (Recipient)**:
  - Recipient avatar + name + character name/level
  - Gold requested (disabled input = 0 by default)
  - Requested items list
  - "Buscar Objeto de [Name]" button
- **Footer**: Cancel + "Enviar Oferta" buttons
- **Status badge**: "Pendiente" with amber dot

---

## 5. Messaging / Chat Screen

### 5.1 Messaging / Inbox (`mensajer_a_directa/code.html`)
- **Layout**: Inbox sidebar + chat area
- **Inbox sidebar**:
  - Search bar
  - Conversation list with avatars, last message preview, timestamp
  - GM Direct conversations highlighted with amber left border
  - Unread count badges (red circle on party chat)
- **Chat area**:
  - Chat header: recipient name + online status
  - Message bubbles: GM messages amber-styled, player messages primary-styled
  - "Roll Requested" special message type with dice icon
  - Compose area: textarea with send button + "Roll Dice" quick action
  - Enter to send, Shift+Enter for new line
- **Bottom nav mobile**: Hub | Stats | Lore | Trade | Chat (active)

---

## 6. Lore Search (RAG) Screen (`buscador_de_lore_rag/code.html`)
- **Layout**: Full-screen chat-like interface
- **Scope Selector row** (sticky below header):
  - "Mi Personaje" (primary styled — active)
  - "Trama de la Partida" (outline styled)
  - "Lore Oculto (GM)" (amber, with visibility_off icon — GM only)
- **Chat area**:
  - User query bubbles (right-aligned, primary color)
  - AI response bubbles (left-aligned, surface color)
  - AI response includes expandable "Ver Fuentes (N)" with cited lore entries
  - Typing indicator ("Buscando en el lore...") with animated dots
- **Suggested prompts row** (above input): "¿Qué pasó en mi backstory?", "¿Quién es Strahd?", "Resumen del Capítulo 1"
- **Input**: Text input + send button
- **Auto-scroll to bottom on new messages

---

## 7. Marketplace Screen (`mercado_de_objetos/code.html`)
- **Layout**: TopAppBar + search + filter chips + item grid
- **Search bar**: "Buscar objetos..."
- **Filter chips**: Todo | Armas | Armaduras | Pociones | Magia
- **Item cards** (horizontal layout: image left + info right):
  - Item image (w-32 thumbnail)
  - Name + rarity badge
  - Type/category
  - Price in gold (po) + "Comprar" button
- **Rarity badges color-coded**: Common (default), Uncommon (green), Rare (blue), Very Rare (purple), Legendary (orange)
- **Bottom nav mobile**: Sheet | Plot | Chat | Market (active) | Inbox
- **Side nav (desktop)**: Sheet | Plot | Chat | Market (active) | Inbox

---

## 8. Settings / Profile Screen (`ajustes_y_perfil/code.html`)
- **Layout**: TopAppBar (back button + title) + scrollable form + bottom nav
- **Profile section**: Avatar (editable) + Display Name input + Email (read-only with lock icon)
- **Security section**: Change Password row + 2FA status row
- **Preferences section**: App Theme selector (Light/Dark toggle), Push Notifications toggle, Email Newsletter toggle
- **Danger Zone**: Delete Account button (red)
- **Save Changes button** (sticky footer)
- **Bottom nav mobile**: Hub | Stats | Profile (active) | Lore

---

## 9. Combat / Initiative Screen (GM View) (`panel_del_gm/code.html`)
- **Initiative Tracker**:
  - Active turn card (highlighted with primary left border + "Turno Actual" badge)
  - Ordered list of all combatants (players + enemies)
  - Each card: initiative number, name, type badge (Jugador/Enemigo), HP bar + HP text
  - Current turn: green left border, "Turno Actual" badge
  - Next: normal
  - "Añadir Combatiente" button at bottom
- **Round counter**: "Ronda N" displayed in header
- **Party Status section** (right column):
  - Party member cards with avatar + class + level + HP bar
  - Low HP warning styling (red border for danger)
  - "Añadir Jugador" placeholder card

---

## 10. NPC Manager Views

### 10.1 NPC List / Manager (`gestor_de_npcs/code.html`)
- **Grid of NPC cards**: Avatar image + Name + Role/Business + Status
- **Status badges**: Ally (green), Enemy (red), Neutral (gray)
- **"Añadir NPC" button** to create new
- **Search/filter by name or status**

### 10.2 NPC Detail (`detalle_de_npc/code.html`)
- **NPC profile card**: Large avatar, name, role, status badge
- **Stats block**: AC, HP, Speed, passive Perception
- **Abilities/Attacks list**: Name + description
- **Inventory or notes section**
- **Edit / Delete actions**

---

## 11. Bestiary Views

### 11.1 Bestiary List (`bestiario_de_criaturas/code.html`)
- **Grid of creature cards**: Creature image + Name + Challenge Rating + Type
- **Filter by type (Beast, Undead, etc.)**
- **CR badge color-coded by threat level**

### 11.2 Creature Stats Detail (`detalle_de_estad_sticas_de_criatura/code.html`)
- **Creature header**: Name + Type + Challenge Rating
- **Stats block**: Size, AC, HP, Speed
- **Ability scores (STR/DEX/CON/INT/WIS/CHA)
- **Skills/ Saves list
- **Resistances / Immunities section
- **Actions list: Name + description
- **"Add to Encounter" button

---

## 12. Map Gallery Views

### 12.1 Maps Gallery (`galer_a_de_mapas/code.html`)
- **Grid of map thumbnails**: Image + Map name + Location name
- **"Nueva Mapa" button**
- **Click → Map Detail**

### 12.2 Map Detail (`detalle_de_mapa/code.html`)
- **Full-width map image display**
- **Map name + location header**
- **Annotations / pins overlay (future)**
- **"Editar" / "Ajustes" actions**

---

## 13. Campaign Notes (`notas_de_la_campa_a/code.html`)
- **Notes editor interface** (separate from RAG lore search)
- **List of notes by session/date
- **Rich text / markdown editor
- **GM-only visibility

---

## 14. Calendar / Events (`calendario_de_eventos/code.html`)
- **Calendar grid view** (month/week)
- **Event markers on dates
- **Event detail: Title + Description + Time + Related NPCs/Locations
- **"Añadir Evento" button
- **GM-only

---

## 15. GM Bot Manager (`gestor_de_bot_n/code.html`)
- **Bot configuration interface**
- **Enable/disable bot toggle**
- **Bot personality prompt editor
- ** bot actions: auto-roll NPCs, loot distribution, timers
- **Test bot button

---

## 16. GM Notes — Lore Entry Management (within GM Console)
- **Lore entries list by chapter
- **Entry editor: Title + Content textarea + Visibility toggle (Shared / GM-only)
- **Vectorization status indicator per entry
- **"Probar búsqueda" button to test RAG retrieval
- **Character lore annotations (GM notes on player backstories)

---

## 17. NPC Detail View (`detalle_de_npc/code.html`)
- **Route**: `/campaign/:campaignId/gm/npcs/:npcId`
- **Layout**: Two-column (profile/stats left, traits/actions/lore right on desktop; stacked on mobile)
- **Left column**:
  - Profile card: large avatar, name, role, status tags (Undead, Medium, CR)
  - Combat stats (3-cards): AC, HP (danger-styled), Speed
  - Ability scores grid (3×2, highlighted primary attribute)
- **Right column**:
  - Traits section: collapsible with passive/action tags
  - Actions section: multi-column grid of action cards with hit/Save DC badges
  - Lore & GM Notes section: text block
- **Actions**: "Añadir a Combate" + "Editar NPC" buttons

---

## 18. Creature Stat Block Detail (`detalle_de_estad_sticas_de_criatura/code.html`)
- **Route**: `/campaign/:campaignId/gm/bestiary/:creatureId`
- **Layout**: Single column max-w-4xl with bento grid sections
- **Header section**: creature image (left), name + type (italic), AC + HP stat cards
- **Ability scores grid**: 3→6 column responsive, each stat: label (bold), score (stat-number), modifier
- **Information DL**: dl/dt/dd pairs for Saving Throws, Skills, Immunities, Senses, Languages, Challenge
- **Traits section**: Cards with trait name (primary) + description
- **Actions section**: Action cards, Rayos Oculares with bullet list
- **Legendary Actions section**: Description + Eye Ray card

---

## 19. Map Detail View (`detalle_de_mapa/code.html`)
- **Route**: `/campaign/:campaignId/gm/maps/:mapId`
- **Layout**: Full-screen interactive map canvas
- **Map canvas**: zoomable/pannable image with location pins (primary + amber styles), grid overlay toggle
- **Floating controls**: zoom in/out (right), layer toggle with checkboxes (left)
- **Bottom sheet**: expandable/collapsible panel with location name, description, "Editar" button, Points of Interest grid
- **Layers menu**: toggle Cuadrícula/Niebla/Marcadores via checkboxes

---

## 20. Player Encounter View (`encuentro_de_combate_jugador/code.html`)
- **Route**: `/campaign/:campaignId/encounter`
- **Player-facing combat view** (simplified)
- **Shows**: current combat round, player's turn indicator if active
- **Initiative tracker**: horizontal snap-scroll cards with active-turn ring, HP bars
- **Character status card**: big avatar + name, HP/AC stats with mini bars, status chip
- **Combat log**: clean list entries with colored left borders, actor actions
- **Bottom nav (mobile)**: Ataques | Hechizos | Objetos | Acciones tabs

---

## Screen Flow Summary

```
Login / Register
    ↓
Campaign List
    ├── Campaign Session Hub (Player & GM shared views)
    │   ├── Mi Hoja (tabs: Stats, Spells, Inventory, Bio)
    │   ├── Trama / Lore Search (RAG chat)
    │   ├── Chat (messaging)
    │   ├── Mercado (item purchase)
    │   └── Mensajes (inbox)
    │
    └── GM Campaign Console
        ├── Combat (Initiative Tracker)
        ├── NPCs (Manager → Detail)
        ├── Party (player management)
        ├── Events (Calendar)
        ├── Maps (Gallery → Detail)
        ├── Notes (GM campaign notes)
        ├── Bestiary (Creature list → Stat Block Detail)
        ├── Bot Manager
        └── Lore Editor (RAG entries)
    
    └── Player Encounter View
```

---

## Responsive Behavior

- **Desktop (primary)**: Fixed side navigation, multi-column layouts, hover states
- **Tablet**: Collapsible sidebars, stacked panels
- **Mobile (secondary)**: Bottom navigation bar, single column, full-screen modals

---

## Component Library Required

### Shared Components
- `TopAppBar`: Logo/title, connection status, user avatar, settings icon
- `BottomNav`: 5 tabs (Sheet, Plot/Lore, Chat, Market, Inbox)
- `SideNav` (desktop): Vertical nav with icons + labels
- `CampaignCard`: Image, status badge, name, description, GM/player count
- `CharacterAvatar`: Image or initials fallback, level badge overlay
- `HPBar`: Animated fill bar, color changes (green→amber→red)
- `SpellSlotDots`: Filled/empty dots per spell level
- `ItemCard`: Image, name, type, rarity badge, price, action button
- `ConversationRow`: Avatar, name, preview, timestamp, unread badge
- `MessageBubble`: Avatar, content, timestamp, delivery status
- `FilterChip`: Pill-style filter buttons
- `ScopeSelector`: Toggle button group for RAG search scope
- `InitiativeCard`: Number badge, name, HP bar, type indicator
- `StatCard`: Label + large number display
- `AbilityScoreBadge`: Modifier (large) + score (small), highlighted if spellcasting ability
- `SkillRow`: Name, proficiency indicator, bonus value
- `FeatureCard`: Name, level badge, uses counter, description
- `D20FAB`: Floating action button with "20" or dice icon
- `Toast`: Notification toasts (success/error/info/trade/message)
- `Modal`: Overlay modal with header, body, footer actions
- `TradePanel`: Two-column item/gold selection with timer

### RAG Chat Components
- `RAGMessage`: Query bubble + AI response bubble + expandable sources
- `TypingIndicator`: Animated dots
- `SuggestedPrompt`: Clickable prompt chips
- `SourceEntry`: Book icon + title + source type

---

*This document maps 1:1 to the mockups in `mockups_views/` and supersedes earlier frontend screen definitions. Any view not listed here must be specced before implementation.*
