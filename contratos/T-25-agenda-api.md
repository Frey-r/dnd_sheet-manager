# T-25 · Reloj, agenda e importación/exportación de la ficha del PNJ (backend)

- **Spec:** `npc-agenda.md` §1, §2, §5 (importar/exportar), §6. **Decisiones:** D-0063…D-0066. **Célula:** `npc`. **Bloqueada por:** T-23, T-24.

## Criterios de aceptación
1. **I1** Reloj: por defecto día 1 · dia · lunes; el GM lo fija o avanza (`step`); `first_weekday` se guarda en los ajustes; datos inválidos → error.
2. **I2** Agenda: guardar valida contra las escenas de la campaña (todos los errores con índice, 400) y se lee igual; `resolve` devuelve la entrada que aplica.
3. **I3** Exportar: ficha completa (`version`, `pj`, `combate`, `inventario` con `encima`/`casa`, `agenda` con el nombre de cada escena); se pueden pedir solo algunas secciones.
4. **I4** Importar: valida todo antes de escribir (un error en un PNJ → no se escribe nada); cada sección presente reemplaza, la ausente no se toca; empareja por `id` o por `nombre`; un PNJ inexistente se reporta; los datos de `pj` solo con «actualizar datos»; `dry_run` no escribe.
5. **I5** `ValidateNPCInventory`: nombre obligatorio, cantidad ≥ 1, `donde` encima/casa, valor y monedas ≥ 0, equipado solo encima, ≤ 500 objetos.
