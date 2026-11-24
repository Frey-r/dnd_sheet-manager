# T-24 · Hoja de combate, PG en el PNJ e inventario (backend)

- **Spec:** `npc-agenda.md` §3 (PG en el PNJ), §5 (hoja de combate, inventario), §7 (migración 033). **Decisiones:** D-0065, D-0066. **Célula:** `npc`. **Bloqueada por:** —.

## Criterios de aceptación
1. **H1** `NormalizeNPCCombat`: valores por defecto (10 PG, CA 10, 30 pies, percepción 10, tamaño 1), límites y tipos; `max_hp` ≥ `hp`; error con el campo culpable. Crear/editar un PNJ valida `stats.combat` (400).
2. **H2** Colocar un PNJ en el mapa copia su hoja de combate a la ficha.
3. **H3** Las fichas con `npc_id` muestran los PG del PNJ (`hp_current` o la hoja); editar los PG de esa ficha los escribe en el PNJ (todas sus fichas lo ven).
4. **H4** Bolsa: sumar, restar o fijar; nunca negativa (409 con mensaje).
5. **H5** Objetos: `equipped` se guarda; un objeto `home` nunca queda equipado.
6. **H6** Entregar objeto: atómico; resta cantidad (borra a 0) y crea el objeto en el inventario del personaje con su valor; más cantidad de la que tiene → 409; personaje de otra campaña → 404.
7. **H7** Entregar monedas: atómico; resta de la bolsa y suma al monedero del personaje en po/pp/pc; sin fondos → 409.
8. **H8** Migración 033 con Up/Down de reloj, agenda, `hp_current`, `purse_cp` y `equipped`.
