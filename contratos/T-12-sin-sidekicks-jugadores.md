# T-12 · Sin clases sidekick en el creador de jugadores

- **Spec:** `character-appearance.md` § Sidekick classes. **Decisión:** D-0040. **Célula:** `creador`. **Bloqueada por:** T-11.

## Firmas

```ts
// frontend/src/components/character/creator/catalog.ts
export function isSidekickClass(name: string | null | undefined): boolean; // /sidekick|compa(ñ|n)ero/i sobre el nombre base
```

## Criterios de aceptación (`frontend/src/pages/__tests__/CreateCharacter.sidekick.test.tsx` y test unitario de `isSidekickClass`)

1. **K1 Detección:** `isSidekickClass` reconoce "Expert Sidekick", "Spellcaster Sidekick (Tasha's Cauldron of Everything)",
   "Warrior Sidekick" y "Compañero guerrero"; no reconoce Fighter, Wizard, Rogue, "Blood Hunter" ni null.
2. **K2 Creador de jugadores:** con un catálogo que incluye las tres clases sidekick (con y sin libro), la región "Clases"
   no muestra ninguna; el contador de clases las excluye; el resto de clases sigue igual.
