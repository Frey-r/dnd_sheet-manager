# T-22 · Pluma para trazar rutas (reemplaza T-20 F3)

- **Spec:** `vtt-npc-routines.md` §3 y §6 (herramienta «Ruta de PNJ»). **Decisiones:** D-0067 (aprobación), D-0068. **Célula:** `vtt-ui`. **Bloqueada por:** T-20.

## Criterios de aceptación (Vitest)
1. **P1** Las anclas quedan en el píxel exacto del fondo (enteros, sin cuadrícula); el primer clic es P0; un clic repetido en el mismo píxel no duplica.
2. **P2** Doble clic o Intro con ≥ 2 anclas termina un trazado abierto → `onRoute(token, puntos, false)`.
3. **P3** Clic sobre la primera ancla (≤ 10 px de pantalla) con ≥ 3 anclas cierra → `onRoute(token, puntos, true)` sin repetir P0; con menos anclas no cierra.
4. **P4** Retroceso borra el último ancla; Esc cancela; Mayús restringe a múltiplos de 45°.
5. **P5** Arrastrar un ancla de la ruta del PNJ seleccionado la mueve y llama `onRouteEdit(token, puntos)`.
6. **P6** El diálogo de fin de trazado ofrece Ida / Ida y vuelta (abierto) o Ciclo (cerrado), con la espera por punto, y devuelve la ruta; Cancelar la descarta.
7. Se mantienen F5, F6 y la posición viva de T-20.
