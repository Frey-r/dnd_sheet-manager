# Design System Specification ("Mesa de Ceniza")

*Sistema visual del frontend. Sustituye la paleta Material azul de los mockups originales (`mockups_views/`). Referencia visual: maqueta navegable `DnD_Manager_Maqueta/` (Escritorio del autor).*

## Principles
- The UI **SHALL** read as a modern tool for long night sessions: dark theme by default, light and high-contrast themes selectable in Settings and persisted per device.
- Colours, radii, shadows and fonts **SHALL** come from CSS custom properties defined once in `frontend/src/index.css`; components **MUST NOT** hard-code hex colours except inside map/VTT rendering.
- Accent colour: ember (`#ff6a3d` dark / `#e2491c` light). Violet/lavender **MUST NOT** be used in the app's own design (rarity "very rare" uses magenta).
- Type: Geist (UI), Fraunces (proper names and long-form reading), Geist Mono (numbers, dice, stats).

## Semantic colours
| Token | Meaning |
|---|---|
| `ok` / `warn` / `bad` | HP healthy (≥ 60 %) / hurt / critical (< 30 %) or down |
| `info` | Foundry/mirror origin, temp HP, world events |
| `gold` | DM-only content, inspiration, gold |
| `role-player` / `role-dm` / `role-admin` | role labels |
| `rar-*` | item rarity (common, uncommon, rare, very rare, legendary) |

## Shell
- Authenticated screens **SHALL** use a persistent, collapsible left sidebar on desktop and a bottom bar + full-screen menu on mobile (< 860 px).
- The top bar **SHALL** show breadcrumb, real-time connection state (connected / reconnecting / offline) and the user with role label.
- DM tools **SHALL** be grouped under a "Dirección" section visible only to GM/admin.
- A quick dice roller **SHALL** be reachable from every campaign screen (d20–d4, modifier, normal/advantage/disadvantage, secret roll for GM).

## Accessibility
- Text contrast **MUST** meet WCAG AA in every theme; focus **MUST** be visible; interactive targets **SHOULD** be ≥ 28 px; `prefers-reduced-motion` **SHALL** disable animations.
