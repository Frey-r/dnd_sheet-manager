# T-20 · Rutas y PNJ en el tablero (frontend)

- **Spec:** `vtt-npc-routines.md` §1, §5, §6. **Decisiones:** D-0057, D-0060. **Célula:** `vtt-ui`. **Bloqueada por:** T-18.

## Criterios de aceptación (Vitest)
1. **F1** `routePosition` (TS) pasa la misma tabla `internal/service/testdata/route_cases.json` que Go.
2. **F2** `liveClock(clock, receivedAt, now)` suma el tiempo local solo si `running`.
3. **F3** La herramienta «Ruta de PNJ» arma puntos ajustados al centro de casilla y guarda con doble clic (PUT route); Esc cancela.
4. **F4** El panel Rutina muestra modo, pausar/reanudar/reiniciar/quitar; la disposición solo se edita en tokens sin `npc_id`.
5. **F5** «Colocar PNJ» lista los PNJ de la campaña y crea el token con `npc_id` en el clic siguiente.
6. **F6** Solo el GM ve las rutas dibujadas.
