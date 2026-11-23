# T-15 · Errores del backend de recursos de campaña (E-0019)

- **Origen:** E-0019 (hallazgos del tester de T-13). **Aprobado por el usuario** ("Sí, corrígelos"). **Célula:** `npc`.
- **Spec:** `openspec/specs/security.md` (no filtrar detalles internos en errores) y el comportamiento del bot de campaña.

## Alcance

`internal/handler/campaign_resource_handler.go` y `internal/repository/campaign_resource_repo.go`. Los tests de T-13
siguen bloqueados; si alguno fija hoy el comportamiento defectuoso (por ejemplo el 400 con el mensaje de la BD), se
documenta como decisión y se cubre el nuevo comportamiento en tests nuevos.

## Criterios de aceptación (tests Go nuevos, `internal/handler/campaign_resource_errors_test.go` y del repositorio)

1. **B1 Error de BD → 500 sin filtrar:** cuando el repositorio devuelve un error que no es de validación ni "no encontrado",
   `respond` contesta **500** con un mensaje genérico (por ejemplo `{"error":"internal error"}`) que no contiene el texto del
   error de la base. Los errores de validación siguen en 400 y "no encontrado" en 404.
2. **B2 GET /bot exige GM:** un jugador que no es GM recibe 403 en `GET /api/campaigns/:id/bot`; el GM lo obtiene.
3. **B3 PUT /bot conserva las acciones:** un `PUT /bot` sin el campo `actions` mantiene las acciones guardadas (igual que hoy
   pasa con `enabled` y `personality`).
4. **B4 Sin doble codificación:** Create y Update del repositorio con tipo `bot` guardan `actions` como JSON (objeto o
   arreglo), no como string base64 ni JSON dentro de un string.
5. **B5 Sin regresión:** la suite de Go completa sigue en verde.
