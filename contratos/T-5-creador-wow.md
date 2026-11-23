# T-5 · Creador de personajes con distribución de World of Warcraft

- **Spec:** `openspec/specs/character-appearance.md` § Creation wizard (World of Warcraft layout); `characters.md` § creación.
- **Decisiones:** D-0002 (layout WoW), D-0003 (modelo de datos sin cambios), D-0004 (Vitest). **Célula:** `creador`.
- **Independiente del arte:** consume `PixelAvatar` y `lib/avatar` con sus firmas actuales; el sprite cambia en paralelo (T-1..T-4).

## Alcance

Reestructurar `frontend/src/pages/CreateCharacter.tsx`, `frontend/src/pages/EditAppearance.tsx` y
`frontend/src/components/character/creator/*`, con estilos en `frontend/src/index.css` (tokens del design system,
`openspec/specs/design-system.md`; sin colores hex en componentes salvo los del avatar). Puede crear
`frontend/src/lib/avatar/emblems.ts` (emblemas pixel 16×16 de cada prop de clase: staff, sword, axe, bow, dagger, mace,
lute, hammer, monje = puño, sin clase = gema) usando `propForClass` y `ramp`. **No toca** el resto de `lib/avatar/`
(propiedad de la célula `sprite`) ni `lib/avatar/index.ts`.

Pasos (`STEPS`): **Origen** (raza + clase) → **Personalización** → **Características** → **Detalles**.

## Estructura accesible (lo que fijan los tests)

| Elemento | Selector accesible |
|---|---|
| Columna izquierda | `region` con nombre **"Razas"**; dentro, `group` **"Tipo de cuerpo"** con 2 botones `aria-pressed` (Complexión ancha, Complexión esbelta), **antes** (orden DOM) que el input **"Buscar raza"** y los botones de raza (nombre = raza base, `aria-pressed`) |
| Escenario | `region` **"Escenario"** con el avatar (`img` "Retrato de …") y el texto `"<Raza> · <Clase>"` (`"Raza · Clase"` sin elegir) |
| Columna derecha | `region` **"Clases"** con botones de clase (nombre = clase base, `aria-pressed`), cada uno con un emblema pixel decorativo |
| Detalle | rasgos de la raza y competencias de la clase legibles en Origen (`RaceDetail` / `ClassDetail` o equivalente) |
| Personalización | `region` **"Personalización"**; por opción un `group` con su etiqueta (**Tipo de cuerpo, Piel, Ojos, Peinado, Color de pelo** —o la etiqueta de acento de la raza—, **Rasgo racial** si la raza tiene > 1 opción, **Atuendo, Color principal, Color secundario**), con botones **"<Etiqueta>: anterior"** y **"<Etiqueta>: siguiente"** y el valor actual visible; las filas de color tienen un botón **"<Etiqueta>: elegir color"** que abre un `listbox` de muestras (`option` por color, `aria-selected`) más el selector de color personalizado; botón **"Aleatorio"**; vista previa del recorte de cabeza (`img` con nombre que contiene "ficha") |
| Barra inferior | `navigation` **"Acciones del creador"** con **"Atrás"**, el indicador de pasos y la acción principal (**"Personalizar"** en Origen, **"Siguiente"**, **"Crear personaje"** en Detalles) |
| Detalles | input **"Nombre"** centrado bajo el escenario, trasfondo, alineamiento, vista previa PG/CA |

## Criterios de aceptación (tests en `frontend/src/**/__tests__/*.test.tsx`, jsdom + Testing Library)

Mocks: `services/srdService` (`listRaces`, `listClasses`) con fixtures (Human, Elf con 2 entradas, Tiefling, Dwarf;
Wizard, Fighter, Rogue), `services/api` (`characterApi`, `api` para tiradas). Router en memoria y QueryClient sin reintentos.

1. **W1 Distribución de Origen:** existen las regiones Razas, Escenario y Clases; en orden DOM Razas aparece antes que
   Clases y el grupo "Tipo de cuerpo" antes que el primer botón de raza.
2. **W2 Selección:** al elegir Elf y Wizard, sus botones quedan `aria-pressed="true"` y el escenario muestra "Elf · Wizard".
3. **W3 Versiones:** con una raza de 2 entradas aparece el select de versión o libro; cambiarlo cambia la entrada elegida.
4. **W4 Tipo de cuerpo:** pulsar "Complexión esbelta" la deja `aria-pressed="true"` y desmarca la otra.
5. **W5 Bloqueo:** "Personalizar" está deshabilitado hasta tener raza y clase.
6. **W6 Personalización:** en el paso 2 está la región Personalización con todos los grupos listados; "Peinado: siguiente"
   cambia el valor visible al siguiente nombre de `HAIR_STYLES`; "Piel: elegir color" abre un `listbox` con tantas
   `option` como colores tiene `skinsFor(visual)` y elegir una la marca `aria-selected="true"`.
7. **W7 Avatar persistente:** el elemento `img` del avatar del escenario es el **mismo nodo** en los 4 pasos.
8. **W8 Detalles y creación:** en Detalles, con nombre escrito, "Crear personaje" llama a `characterApi.create` con
   `appearance` igual al estado elegido (incluye el peinado cambiado en W6) y la raza y clase elegidas.
9. **W9 Barra inferior:** la región "Acciones del creador" existe en los 4 pasos; "Atrás" está deshabilitado en Origen.
10. **W10 Editor de apariencia:** `EditAppearancePage` muestra la región Personalización, el escenario y la vista previa
    de ficha; "Guardar apariencia" llama a `characterApi.updateAppearance` con el borrador.

## Presupuesto de recursos (RG-1)

- La grilla de razas dibuja a lo sumo un sprite por familia visual (la caché de `avatarCanvas` lo garantiza si el aspecto
  por defecto se reutiliza); emblemas de clase cacheados por prop + color (un canvas por combinación).
- Sin peticiones nuevas al servidor: las mismas queries `srd-races` y `srd-classes` (staleTime 5 min).
- Ningún `useEffect` que redibuje en cada render: dependencias estables.

## Revisión visual (puerta del revisor)

Capturas reales con el dev server (`npm run dev`, backend en `localhost:8080`) a 1440×900 y 390×844 de los 4 pasos y del
editor de apariencia. Rúbrica (cada punto ≥ 4 de 5):
U1 se reconoce la distribución de WoW (razas izquierda, escenario centro, clases derecha, barra inferior) ·
U2 el avatar domina la pantalla, escala entera, escenario iluminado · U3 selectores de personalización como filas ◀ valor ▶
con muestras de color · U4 coherente con el design system (tokens, tipografía, temas claro/oscuro) ·
U5 móvil usable (escenario primero, sin scroll horizontal) · U6 nada roto (textos cortados, solapes, foco visible).
