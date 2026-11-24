# T-28 · Curvas de Bézier en las rutas (Go)

- **Spec:** `vtt-npc-routines.md` §3 (manejadores `in`/`out`). **Decisión:** D-0069. **Célula:** `vtt`. **Bloqueada por:** T-17.

## Criterios de aceptación (`go test ./internal/service/`)
1. **C1** `RoutePosition` recorre las curvas a velocidad constante por longitud de arco (24 subtramos); sin manejadores todo queda igual (la tabla de T-17 sigue en verde).
2. **C2** Tabla compartida `testdata/route_curve_cases.json` con el instante como fracción del ciclo (`RouteCycleSeconds`): arco simétrico, manejadores alineados (recta), vuelta de `pingpong` por la misma curva invertida, bucle con tramo de cierre curvo.
3. **C3** `ValidateRoute` rechaza una curva que cruza un muro aunque la cuerda no, y una curva que sale de la escena.
4. **C4** `RescaleElapsed` mantiene la posición sobre una curva al cambiar la tasa.
