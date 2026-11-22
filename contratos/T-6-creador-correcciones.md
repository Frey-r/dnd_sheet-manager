# T-6 · Correcciones del creador tras la revisión (ronda de mejora)

- **Origen:** E-0007 (calvo tras una raza sin pelo), evaluación TR-0013 (M1 y menores), capturas finales de T-5.
- **Spec:** `openspec/specs/character-appearance.md` § Creation wizard; § Rendering (escalas enteras en lugares de tamaño fijo).
- **Decisiones:** D-0002, D-0003, D-0007, D-0008, D-0016. **Célula:** `creador`. **Bloqueada por:** T-5.

## Alcance

`frontend/src/pages/CreateCharacter.tsx`, `frontend/src/components/character/creator/*` y `frontend/src/index.css`
(sección `.cc-*`). Además, de forma mínima, los retratos de `frontend/src/pages/CampaignHub.tsx` y
`frontend/src/pages/CharacterSheet.tsx` para usar escala entera. Los tests de T-5 siguen bloqueados; los nuevos van en un
archivo aparte.

## Criterios de aceptación (tests nuevos en `frontend/src/pages/__tests__/CreateCharacter.fixes.test.tsx`)

1. **F1 Cambio de raza sin pelo → con pelo:** con una raza de familia sin pelo (fixture Tabaxi o Dragonborn) y después
   Elf, la fila "Peinado" muestra el peinado por defecto de la familia nueva (no "Calvo") y "Color de pelo" muestra un
   color de `HAIR`, no el acento anterior. `characterApi.create` recibe ese `hair` y ese `hairColor`.
2. **F2 Color por defecto de la familia:** al pasar a una familia que fija `defaults.hairColor` (por ejemplo Drow), el
   color de pelo pasa a ese valor salvo que el jugador ya haya elegido uno a mano en esa sesión (regla documentada en una
   decisión).
3. **F3 Acento y rasgo racial:** con una raza sin pelo, la fila de color se llama como `visual.accentLabel`
   (o "Color de acento"); con una raza de una sola opción racial no aparece el grupo "Rasgo racial".
4. **F4 Teclado del popover:** "elegir color" abre el `listbox`; las flechas mueven la opción activa (roving tabindex o
   `aria-activedescendant` coherente), Enter la elige y Escape cierra devolviendo el foco al botón. `aria-controls` apunta
   al `listbox`. Cada `option` tiene nombre accesible propio.
5. **F5 Sin redibujos ocultos (RG-1):** en el paso Personalización, cambiar el peinado no vuelve a dibujar los previews
   del toggle de complexión ni las miniaturas de raza (el panel oculto no se re-renderiza o lo hace sin crear canvases).
   Se mide con un espía sobre `avatarCanvas` o sobre el componente de preview.

6. **F6 Mutación de `RacePanel.tsx` (E-0012):** tests que maten los sobrevivientes reportados por el verificador
   (búsqueda que filtra, orden comunes primero, select de versión, toggle de complexión que cambia las miniaturas, raza
   activa al volver a Origen). Objetivo: `hz mutar --archivo frontend/src/components/character/creator/RacePanel.tsx`
   ≥ 0,9 y lo mismo para los archivos del creador que toque T-6.

## Criterios visuales (puerta del revisor)

- "Tasha's Custom Lineage" y nombres largos sin cortes con guion en mitad de palabra (sin `hyphens: auto`).
- En móvil, en Personalización, el escenario fijo usa al menos ×4 y una raza baja (Dwarf, Halfling) se ve de tamaño legible.
- Retratos del hub de campaña y de la ficha a **escala entera** (sin ×2,34 ni ×1,34).
- Halfling y Gnome (y en general las razas comunes contiguas) no comparten peinado y color de pelo en la grilla.

## Presupuesto de recursos (RG-1)

Igual que T-5; ningún canvas nuevo por clic de personalización fuera del avatar del escenario y la ficha.
