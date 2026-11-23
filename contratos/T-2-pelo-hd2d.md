# T-2 · Peinados HD-2D (12 estilos sobre la cabeza nueva)

- **Spec:** `openspec/specs/character-appearance.md` § Art direction → Hair; § Data model (ids 0–11 sin cambios).
- **Decisiones:** D-0001, D-0003. **Célula:** `sprite`. **Bloqueada por:** T-1 (geometría de la cabeza y `renderLayers`).

## Alcance

Redibujar los 12 peinados de `frontend/src/lib/avatar/sprites/hair.ts` para la cabeza de T-1: mechones de 3–5 px,
4 tonos (brillo, claro, base, sombra) con banda de brillo arriba a la izquierda, capa trasera y delantera. Nombres e ids
iguales (`HAIR_STYLES`). Sin cambios de firmas públicas.

## Criterios de aceptación (tests, entorno node)

Base: `v = resolveRaceVisual('Human')`, talla M, complexión 0 y 1, `a = { ...defaultAppearance(v), hair: s }`.
`skull` = `spriteMetrics` con `hair: 0` (calvo): su `head`. Filas de la cabeza = filas `y ≤ face.y + face.h − 1`.

1. **H1 Tamaño:** para s = 1–11, en las filas de la cabeza los píxeles `hair`/`hair-back` cumplen
   `skull.x − 3 ≤ x ≤ skull.x + skull.w + 2` y `y ≥ skull.y − 4`. Los estilos largos (3 Coleta, 5 Largo, 6 Trenza,
   8 Melena, 10 Dos coletas, 11 Ondas) pueden caer por debajo de la barbilla, nunca más abajo que la fila de la cadera
   (`figure.y + round(figure.h × 0.62)`).
2. **H2 Distintos:** cada par de estilos difiere en ≥ 12 píxeles de la máscara de pelo.
3. **H3 Tonos y luz:** cada estilo 1–11 usa ≥ 4 colores distintos en píxeles `hair`; el tono más claro de pelo aparece
   más veces en la mitad izquierda del bbox `hair` que en la derecha.
4. **H4 Cara visible:** para todo estilo, `eyes.length === 2` y `face.w ≥ 7` (el flequillo nunca tapa los ojos).
5. **H5 Calvo:** s = 0 no tiene píxeles `hair` ni `hair-back` y `hair === null`.
6. **H6 Invariantes de T-1:** C4, C7 (contorno completo) y C8 (≤ 40 colores) se cumplen con cada estilo.
7. **H7 Colores de pelo:** cada uno de los 12 colores de `HAIR` produce una rampa con ≥ 4 tonos distintos en el sprite.

## Presupuesto de recursos (RG-1)

Igual que T-1: plantillas compiladas una vez; render ≤ 1,5 ms de media con cualquier estilo.

## Revisión visual

`node frontend/scripts/avatar-sheet.mjs --set hair --scale 3` junto a las referencias: rúbrica R4 (mechones con brillo,
tamaño acorde a la cabeza) y R3 (la cara se lee) con ≥ 4.
