# Agenda de PNJ, reloj de juego y gestor de PNJ (datos, combate, inventario)

*Extiende `vtt-npc-routines.md` y el gestor de PNJ de `frontend-screens.md` §10. Cada PNJ tiene una **agenda** en JSON: dónde está (escena), qué ruta camina o dónde se queda quieto, según el **día de juego** y el **momento del día** (día, tarde, noche). Cuando el GM avanza el reloj de la campaña, los PNJ se mueven solos a la entrada que les toca. El gestor reúne en un solo lugar los datos, la hoja de combate, el **inventario** y la agenda de cada PNJ, y los exporta/importa como un documento JSON.*

```
 GM avanza el reloj ──▶ campaña: día 3 · noche
                              │
          para cada PNJ con agenda: resolver la entrada (día 3, noche)
                              │
   ┌──────────────────────────┼───────────────────────────┐
   ▼                          ▼                           ▼
 entrada con escena        entrada "ausente"          sin entrada
 → su ficha pasa a esa     → la ficha sale de          → se queda donde
   escena, con su ruta       todos los mapas             está
   o quieta en su posición
```

## 1. Reloj de juego de la campaña
- Cada campaña **SHALL** tener `game_day` (entero ≥ 1, por defecto 1) y `time_of_day` (`dia`, `tarde` o `noche`, por defecto `dia`).
- Solo el GM **MAY** cambiarlo: **Avanzar** (día → tarde → noche → día siguiente por la mañana), **Retroceder** (el inverso) o fijar día y momento directamente.
- La semana **SHALL** tener 7 días: lunes … domingo. El día de juego 1 **SHALL** caer en `first_weekday` (ajuste de la campaña, por defecto `lunes`): `día_semana(d) = (first_weekday + d − 1) mod 7`. Laborables = lunes a viernes; fin de semana = sábado y domingo.
- El reloj **SHALL** verse para todos los miembros en la cabecera de la mesa virtual (p. ej. «Día 3 · miércoles · Noche»). Cambiarlo **SHALL** emitir `campaign.clock.updated` `{game_day, time_of_day, weekday}`.
- *(Fuera de alcance v1: calendarios de fantasía con semanas distintas de 7 días; cambiar la luz ambiental con la hora.)*

## 2. La agenda (JSON)
La agenda de un PNJ es un documento JSON. Es el mismo formato en la API, en el editor y en los archivos de importación/exportación:

```json
{
  "version": 1,
  "pj": { "id": 12, "nombre": "Guardia Brom" },
  "agenda": [
    { "dia": "todos",         "momento": "dia",   "ubicacion": { "escena_id": 5, "escena": "Muralla" },
      "posicion": { "x": 105, "y": 105 },
      "path": { "mode": "loop", "points": [{ "x": 105, "y": 105 }, { "x": 665, "y": 105, "wait_s": 5 }] } },
    { "dia": "laborables",    "momento": "tarde", "ubicacion": { "escena_id": 9, "escena": "Plaza" },
      "posicion": { "x": 300, "y": 220 }, "path": null },
    { "dia": "fin_de_semana", "momento": "tarde", "ubicacion": { "escena_id": 11, "escena": "Taberna" },
      "posicion": { "x": 140, "y": 90 }, "path": null },
    { "dia": "domingo",       "momento": "noche", "ubicacion": null },
    { "dia": 3,               "momento": "tarde", "ubicacion": { "escena_id": 9, "escena": "Plaza" },
      "posicion": { "x": 310, "y": 230 }, "path": { "mode": "once", "points": [{ "x": 310, "y": 230 }, { "x": 600, "y": 230 }] },
      "nota": "Pregona el edicto del duque" },
    { "dia": "todos",         "momento": "noche", "ubicacion": { "escena_id": 7, "escena": "Cuartel" },
      "posicion": { "x": 70, "y": 70 }, "path": null, "oculto": true }
  ]
}
```

| Campo | Valores | Notas |
|---|---|---|
| `pj` | `{id, nombre}` | El PNJ dueño de la agenda. Al importar, `id` manda; sin `id`, se busca por `nombre` exacto en la campaña. |
| `dia` | entero ≥ 1 · `"todos"` · `"laborables"` · `"fin_de_semana"` · `"lunes"` … `"domingo"` | Ver precedencia abajo. |
| `momento` | `"dia"` · `"tarde"` · `"noche"` | |
| `ubicacion` | `{escena_id, escena}` o `null` | `escena_id` manda; `escena` (nombre) es informativo y se rellena al exportar. `null` = **ausente**: no está en ningún mapa. |
| `posicion` | `{x, y}` | Obligatoria con ubicación y sin `path`; con `path` se ignora y el PNJ empieza en P0. |
| `path` | ruta de `vtt-npc-routines.md` §3 o `null` | `null` = quieto en `posicion`. Se valida contra la escena (límites, muros). |
| `oculto` | bool (opcional) | La ficha aparece oculta a los jugadores. |
| `nota` | texto ≤ 500 (opcional) | Para el GM. |

- **Precedencia** al resolver (día de juego `d`, momento `m`) — gana la primera que exista para `m`: día exacto `d` → nombre del día de la semana → `laborables` / `fin_de_semana` → `todos`. Si ninguna coincide, **no hay entrada**: el PNJ se queda donde está.
- Dos entradas con el mismo `dia` y `momento` **MUST NOT** existir (400 con los índices). Como mucho 200 entradas y 64 KB por agenda.
- La escena **MUST** ser de la misma campaña. Si una escena se borra, las entradas que la usan **SHALL** quedar marcadas como rotas (`ubicacion.escena_id` inexistente): se muestran en rojo en el gestor y se saltan al aplicar, con un aviso al GM.

```gherkin
GIVEN el día 1 cae en lunes y Brom tiene entradas "todos·tarde → Muralla", "laborables·tarde → Plaza" y "3·tarde → Plaza con pregón"
WHEN el reloj está en día 3 · tarde
THEN se aplica "3·tarde" (día exacto)
WHEN el reloj está en día 6 · tarde (sábado)
THEN se aplica "todos·tarde → Muralla" (no es laborable)
WHEN el reloj está en día 2 · noche y Brom no tiene entradas de noche
THEN Brom se queda donde estaba
```

## 3. Aplicar la agenda al cambiar el reloj
- El PNJ de la campaña **SHALL** ser la fuente de verdad de sus datos de combate y de sus PG actuales (§5); la ficha (token) es solo su presencia en un mapa. Como con los personajes, las fichas con `npc_id` **SHALL** reflejar los PG del PNJ.
- Al cambiar el reloj, el servidor **SHALL**, para cada PNJ con agenda y en una transacción por PNJ:
  1. resolver la entrada (§2);
  2. **sin entrada** → no hacer nada;
  3. **con ubicación** → dejar exactamente una ficha del PNJ, en esa escena: reutiliza la que ya tenga ahí o mueve la de otra escena (cambiando `scene_id`), o la crea desde la hoja del PNJ; le pone `posicion`/P0, `oculto` y la ruta (`SetRoute`, reloj de ruta en 0). El resto de fichas del PNJ en otras escenas **SHALL** borrarse;
  4. **ausente** → borrar sus fichas de todas las escenas.
- Un PNJ cuya ficha está **en combate** **MUST NOT** moverse: se salta y el GM recibe el aviso «Brom sigue en combate en Muralla; se moverá al terminar». Al terminar ese combate **SHALL** aplicarse su entrada del momento actual.
- Las fichas sueltas (sin `npc_id`) y los PNJ sin agenda **MUST NOT** tocarse.
- El resultado **SHALL** devolverse al GM como resumen: movidos, creados, retirados, saltados (combate o escena rota). Se emite `vtt.scene.updated` por cada escena afectada.
- El GM **MAY** volver a aplicar la agenda del momento actual sin mover el reloj («Reaplicar agenda»), p. ej. tras editar agendas.

```gherkin
GIVEN Brom patrulla la Muralla de día y su agenda dice "todos·noche → Cuartel, quieto, oculto"
WHEN el GM avanza de tarde a noche
THEN la ficha de Brom deja la Muralla y aparece oculta y quieta en el Cuartel en (70, 70)
AND sus PG y su apariencia son los del PNJ
AND el GM ve "1 movido"
```

## 4. Registrar rutas desde el mapa
- En la sección **Rutina** de una ficha con `npc_id` (vtt-npc-routines.md §6) el GM **SHALL** tener **«Guardar en la agenda…»**: elige `dia` y `momento` (por defecto, los actuales) y se guarda una entrada con la escena, la posición y la ruta actuales de la ficha (reemplaza la de mismo `dia`+`momento`).
- Así, el flujo normal es: dibujar la ruta en el mapa → guardarla en la agenda; el JSON queda como formato de registro, revisión e intercambio.

## 5. Gestor de PNJ (`/campaign/:id/gm/npcs`)
Además de lo que ya existe (lista, ficha, creador):

- **Hoja de combate** del PNJ (en `stats.combat`, validada): `hp`, `max_hp`, `ac`, `speed_ft`, `passive_perception`, `darkvision_ft`, `blindsight_ft`, `dex_mod`, `stealth_bonus`, `detects`, `size_cells`. Al crear su ficha en un mapa (a mano o por agenda) se copian a la ficha; los PG se reflejan en vivo (§3). Los PNJ existentes **SHALL** tener valores por defecto (10 PG, CA 10, 30 pies, percepción pasiva 10, tamaño 1).
- **Pestaña Agenda** en la ficha del PNJ:
  - tabla de entradas ordenada por momento y precedencia: día, momento, ubicación, «quieto en (x, y)» o «ruta: patrulla de 4 puntos», oculto, nota, estado (ok / escena rota);
  - formulario por entrada (día con selector: número, todos, laborables, fin de semana, día de la semana; momento; escena; quitar ruta);
  - vista **JSON** editable con validación en vivo (errores por índice) y guardar;
  - «¿Dónde estará?»: muestra la entrada que aplicaría para un día y momento dados.
- **Vista «Dónde están ahora»** (pestaña del gestor): todos los PNJ con la hora actual: escena, en ruta / quieto / pausado / en combate / ausente / sin agenda, y la entrada que les tocará en el siguiente momento. Incluye los controles del reloj (Avanzar, Retroceder, fijar) y «Reaplicar agenda».
- **Inventario** (pestaña de la ficha del PNJ; amplía las «pertenencias» de `market-bastions.md` §5):
  - **Bolsa**: monedas en cobre (`purse_cp`), mostradas como po/pp/pc; el GM suma, resta o fija.
  - **Objetos** (`npc_items`): nombre, cantidad, valor, descripción, **dónde está** (`encima` = lo lleva consigo / `casa` = guardado en su hogar), **equipado** (solo para `encima`) y origen. Se pueden añadir a mano o **desde el compendio** (el formulario busca en el compendio y copia nombre, descripción y valor).
  - Filtro por ubicación y total del valor de lo que lleva encima.
  - **Entregar a un personaje**: el GM pasa una cantidad de un objeto (o monedas) del PNJ a un personaje de la campaña (regalo, pago, saqueo). Es **atómico**: resta del PNJ y suma al inventario/oro del personaje en una transacción; el jugador recibe el aviso. Un objeto con cantidad 0 tras la entrega se borra.
  - En la mesa, la ficha de un PNJ **SHALL** ofrecer al GM «Inventario» (acceso directo a esta pestaña) y, si sus PG llegan a 0, «Saquear»: abre la entrega con lo que lleva `encima` (lo de `casa` no se saquea en combate).
- **Importar / exportar**: el documento de exportación es la **ficha completa del PNJ**, con secciones opcionales:

```json
{
  "version": 1,
  "pj": { "id": 12, "nombre": "Guardia Brom", "rol": "Guardia de la muralla", "relacion": "neutral", "raza": "Dwarf", "clase": "Fighter" },
  "combate": { "hp": 22, "max_hp": 22, "ac": 16, "speed_ft": 25, "passive_perception": 12, "darkvision_ft": 60, "detects": true },
  "inventario": {
    "monedas_cp": 1450,
    "objetos": [
      { "nombre": "Alabarda", "cantidad": 1, "valor_cp": 2000, "donde": "encima", "equipado": true },
      { "nombre": "Llave del cuartel", "cantidad": 1, "donde": "encima", "descripcion": "Abre la armería" },
      { "nombre": "Carta de su hermana", "cantidad": 1, "donde": "casa" }
    ]
  },
  "agenda": [ { "dia": "todos", "momento": "noche", "ubicacion": { "escena_id": 7, "escena": "Cuartel" }, "posicion": { "x": 70, "y": 70 }, "path": null } ]
}
```

  - Exportar uno (`pnj-<nombre>.json`) o todos (`pnjs-<campaña>.json`, array). Al exportar se puede elegir qué secciones incluir (p. ej. solo agendas).
  - Importar: cada sección presente **reemplaza** la del PNJ (la agenda entera, el inventario entero, la hoja de combate); una sección ausente no se toca. Los datos de `pj` (salvo `id`/`nombre` para emparejar) solo se aplican si se marca «actualizar datos». Se **SHALL** validar todo antes de escribir (todo o nada) y mostrar los errores por PNJ, sección e índice; `?dry_run=1` muestra el resumen sin escribir. Un PNJ inexistente **SHALL** reportarse, no crearse.
  - Un PNJ con fichas en combate **MAY** importarse; su ficha recoge la hoja nueva al salir del combate.

## 6. API REST
| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/campaigns/:id/clock` | miembro |
| PUT | `/api/campaigns/:id/clock` | GM — `{game_day, time_of_day}` o `{step: ±n}`, y opcional `first_weekday`; responde `{clock, summary}` (§3) |
| POST | `/api/campaigns/:id/clock/apply` | GM — reaplica la agenda del momento actual |
| GET / PUT | `/api/campaigns/:id/npcs/:npc_id/agenda` | GM — la lista de entradas de §2 (400 con `problems` por entrada) |
| GET | `/api/campaigns/:id/npcs/:npc_id/agenda/resolve?dia=&momento=` | GM |
| GET | `/api/campaigns/:id/npcs/:npc_id/sheet?secciones=` | GM — ficha completa de un PNJ |
| GET | `/api/campaigns/:id/npc-sheets?secciones=combate,inventario,agenda` | GM — fichas de todos (array) |
| POST | `/api/campaigns/:id/npc-sheets/import?dry_run=1&actualizar_datos=1` | GM — array de fichas (o una); todo o nada |
| GET | `/api/campaigns/:id/npc-whereabouts` | GM — vista «Dónde están ahora» |
| PUT | `/api/campaigns/:id/npcs/:npc_id/purse` | GM — `{delta_cp}` o `{set_cp}` |
| GET/POST | `/api/campaigns/:id/npcs/:npc_id/items` · PUT/DELETE `/npc-items/:id` | GM — ya existían; ganan `equipped`. El alta desde el compendio la rellena el cliente (nombre, descripción, valor). |
| POST | `/api/campaigns/:id/npc-items/:id/give` | GM — `{character_id, quantity}` |
| POST | `/api/campaigns/:id/npcs/:npc_id/give-coins` | GM — `{character_id, amount_cp}` |

## 7. Datos (migración 033)
- `campaigns`: `game_day INT NOT NULL DEFAULT 1 CHECK (game_day >= 1)`, `time_of_day VARCHAR(5) NOT NULL DEFAULT 'dia' CHECK IN ('dia','tarde','noche')`; `first_weekday` en `campaigns.settings`.
- `campaign_npcs`: `agenda JSONB NOT NULL DEFAULT '[]'` (las entradas; `version` y `pj` se añaden al exportar), `hp_current INT NULL` (NULL = `stats.combat.hp`), `purse_cp BIGINT NOT NULL DEFAULT 0 CHECK (purse_cp >= 0)`.
- `npc_items`: `equipped BOOLEAN NOT NULL DEFAULT FALSE`; `location` sigue siendo `inventory` | `home` en la base (en el JSON: `encima` | `casa`). Un objeto `home` **MUST NOT** estar equipado.
- Las agendas se leen todas en una consulta al aplicar (pocas decenas de PNJ por campaña); sin tabla aparte.

## 8. Permisos y privacidad
- Agendas, inventario, gestor y resúmenes: solo GM (el jugador solo ve lo que recibe en su propio inventario). Los jugadores solo ven el reloj y, en la mesa, las fichas no ocultas que su niebla permite (`vtt.md`).
