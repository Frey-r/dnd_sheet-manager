# T-1 · Sprite base HD-2D: cuerpo, cabeza humana, cara, contorno, métricas y props

- **Spec:** `openspec/specs/character-appearance.md` § Art direction (fuente de verdad).
- **Decisiones:** D-0001 (estilo Octopath / Triangle Strategy), D-0003 (modelo de datos v1 sin cambios).
- **Célula:** `sprite` · **Error que corrige:** E-0001.
- **Referencias de estilo:** `sprites ideas/ejemplo sprites.png` (escala ~3×) y `sprites ideas/ejemplo sprites 2.png` (escala 2×).
  Solo se toma el estilo: grilla, figura, proporciones, construcción de la cara y técnica de sombreado. No se calca
  ningún personaje, traje ni píxel. Las imágenes nunca entran al repo.

## Alcance

Rehacer la base del sprite en `frontend/src/lib/avatar/` (`painter.ts`, `render.ts`, `color.ts`, `sprites/body.ts`,
`sprites/props.ts`, `sprites/context.ts`, nuevo `metrics.ts`, `index.ts`): geometría canónica (`CANON`, seams de tamaños),
cuerpo de 4 tamaños × 2 complexiones, cabeza humana y cara, rampas de color, contorno completo y props de clase en la
pose nueva. El pelo (T-2), los atuendos (T-3) y las partes raciales (T-4) se adaptan en sus tareas, pero **nada puede
lanzar excepciones** mientras tanto: los estilos viejos pueden verse desalineados hasta T-2 y T-3.

## Firmas

```ts
// frontend/src/lib/avatar/metrics.ts (nuevo; reexportado desde lib/avatar/index.ts)
export interface Box { x: number; y: number; w: number; h: number }
export type Tag = 'hair' | 'hair-back' | 'face' | 'skin' | 'eye' | 'cloth' | 'trim' | 'flow' | 'prop' | 'part' | 'shade' | 'outline' | 'aura';
export interface SpriteLayers {
  px: Uint8ClampedArray;      // RGBA 48×56, idéntico a renderPixels(a, v, aura, prop)
  tags: (Tag | null)[];       // una etiqueta por píxel (null = transparente)
}
export interface SpriteMetrics {
  figure: Box;                // bbox de los píxeles opacos sin prop ni aura (contorno incluido)
  head: Box;                  // bbox de la cabeza: piel de la cabeza ('face'), ojos y pelo por encima de la barbilla
  face: Box;                  // bbox de la piel visible de la cara ('face' por debajo del flequillo, sin orejas)
  eyes: Box[];                // un box por ojo visible, de izquierda a derecha
  hair: Box | null;           // bbox de 'hair' + 'hair-back' (null si calvo)
  feetRow: number;            // última fila con píxeles de bota (sin contorno)
}
export function renderLayers(a: Appearance, v: RaceVisual, aura?: string | null, prop?: Prop | null): SpriteLayers;
export function spriteMetrics(a: Appearance, v: RaceVisual): SpriteMetrics;

// render.ts: firmas sin cambios (consumidores: PixelAvatar, TableCanvas, CombatBoard, scripts/avatar-sheet.mjs)
export const AVATAR_W = 48, AVATAR_H = 56;
export function renderPixels(a, v, aura?, prop?): Uint8ClampedArray;   // = renderLayers(...).px
export function cropRect(v, a, crop: 'full' | 'bust'): Rect;           // bust: 24×24
export function propForClass(klass?: string | null): Prop | null;      // mismo mapeo de clases
```

Vocabulario de etiquetas: `face` = piel de la cabeza (cara y orejas humanas); `skin` = piel del cuerpo (cuello, manos);
`eye` = pestaña, pupila, iris y brillo; `cloth` = tela del atuendo; `trim` = ribetes, cinturones, hebillas y metal;
`flow` = capas y faldones; `outline` = contorno exterior agregado al final; `aura` = aura de clase.

## Criterios de aceptación (tests en `frontend/src/lib/avatar/__tests__/`, entorno node)

Base: `v = resolveRaceVisual('Human')`, `a = { ...defaultAppearance(v), hair: 1 }` salvo que se diga otra cosa.
Luminancia = luminancia relativa sRGB (0–1).

1. **C1 Figura:** talla M, complexión 0 y 1, atuendos 0–9 → `figure.h ∈ [44, 50]` y `figure.w ∈ [24, 34]`.
2. **C2 Cabeza:** pelo 0 y 1 → `head.h ∈ [16, 19]`, `head.h / figure.h ∈ [0.33, 0.42]`, `head.w ∈ [14, 18]`.
3. **C3 Cara:** `face.w ∈ [8, 11]`.
4. **C4 Ojos:** `eyes.length === 2`; cada ojo `w ∈ [1, 2]` y `h ∈ [2, 3]`; separación
   `eyes[1].x − (eyes[0].x + eyes[0].w) ∈ [2, 4]`; ambos con `y ≥ head.y + head.h / 2`.
5. **C5 Pies:** `feetRow === 53` en las 8 combinaciones talla × complexión.
6. **C6 Tallas:** para S, D, M, L × complexión 0/1: la figura cabe en el lienzo con ≥ 1 px de margen por lado;
   `h(S) < h(D) ≤ h(M) < h(L)`; `w(D) ≥ w(M)`; `head.h` idéntico en todas las tallas.
7. **C7 Contorno completo:** con cada prop (`staff, sword, axe, bow, dagger, mace, lute, hammer`) y sin prop, sin aura:
   todo píxel opaco con un vecino-4 transparente o fuera del lienzo tiene luminancia ≤ 0.25. Cero excepciones.
8. **C8 Paleta:** colores opacos distintos ≤ 40 por sprite (con prop, sin aura) en las 12 combinaciones de la galería de
   `scripts/avatar-sheet.mjs --set gallery`.
9. **C9 Recorte de cabeza:** `cropRect(v, a, 'bust')` es 24×24, cabe en el lienzo, contiene `face` y los dos ojos, y el
   centro de `face` está a ±3 px del centro horizontal del recorte.
10. **C10 Prop:** para cada prop, el sprite con prop difiere del sprite sin prop y ≥ 80 % de los píxeles `prop` están en
    `x ≥ 24` (mano cercana, a la derecha del espectador).
11. **C11 Luz:** la luminancia media de los píxeles `face` de la mitad izquierda de `face` es ≥ la de la mitad derecha.
12. **C12 Determinismo:** dos renders iguales devuelven bytes idénticos; `renderLayers(...).px` es igual a `renderPixels(...)`.
13. **C13 Rendimiento:** 500 renders variados (tallas, complexiones, props) en ≤ 750 ms en node (≤ 1,5 ms de media).

## Presupuesto de recursos (RG-1)

- `renderPixels` ≤ 1,5 ms de media; por render solo se reservan buffers de tamaño W×H (máx. 4).
- Las plantillas de texto se compilan una vez, a nivel de módulo o de forma perezosa con caché (RG-1.4); nunca por render.
- `avatarCanvas` mantiene su caché acotada (≤ 400 entradas). `spriteMetrics` y `renderLayers` son para tests y
  herramientas; la UI no los llama por frame.

## Revisión visual (puerta del revisor, además de los tests)

`node frontend/scripts/avatar-sheet.mjs --set gallery --scale 2` junto a `ejemplo sprites 2.png` y `--scale 3` junto a
`ejemplo sprites.png`. Cada punto se puntúa de 1 a 5 y todos necesitan ≥ 4:
R1 tamaño de grilla y figura · R2 proporciones (~3 cabezas, torso sólido) · R3 cara pequeña y simple (ojos 1–2 px) ·
R4 pelo en mechones con banda de brillo · R5 ropa con detalle, capas y ribetes · R6 contorno completo + contornos internos ·
R7 pose de reposo frontal 3/4, pies plantados · R8 legible a 1× y en el recorte 24×24 de fichas y tokens.
