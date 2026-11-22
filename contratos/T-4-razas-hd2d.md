# T-4 · Partes raciales y cabezas no humanas HD-2D

- **Spec:** `openspec/specs/character-appearance.md` § Art direction → Face (non-human heads); § Race families.
- **Decisiones:** D-0001, D-0003. **Célula:** `razas`. **Bloqueada por:** T-1.

## Alcance

Adaptar `frontend/src/lib/avatar/sprites/features.ts` (orejas, cuernos, colas, alas, barbas, crestas, aletas, pelo
elemental, halos, marcas…) y las cabezas no humanas (hocico, pico, reptil, elefante, insecto, calavera, pez, rana, limo)
a la cabeza y el cuerpo de T-1, en vista frontal 3/4 mirando a la izquierda del espectador, con el mismo contorno
y la misma escala de ojos. Las partes se etiquetan `part`. Sin cambios en `races.ts` salvo que una familia lo exija.

## Criterios de aceptación (tests, entorno node)

Para cada `key` de `ALL_FAMILY_KEYS` y cada opción `feature` de su familia (`visualByKey(key)`, `defaultAppearance`):

1. **R1 Sin excepciones y dentro del lienzo:** se renderiza; la figura (sin prop ni aura) cabe con ≥ 1 px de margen.
2. **R2 Contorno:** C7 de T-1 (contorno completo, luminancia ≤ 0.25) se cumple.
3. **R3 Ojos humanoides:** en familias con `head === 'human'`, C4 de T-1 se cumple (2 ojos de 1–2 × 2–3 px).
4. **R4 Ojos no humanos:** en las demás cabezas hay ≥ 1 ojo y cada ojo mide `w ≤ 2` y `h ≤ 3`; `head.h ∈ [14, 22]`.
5. **R5 Partes visibles:** si `base` + `options[feature].parts` no está vacío, hay > 0 píxeles `part` (salvo partes
   que son solo de cara: `freckles`, `scar`, `mark`, `tattoo`, `glow-eyes`, `shadow`, que cambian píxeles `face`/`eye`).
6. **R6 Opciones distintas:** en familias con ≥ 2 opciones, cada par de opciones difiere en ≥ 4 píxeles.
7. **R7 Paleta:** ≤ 40 colores opacos por sprite (sin aura).

## Presupuesto de recursos (RG-1)

Igual que T-1; todas las familias × opciones (≈ 250 sprites) en ≤ 1 s.

## Revisión visual

`node frontend/scripts/avatar-sheet.mjs --set races --scale 2`: rúbrica R1–R8 con ≥ 4 en las familias comunes
(`COMMON_RACES`) y ≥ 3 en el resto.
