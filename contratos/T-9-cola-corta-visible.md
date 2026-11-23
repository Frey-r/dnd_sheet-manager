# T-9 · Cola corta (`tail-stub`) visible en todas las tallas

- **Origen:** E-0014: `tail-stub` queda tapada por el cuerpo (harengon talla S; también gnoll, cervan y satyr según talla y
  complexión). **Spec:** `character-appearance.md` § Race families (colas por detrás, a la derecha; nada flota).
- **Decisiones:** D-0025, D-0026 (golden), L-0001. **Célula:** `razas`. **Bloqueada por:** T-8.

## Alcance

`frontend/src/lib/avatar/sprites/features.ts` (solo `tail-stub`). Es un cambio de arte: el golden de T-7
(`__tests__/golden/sprites.json`) se regenera con `UPDATE_GOLDEN=1` **después** de la aprobación visual del revisor, y esa
regeneración queda registrada como decisión (el bloqueo del golden en T-7 queda superado por esta tarea).

## Criterios de aceptación (`frontend/src/lib/avatar/__tests__/sprite-tail-stub.test.ts`, entorno node)

Para cada familia cuya `base` incluye `tail-stub` (harengon, gnoll, cervan, satyr), tallas S, D, M, L y complexiones 0 y 1:

1. **S1 Visible:** el render difiere del mismo render sin `tail-stub` (misma familia con la parte quitada de `base`) en
   ≥ 4 píxeles.
2. **S2 Detrás y a la derecha:** todos esos píxeles están a la derecha del centro del cuerpo (x > 23) y por debajo de la
   cintura (y ≥ `figure.y + round(figure.h × 0.55)`).
3. **S3 Pegada:** los píxeles que cambian son 8-conexos con la silueta del sprite sin la cola.

## Presupuesto de recursos (RG-1)

Sin cambios: plantilla como constante de módulo (K1 de T-7 sigue en verde).
