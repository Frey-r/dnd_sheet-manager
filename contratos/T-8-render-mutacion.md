# T-8 · `render.ts`: sin condiciones redundantes y caché de colores observable

- **Origen:** `hz salida --rol verificador` de T-1 y T-7: `render.ts` detecta 7/10 mutantes (umbral 0,9). Sobreviven
  76:23 (cota de `rgbaCache`), 111:29 (límites de fila redundantes en `outline`) y 131:38 (vecindario simétrico del aura,
  equivalente en cualquier implementación). **Célula:** `sprite`. **Bloqueada por:** T-7.

## Alcance

`frontend/src/lib/avatar/render.ts` (y su reexport en `metrics.ts`). Sin cambios de arte: el golden de T-7 queda idéntico.

## Firmas

```ts
// render.ts, reexportado en metrics.ts (API de tests y herramientas, sin coste en producción)
export function rgbaCacheSize(): number;
```

## Criterios de aceptación (`frontend/src/lib/avatar/__tests__/render-cache.test.ts`, entorno node)

1. **M1 Caché que retiene:** tras renderizar un aspecto, `rgbaCacheSize()` es ≥ que la cantidad de colores opacos
   distintos de ese render (la caché no se vacía en cada inserción).
2. **M2 Caché acotada:** tras renderizar aspectos con ≥ 5000 colores personalizados distintos, `rgbaCacheSize()` ≤ 4097.
3. **M3 Sin regresión:** el golden de T-7 y la suite del avatar siguen en verde.
4. `outline` y `aura` no comprueban límites que no cambian el resultado (las filas fuera de rango se leen como vacías);
   `hz mutar --archivo frontend/src/lib/avatar/render.ts` ≥ 0,9.

## Presupuesto de recursos (RG-1)

Render medio ≤ 1,5 ms; caché ≤ 4097 entradas (≈ 100 KB).
