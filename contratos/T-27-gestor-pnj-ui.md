# T-27 · Gestor de PNJ, reloj y agenda en el frontend

- **Spec:** `npc-agenda.md` §1, §4, §5. **Decisiones:** D-0063…D-0066. **Célula:** `npc-ui`. **Bloqueada por:** T-26.

## Criterios de aceptación (Vitest)
1. **U1** `lib/npc/agenda`: etiquetas de día y momento, descripción de una entrada, `upsertEntry` (reemplaza mismo día+momento), orden de la tabla y texto del resumen de aplicar.
2. **U2** `GameClockBar`: muestra «Día N · día de la semana · Momento»; el GM avanza/retrocede y reaplica; el jugador solo lo ve.
3. **U3** `AgendaEditor`: tabla con las entradas, alta/edición/borrado por formulario (día con número, todos, laborables, fin de semana o día de semana), vista JSON editable que avisa de JSON roto y guarda; muestra los problemas del servidor por entrada.
4. **U4** `CombatSheetForm`: edita la hoja de combate (con valores previos o por defecto) y la guarda.
5. **U5** `WhereaboutsView`: lista PNJ con escena, estado legible y siguiente destino.
6. **U6** `GiveDialog`: elige personaje y cantidad (objeto o monedas, sin pasar del máximo) y entrega.
7. **U7** `SaveToAgendaDialog`: guarda la rutina actual de la ficha en la agenda para el día y momento elegidos (por defecto los del reloj).
