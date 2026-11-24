# T-26 · Aplicar la agenda al cambiar el reloj y «Dónde están ahora»

- **Spec:** `npc-agenda.md` §3 y §5 (vista «Dónde están ahora»). **Decisiones:** D-0063, D-0065. **Célula:** `npc`. **Bloqueada por:** T-25.

## Criterios de aceptación (tests con base real)
1. **G1** Con ubicación: deja exactamente una ficha del PNJ en la escena de la entrada (reutiliza, mueve o crea desde la hoja), con `oculto`, posición o ruta (reloj de ruta en 0); borra sus otras fichas.
2. **G2** Ausente: borra todas sus fichas. Sin entrada: no toca nada. PNJ sin agenda y fichas sueltas: nunca se tocan.
3. **G3** Idempotente: reaplicar sin cambios no mueve ni reinicia la ruta.
4. **G4** En combate: el PNJ se salta con motivo; al terminar ese combate se aplica su entrada actual.
5. **G5** Escena borrada: se salta con motivo «escena borrada».
6. **G6** `ChangeClock` guarda el reloj y aplica; el resumen lista creados, movidos, retirados, sin cambios y saltados.
7. **G7** «Dónde están ahora»: por PNJ, escena y estado (en ruta, quieto, pausado, detenido, en combate, ausente, sin agenda) y la entrada del siguiente momento.
