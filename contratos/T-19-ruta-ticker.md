# T-19 · Ticker de rutas y detección hostil

- **Spec:** `vtt-npc-routines.md` §2, §4. **Decisiones:** D-0058, D-0059. **Célula:** `vtt`. **Bloqueada por:** T-18.

## Criterios de aceptación
1. **K1** Con rutas corriendo, cada tick guarda las posiciones calculadas en una sola sentencia por escena.
2. **K2** Sin rutas corriendo, el tick hace una sola consulta (índice parcial) y nada más.
3. **K3** Un PNJ móvil hostil con `detects` que llega a ver a un jugador quieto inicia el encuentro (y congela su reloj); uno neutral o amistoso no.
4. **K4** La detección cuando se mueve el jugador (`checkTriggers`) ignora tokens no hostiles.
5. **K5** No se emite `vtt.token.moved` por pasos de ruta; sí `vtt.route.updated` al congelar/reanudar.
