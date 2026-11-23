# T-13 · PNJ con raza, clase y apariencia (backend)

- **Spec:** `character-appearance.md` § NPC creator (Data). **Decisión:** D-0041. **Célula:** `npc`. **Bloqueada por:** —.

## Alcance

Migración nueva `migrations/031_npc_appearance.sql` (goose Up/Down) que agrega a `campaign_npcs`: `race TEXT NOT NULL DEFAULT ''`,
`class TEXT NOT NULL DEFAULT ''`, `appearance JSONB NULL`. `internal/repository/campaign_resource_repo.go` (campos del recurso
`npcs`), y la validación en el handler o servicio de recursos de campaña: para `npcs`, `appearance` pasa por
`service.ValidateAppearance` (rechazo 400 si es inválida; null o ausente se guarda como NULL).

## Criterios de aceptación (tests Go, `go test ./...`)

1. **N1 Crear:** `POST /api/campaigns/:id/npcs` con `race`, `class` y una `appearance` válida guarda y devuelve los tres campos.
2. **N2 Validación:** una `appearance` con `hair: 12`, una clave desconocida, un color mal formado o > 1 KB → 400 y no se guarda.
3. **N3 Editar:** `PUT` actualiza raza, clase y apariencia; `appearance: null` la borra.
4. **N4 Compatibilidad:** los PNJ existentes (sin raza, clase ni apariencia) se listan con `race: ""`, `class: ""` y
   `appearance: null`; crear un PNJ sin esos campos sigue funcionando.
5. **N5 Permisos:** solo el GM de la campaña crea o edita PNJ (igual que hoy).

## Presupuesto de recursos (RG-1)

Sin consultas nuevas por request; la validación de apariencia reutiliza la función existente (sin instancias nuevas).
