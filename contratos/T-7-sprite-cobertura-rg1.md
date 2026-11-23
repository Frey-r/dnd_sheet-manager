# T-7 · Sprite: plantillas compiladas una vez y cobertura de proporción y "nada flota"

- **Origen:** evaluación TR-0013 (M2, M3, E-0006), E-0002 a E-0005, lección L-0001.
- **Spec:** `openspec/specs/character-appearance.md` § Art direction (Figure and proportions; Race families: ninguna parte
  flota). **Decisiones:** D-0013, D-0021, D-0022, D-0025. **Células:** `sprite` y `razas`. **Bloqueada por:** T-1..T-4.

## Alcance

`frontend/src/lib/avatar/sprites/body.ts`, `sprites/features.ts`, `sprites/hair.ts` (código muerto) y, si hace falta
para medir, `frontend/src/lib/avatar/painter.ts` o `metrics.ts` (un contador o una consulta de la caché de plantillas
para tests, sin coste en producción). Tests nuevos en `frontend/src/lib/avatar/__tests__/sprite-coverage.test.ts`; los
tests de T-1..T-4 siguen bloqueados.

## Criterios de aceptación (tests, entorno node)

1. **K1 Plantillas una vez (RG-1.4):** después de renderizar una vez cada familia × opción, un segundo pase completo no
   compila ninguna plantilla nueva (contador o tamaño de caché sin cambios). Hoy falla: `body.ts` (ojos de cabezas no
   humanas y cíclope) y `features.ts` pasan arrays literales a `p.stamp`.
2. **K2 Proporción torso/piernas (spec, E-0005):** humano talla M, complexiones 0 y 1, atuendos 2 y 6 (pantalón):
   de la cadera a la suela 11–12 filas, del cinturón a la suela ≤ 15, del hombro al cinturón 9–11. Las filas se miden
   desde `spriteMetrics` y los tags (`cloth`, `trim`, `skin`), con definiciones escritas en el test.
3. **K3 Nada flota (E-0002..E-0004):** para cada familia × opción × talla (S, M, L), los píxeles que cambian al quitar la
   parte (por lista de partes, no renombrando la clave de familia) son 8-conexos con la silueta del sprite sin esa parte.
4. **K4 Orientación (L-0001):** el centroide de los píxeles de hocico, pico o trompa queda a la izquierda del centro de la
   cara; el de colas y alas, a la derecha de x = 23.
5. **K5 R5 fuerte (E-0006):** quitar una parte de cara en bestias (comparando con la lista de partes, no con otra clave)
   cambia píxeles `face`/`eye`/`part`.
6. **K7 Golden del arte aprobado (E-0008..E-0011):** un test compara el hash (sha256 de `renderPixels`) de un conjunto
   fijo de renders contra un archivo golden versionado (`__tests__/golden/sprites.json`): los 12 peinados × 2 complexiones,
   los 10 atuendos × 2 complexiones, 4 tallas, cada prop, cada familia × opción, con y sin aura. Un cambio de arte rompe
   el golden; se regenera solo con un comando explícito (`UPDATE_GOLDEN=1`) **después** de la aprobación visual del
   revisor, y el regenerado se registra en la tarjeta. Objetivo: `hz mutar` ≥ 0,9 en `hair.ts`, `outfits.ts`,
   `features.ts`, `body.ts`, `props.ts` y `render.ts` (excluyendo mutantes equivalentes justificados).
7. **K8 Familias sin pelo (sobreviviente de `render.ts:32`):** en toda familia con `hair: false` y en las que usan pelo
   elemental, no hay píxeles `hair`/`hair-back` de `hair.ts` (el pelo elemental se etiqueta según D-0024) aunque
   `appearance.hair` sea 1–11.
8. **K6 Código muerto:** `hairTemplate` y cualquier export sin consumidores en `lib/avatar` se elimina (lo verifica
   `tsc`/`knip` o un `rg` documentado en la tarjeta; no requiere test).

## Presupuesto de recursos (RG-1)

Render medio ≤ 1,5 ms; los tests K3 (≈ 1500 renders) en ≤ 5 s.
