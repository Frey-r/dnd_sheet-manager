# T-16 · `Create` de recursos de campaña con el mismo mapeo de errores

- **Origen:** E-0022 (misma clase que E-0019; la corrección quedó aprobada por el usuario al corregir E-0019).
- **Lección:** L-0002 (`.claude/skills/hz-leccion-recursos-campana-errores/SKILL.md`). **Célula:** `npc`. **Bloqueada por:** T-15.

## Alcance

`internal/handler/campaign_resource_handler.go`: `Create` deja de mapear errores a mano y comparte con `respond` un único
punto (por ejemplo `fail`), conservando el 201 en el éxito.

## Criterios de aceptación (`internal/handler/campaign_resource_create_errors_test.go`)

1. **E1 Texto demasiado largo → 400:** crear un recurso con un campo que excede el límite del repositorio responde 400 con
   el mensaje de `ResourceInputError`, sin tocar la base.
2. **E2 Error de BD → 500 genérico:** si el INSERT falla, responde 500 `{"error":"internal error"}` sin el texto de la base, y
   el error se registra en el log del servidor.
3. **E3 Éxito → 201:** crear un recurso válido sigue respondiendo 201 con el recurso creado.
4. **E4 Sin regresión:** los tests de T-13 y T-15 siguen en verde.
