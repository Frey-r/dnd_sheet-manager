# T-3 · Atuendos HD-2D (10 atuendos en la pose de reposo)

- **Spec:** `openspec/specs/character-appearance.md` § Art direction → Shading, Capes and robes; § Data model (ids 0–9).
- **Decisiones:** D-0001, D-0003. **Célula:** `sprite`. **Bloqueada por:** T-1.

## Alcance

Redibujar los 10 atuendos de `frontend/src/lib/avatar/sprites/outfits.ts` sobre el cuerpo de T-1, con capas de ropa,
pliegues de 3–4 tonos, ribetes dorados o metálicos, cinturones y hebillas, y capas o faldones en el segundo color.
Nombres e ids iguales (`OUTFITS`). Sin cambios de firmas públicas.

## Criterios de aceptación (tests, entorno node)

Base: `v = resolveRaceVisual('Human')`, `a = { ...defaultAppearance(v), hair: 1, outfit: o, outfitColors: [P, S] }` con
`P = '#2e4a7a'` y `S = '#d9b26f'` salvo que se diga otra cosa.

1. **O1 Encaje:** cada atuendo × complexión 0/1 × talla S/D/M/L: la figura (sin prop) cabe con ≥ 1 px de margen y
   `feetRow === 53`.
2. **O2 Distintos:** cada par de atuendos difiere en ≥ 30 píxeles (mismos colores y pelo).
3. **O3 Dos colores:** en cada atuendo hay ≥ 40 píxeles cuyo color pertenece a `ramp(P)` y ≥ 10 a `ramp(S)`
   (`ramp` de `lib/avatar/color.ts`, comparando con la rampa completa).
4. **O4 Detalle:** cada atuendo tiene ≥ 6 píxeles `trim`.
5. **O5 Luz:** en las filas del torso (desde `head.y + head.h` hasta `figure.y + round(figure.h × 0.62)`), la luminancia
   media de los píxeles `cloth` de la mitad izquierda de la figura es mayor que la de la mitad derecha.
6. **O6 Invariantes de T-1:** C7 (contorno completo) y C8 (≤ 40 colores) con cada atuendo y cada prop.
7. **O7 Cobertura total:** las 960 combinaciones pelo 0–11 × atuendo 0–9 × complexión × talla se renderizan sin
   excepción en ≤ 2,5 s en total.

## Presupuesto de recursos (RG-1)

Igual que T-1.

## Revisión visual

`node frontend/scripts/avatar-sheet.mjs --set outfit --scale 3` y `--set gallery --scale 2` junto a las referencias:
rúbrica R5 (ropa con detalle) y R2 (torso sólido) con ≥ 4.
