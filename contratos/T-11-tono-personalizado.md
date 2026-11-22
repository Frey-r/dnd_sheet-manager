# T-11 · El tono de piel personalizado se respeta al dibujar

- **Origen:** E-0015 (pedido del usuario). **Decisión:** D-0034. **Spec:** `character-appearance.md` § Data model
  (APP-10 corregido). **Célula:** `creador`. **Bloqueada por:** T-6.

## Alcance

`frontend/src/components/avatar/PixelAvatar.tsx`, `frontend/src/components/vtt/TableCanvas.tsx`,
`frontend/src/pages/EditAppearance.tsx` y el comentario de `normalizeAppearance` en `frontend/src/lib/avatar/types.ts`.
El cambio de raza en el creador (`creator/look.ts`) **sigue** reseteando la piel a la de la familia nueva.

## Criterios de aceptación (tests nuevos)

`frontend/src/pages/__tests__/CustomSkin.test.tsx` (jsdom) y/o `frontend/src/lib/avatar/__tests__/custom-skin.test.ts`:

1. **P1 Dibujo:** `PixelAvatar` con una apariencia cuya piel es un hex válido fuera de la paleta de la raza dibuja esa piel
   (el `normalizeAppearance` usado para dibujar conserva la piel; se verifica con un espía sobre `avatarCanvas` o sobre la
   apariencia que recibe).
2. **P2 Creador:** en Personalización, elegir un color personalizado en "Piel" (input `type="color"`) cambia la apariencia
   del escenario a ese color y `characterApi.create` lo recibe.
3. **P3 Editor:** `EditAppearancePage` con una apariencia guardada con piel personalizada muestra y guarda esa piel sin
   reemplazarla.
4. **P4 Cambio de raza:** elegir otra raza de distinta familia en el creador sigue reseteando la piel a la de la familia
   nueva (no regresión de D-0027).
5. **P5 VTT:** el token del VTT dibuja la piel personalizada (TableCanvas sin `strictSkin`).
