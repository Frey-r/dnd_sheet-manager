# T-18 · Datos, API y reloj de rutas; PNJ de la campaña en el mapa

- **Spec:** `vtt-npc-routines.md` §1–§3, §7, §8. **Decisiones:** D-0057, D-0059, D-0060. **Célula:** `vtt`. **Bloqueada por:** T-17.

## Alcance
`migrations/032_npc_routines.sql`; `domain.VTTToken` (+ `npc_id`, `disposition`, `route`, `route_paused`, `route_elapsed_ms`,
`route_started_at`, y de solo lectura `npc_appearance`, `npc_status`, `route_clock`); repositorio (listado con LEFT JOIN a
`campaign_npcs`); handlers `PUT …/tokens/:id/route`, `POST …/route/{pause,resume,restart}`; creación de token con `npc_id`;
servicio de reloj (congelar/reanudar) enganchado a: pausa del GM, arrastre manual, combate (inicio/fin), cambio de modo o
activación de escena, cambio de velocidad o ritmo.

## Criterios de aceptación
1. **A1** Crear token con `npc_id` de la campaña copia nombre/imagen; `npc_id` de otra campaña → 400.
2. **A2** `EffectiveDisposition`: vinculado sigue `status` (enemy/neutral/ally → hostile/neutral/friendly); suelto usa la columna; defaults por `kind`.
3. **A3** `PUT route` válido coloca el token en P0 y deja el reloj en 0 (corriendo si la escena está activa en exploración); inválido → 400; token `pc` → 400; no GM → 403; `null` quita la ruta.
4. **A4** `ClockElapsed(token, now)` y las transiciones `Freeze/Resume` (puras) cumplen el ejemplo del spec (congelar a los 7 s, reanudar 2 min después sigue en 7 s).
5. **A5** Arrastrar un token con ruta lo pausa; `resume` reanuda; `restart` vuelve a P0 y reloj 0.
6. **A6** Errores por el punto único de `respond`/mapeo (L recursos-campana-errores): nunca texto de la base.
