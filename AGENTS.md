# dnd_sheet-manager

Mapa del proyecto para agentes (≤100 líneas). Apunta a dónde vive el detalle; no es un manual.

## Estado
- Backend Go (Gin) y frontend React cubren los specs de `openspec/specs/`; lint, tsc, build y `go test` en verde. Los specs son la fuente de verdad (`openspec/project.md`).

## Mapa de dominios
| Dominio | Carpeta | Responsabilidad |
|---|---|---|
| API HTTP | `internal/handler`, `cmd/server` | Rutas Gin y validación |
| Lógica | `internal/service` | Reglas de D&D, mercado, VTT, RAG |
| Datos | `internal/repository`, `migrations` | PostgreSQL + pgvector |
| Tiempo real | `internal/realtime`, `internal/websocket` | WS y Redis pub/sub |
| Foundry/SRD | `internal/foundry`, `internal/content` | Integración opcional y contenido |
| Frontend | `frontend/src` | React + Vite, páginas por mockup |
| Specs | `openspec/specs` | Requisitos y mockups |

## Comandos únicos
Declarados en `.harness/harness.yaml → comandos` (test, lint, build, run).

## Reglas
- RG-1 Código de producción y eficiente en recursos (`hz regla ver RG-1`).
- RG-2 Test-driven siempre: CONTRATO → ROJO → VERDE → REFACTOR.
- RG-3 Toda decisión se registra: `hz decision nueva`; antes de proponer, `hz decision buscar <tema>`.

## Cómo consultar
`hz estado` para retomar · `hz decision buscar <tema>` · `hz check`
