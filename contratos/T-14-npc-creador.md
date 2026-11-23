# T-14 · Creador de PNJ con la distribución del creador de jugadores

- **Spec:** `character-appearance.md` § NPC creator y § Sidekick classes; `frontend-screens.md` § 10 y § 17.
- **Decisiones:** D-0002, D-0040, D-0041. **Célula:** `npc`. **Bloqueada por:** T-12, T-13.

## Alcance

Página nueva `frontend/src/pages/NPCCreator.tsx` en `/campaign/:campaignId/gm/npcs/new` y
`/campaign/:campaignId/gm/npcs/:npcId/edit` (dentro de `GMGuard`), que reutiliza los componentes de
`frontend/src/components/character/creator/` (escenario, paneles de razas y clases, personalización, barra inferior) con un
modo PNJ. El botón "Añadir NPC" de la lista y "Editar NPC" del detalle llevan al creador. Las tarjetas de la lista y el
detalle muestran el avatar pixel. `npcApi` envía y recibe `race`, `class` y `appearance`.

## Estructura accesible (lo que fijan los tests)

Las mismas regiones que el creador de jugadores ("Razas", "Escenario", "Clases", "Personalización", navegación
"Acciones del creador"). En "Clases": un `group` **"Compañeros"** con las clases sidekick y un botón **"Sin clase"**. Pasos:
**Origen → Personalización → Estadísticas → Detalles**. En Estadísticas: inputs con nombre Fuerza, Destreza, Constitución,
Inteligencia, Sabiduría, Carisma, "Clase de armadura", "Puntos de golpe", "Velocidad". En Detalles: "Nombre", "Oficio o rol",
grupo "Relación" (Aliado, Neutral, Enemigo), "Descripción y notas" y el botón **"Crear PNJ"** (o **"Guardar PNJ"** al editar).

## Criterios de aceptación (`frontend/src/pages/__tests__/NPCCreator.test.tsx`, jsdom)

1. **C1 Distribución:** existen las regiones del creador; "Clases" incluye el grupo "Compañeros" con las tres clases sidekick
   y el botón "Sin clase".
2. **C2 Crear:** elegir Halfling + Warrior Sidekick, cambiar el peinado, escribir estadísticas, nombre "Pip", rol y relación
   Aliado, y pulsar "Crear PNJ" → `npcApi.create` recibe `race`, `class`, `appearance` (con el peinado elegido), `status: 'ally'`,
   `stats` con las seis características, CA, PG y velocidad.
3. **C3 Sin clase:** con "Sin clase" el escenario muestra el avatar sin aura y `class` se envía vacío.
4. **C4 Prellenado:** la velocidad de la raza y los PG sugeridos (dado de golpe + mod CON, o 4 + mod CON sin clase) aparecen en
   Estadísticas si el GM no los escribió.
5. **C5 Editar:** con un PNJ existente, la ruta de edición prellena raza, clase, apariencia, estadísticas y detalles; "Guardar PNJ"
   llama a `npcApi.update` con los cambios.
6. **C6 Lista y detalle:** la lista de PNJ muestra el recorte de cabeza (`img` "Retrato de …") de un PNJ con apariencia y el
   retrato subido o las iniciales para uno antiguo; "Añadir NPC" navega a `/gm/npcs/new`.
7. **C7 Avatar persistente:** el `img` del escenario es el mismo nodo en los 4 pasos.

## Revisión visual (puerta del revisor)

Capturas a 1440×900 y 390×844 de los 4 pasos (con un sidekick elegido), de la lista con PNJ nuevos y antiguos, y del detalle.
Rúbrica U1–U6 del contrato T-5.
