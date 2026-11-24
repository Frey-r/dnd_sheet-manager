# T-29 · Curvas en la pluma y en el tablero (frontend)

- **Spec:** `vtt-npc-routines.md` §3 y §6. **Decisión:** D-0069. **Célula:** `vtt-ui`. **Bloqueada por:** T-22, T-28.

## Criterios de aceptación (Vitest)
1. **K1** `routePosition` (TS) pasa `route_curve_cases.json` igual que Go.
2. **K2** Clic y arrastrar al poner un ancla crea un ancla suave: `out` en el cursor (píxel) e `in` simétrico; un clic quieto deja esquina.
3. **K3** Los tramos con manejadores se dibujan con `bezierCurveTo` (ruta guardada y borrador).
4. **K4** Editar: arrastrar un manejador lo mueve y el opuesto queda simétrico; con Alt solo ese; arrastrar el ancla mueve sus manejadores; todo llama a `onRouteEdit`.
5. Se mantienen los tests de T-20/T-22.
