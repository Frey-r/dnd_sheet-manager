# T-17 · Posición de ruta determinista y validación (Go)

- **Spec:** `vtt-npc-routines.md` §3. **Decisiones:** D-0057, D-0061. **Célula:** `vtt`. **Bloqueada por:** —.

## Alcance
`internal/service/vtt_route_rules.go`: tipos `domain.Route{Mode, Points[]{X,Y,WaitS}}`, `RoutePosition(route, ratePxPerSec, elapsed time.Duration) (x, y float64)`
y `ValidateRoute(scene, route) error`. Tabla de casos compartida con el frontend en
`internal/service/testdata/route_cases.json` (la misma tabla la corre T-20 en TypeScript).

## Criterios de aceptación (`go test ./internal/service/`)
1. **R1 once:** avanza por los tramos a la tasa dada y se queda en el último punto.
2. **R2 pingpong:** al llegar al final vuelve por los mismos puntos; el ciclo dura 2× el recorrido (+ esperas).
3. **R3 loop:** tras el último punto vuelve a P0 (tramo de cierre) y repite.
4. **R4 esperas:** `wait_s` de un punto detiene el token ahí ese tiempo en cada pasada (en pingpong, los extremos esperan una vez por llegada).
5. **R5 bordes:** tasa 0 o elapsed ≤ 0 → P0; elapsed enorme (días) no pierde precisión notable (módulo del ciclo).
6. **R6 validación:** < 2 o > 32 puntos, modo desconocido, punto fuera de la escena, `wait_s` fuera de [0,600] o tramo que cruza un muro no-puerta → error que nombra el problema; cruzar una puerta (abierta o cerrada) es válido. En `loop` también se valida el tramo de cierre.

## Presupuesto (RG-1)
Función pura O(n puntos), sin asignaciones por llamada salvo el cálculo de longitudes.
