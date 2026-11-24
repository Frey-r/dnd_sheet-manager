# T-30 · Pluma como la de Photoshop (frontend)

- **Spec:** `vtt-npc-routines.md` §6 (herramienta «Ruta de PNJ»). **Decisión:** D-0070. **Célula:** `vtt-ui`. **Bloqueada por:** T-29.

## Criterios de aceptación (Vitest)
1. **W1** Banda elástica curva: si el último ancla tiene `out`, el tramo al cursor se dibuja con `bezierCurveTo`.
2. **W2** Cerrar con arrastre sobre la primera ancla: le pone `out` en el cursor e `in` simétrico y cierra el ciclo al soltar.
3. **W3** Alt durante el arrastre de un ancla nueva: solo se mueve `out`; `in` se queda.
4. **W4** Mayús durante el arrastre de un manejador: ángulo a múltiplos de 45°.
5. **W5** Clic sobre el trazado añade un ancla (recta: en la proyección; curva: De Casteljau, misma forma).
6. **W6** Clic sobre un ancla intermedia la borra; no baja de 2 anclas (abierta) ni de 3 (ciclo).
7. **W7** Clic sobre el último extremo de una ruta abierta continúa el trazado; desde el primero, la invierte.
8. **W8** Alt+clic en ancla suave → esquina; Alt+arrastrar desde esquina → manejadores simétricos.
9. Se mantienen los tests de T-20, T-22 y T-29.
