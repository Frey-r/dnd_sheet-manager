# T-23 · Reloj de juego y reglas de la agenda (Go puro)

- **Spec:** `npc-agenda.md` §1–§2. **Decisiones:** D-0063, D-0064, D-0065. **Célula:** `npc`. **Bloqueada por:** —.

## Alcance
`internal/domain/npc_agenda.go` (tipos JSON: `AgendaEntry`, `DaySpec` número o texto, `Agenda` JSONB) y
`internal/service/npc_agenda_rules.go`: `Weekday`, `StepClock`, `ResolveAgenda`, `ValidateAgenda`.

## Criterios de aceptación
1. **A1** `dia` se lee como número ≥ 1 o como `todos`, `laborables`, `fin_de_semana`, `lunes`…`domingo` (sin distinguir mayúsculas ni tildes en `miércoles`/`sábado`); se escribe igual que se leyó.
2. **A2** `Weekday(d, first)`: el día 1 cae en `first`; la semana tiene 7 días.
3. **A3** `StepClock`: día → tarde → noche → día siguiente; hacia atrás al revés; nunca baja del día 1 por la mañana.
4. **A4** `ResolveAgenda` aplica la precedencia exacto > día de semana > laborables/fin de semana > todos, solo con el mismo momento; sin coincidencia → ninguna.
5. **A5** `ValidateAgenda` reúne **todos** los errores con su índice: momento o día inválidos, duplicados (mismo día y momento), escena ajena, posición que falta o fuera de la escena, ruta inválida (ValidateRoute), nota > 500, más de 200 entradas.
