# VTT: PNJ en los mapas y rutinas de movimiento

*Extiende `vtt.md` y `vtt-modes.md`. Cada escena tiene sus PNJ: **estáticos** (un token quieto) y **móviles**, que recorren una ruta definida por el GM (línea recta, ida y vuelta o patrulla en bucle). Las rutas son deterministas en el tiempo: servidor y clientes calculan la misma posición con la misma función, sin emitir un mensaje por paso.*

## 1. PNJ de la campaña en el mapa
- El GM **SHALL** poder colocar en una escena un PNJ de la campaña (`campaign_npcs`) eligiéndolo de la lista. El token **SHALL** guardar `npc_id` y heredar al crearse el nombre y la imagen del PNJ.
- Un token con `npc_id` **SHALL** dibujarse con la apariencia pixel-art del PNJ (`campaign_npcs.appearance`) cuando no tiene `image_url`, igual que los tokens de personaje. La respuesta de tokens **SHALL** incluir `npc_appearance` (o `null`), `npc_race`, `npc_class` y `npc_status` del PNJ vinculado.
- Borrar el PNJ de la campaña **MUST NOT** borrar el token: `npc_id` pasa a `NULL` (el token queda suelto).
- El GM **MAY** seguir creando tokens sueltos (`kind` `npc` o `monster`) sin `npc_id`.
- Un mismo PNJ **MAY** estar en varias escenas (un token por escena).

## 2. Disposición (hostilidad)
- Todo token no jugador **SHALL** tener una disposición efectiva: `hostile`, `neutral` o `friendly`.
- Token con `npc_id`: la disposición **SHALL** seguir en vivo la relación del PNJ con el grupo (`campaign_npcs.status`): `enemy → hostile`, `neutral → neutral`, `ally → friendly`. Si la relación cambia en la campaña, el token cambia sin editarlo.
- Token sin `npc_id`: columna propia `disposition`; por defecto `hostile` para `monster` y `neutral` para `npc`.
- La detección por sentidos (`vtt-modes.md` §4) **SHALL** iniciar encuentros **solo** desde tokens hostiles con `detects = true`. Un token neutral o amistoso **MUST NOT** iniciar un encuentro aunque vea a un jugador.
- Las zonas de encuentro y el inicio manual del GM no cambian.

```gherkin
GIVEN un guardia de la campaña con relación «Neutral» y detecta activo, patrullando una muralla
WHEN un jugador entra en su campo de visión
THEN no se inicia ningún encuentro
WHEN el GM cambia la relación del guardia a «Enemigo»
AND el jugador sigue a la vista del guardia
THEN el servidor inicia un encuentro local con el guardia y el jugador
```

## 3. Rutas
- Un token `npc` o `monster` **MAY** tener una ruta; los tokens `pc` **MUST NOT** tenerla (400).
- Ruta = lista de 2 a 32 puntos `{x, y, wait_s}` en **píxeles de la imagen de fondo** (enteros; la escena mide lo mismo que su mapa, así que el punto queda pegado al píxel del dibujo aunque se haga zoom o se mueva la vista). Los puntos **MUST NOT** ajustarse a la cuadrícula. `wait_s` entre 0 y 600: pausa al llegar a ese punto. Cada punto **MAY** tener **manejadores de Bézier** `in` y `out` (`{x, y}`, en píxeles del fondo, como en la pluma de Photoshop): el tramo de A a B es la curva cúbica `A → A.out → B.in → B` (un manejador ausente vale lo mismo que su ancla; sin manejadores el tramo es recto). Al recorrer un tramo al revés (vuelta de `pingpong`) se usa la misma curva invertida. Y un `mode`:

| Modo | Recorrido | Al terminar |
|---|---|---|
| `once` | P0 → P1 → … → Pn | se queda en Pn |
| `pingpong` | P0 → … → Pn → … → P0, repetido | nunca termina |
| `loop` | P0 → … → Pn → P0, repetido (patrulla cerrada) | nunca termina |

- En las curvas el token **SHALL** avanzar a velocidad constante a lo largo de la curva (por longitud de arco). La longitud y la posición se calculan aproximando cada tramo con **24 subtramos rectos** (mismo cálculo en Go y en TypeScript, misma tabla de casos `route_curve_cases.json`).
- La velocidad **SHALL** ser la tasa de exploración del token caminando (`ExplorationRatePxPerSec` con su `speed_ft`, sin sigilo, al `exploration_pace` de la escena). Un token con `speed_ft = 0` **SHALL** quedarse quieto.
- Todos los puntos **SHALL** estar dentro de la escena y los tramos **MUST NOT** cruzar un muro que bloquee el movimiento (las puertas, abiertas o cerradas, no bloquean la ruta: el PNJ las usa). En las curvas se comprueban los 24 subtramos: la curva **MUST NOT** salir de la escena ni cruzar un muro aunque la cuerda recta no lo haga. Si no, 400 con el tramo culpable.
- Guardar una ruta **SHALL** colocar el token en P0 y dejar el reloj en 0.
- Las puertas abiertas o cerradas durante el juego **MUST NOT** detener la ruta.

### Reloj de la ruta
- La posición **SHALL** ser una función pura `RoutePosition(ruta, tasa, elapsed) → (x, y)`, donde `elapsed` es el tiempo de recorrido acumulado. El mismo cálculo **SHALL** existir en Go y en TypeScript, y ambos **SHALL** pasar la misma tabla de casos.
- El reloj **SHALL** guardarse como `route_elapsed_ms` (acumulado) + `route_started_at` (`NULL` = detenido). Con el reloj corriendo, `elapsed = route_elapsed_ms + (ahora − route_started_at)`.
- El reloj **SHALL** correr solo si: la escena está activa y en modo `exploration`, el token no está en combate y el GM no lo pausó (`route_paused`).
- Congelar el reloj (pausa del GM, el token entra en combate, la escena sale de exploración o deja de estar activa) **SHALL** sumar el tramo al acumulado, poner `route_started_at = NULL` y guardar `x, y` en la posición calculada.
- Reanudar (el GM quita la pausa, termina el combate del token, la escena vuelve a exploración o se activa) **SHALL** poner `route_started_at = ahora` sin tocar el acumulado: el PNJ sigue desde donde quedó.
- Cambiar la tasa (velocidad del token, ritmo, celda o pies por celda de la escena) **SHALL** recalcular el tiempo acumulado (`RescaleElapsed`) para que el PNJ siga en el mismo punto de su ruta, sin saltar.
- Arrastrar a mano un token con ruta **SHALL** pausarlo (`route_paused = true`); el GM lo reanuda con «Reanudar» (vuelve a la ruta desde su avance) o «Reiniciar» (P0, reloj en 0).

```gherkin
GIVEN un guardia de 30 ft en una escena de ritmo ×2 (30 ft cada 3 s) con ruta loop de 4 puntos y 6 casillas por lado
WHEN pasan 6 s sin esperas
THEN el guardia SHALL estar en P2
WHEN empieza un combate que lo incluye a los 7 s
THEN su reloj SHALL congelarse en 7 s y su posición guardarse
WHEN el combate termina 2 minutos después
THEN el guardia SHALL seguir desde la posición de 7 s, no desde la de 2 min 7 s
```

## 4. Servidor
- Cada segundo (el mismo ticker de `RunTimers`) el servidor **SHALL**, por cada escena activa en exploración con rutas corriendo:
  1. calcular la posición de cada token con ruta y guardar las que cambiaron en **una sola sentencia** por escena (las posiciones en la base quedan a ≤ 1 s, así encuentros, visión y combate usan datos al día);
  2. evaluar la detección (§2) de cada token móvil hostil con `detects = true` contra los jugadores, con las mismas reglas de sigilo de `vtt-modes.md` §4.
- Sin rutas corriendo, el ticker **MUST NOT** hacer consultas extra por escena salvo una consulta que diga si hay alguna (índice parcial sobre `route_started_at IS NOT NULL`).
- El servidor **MUST NOT** emitir `vtt.token.moved` por los pasos de la ruta. Solo emite `vtt.route.updated` `{scene_id, token_id, route, clock}` cuando la ruta o su reloj cambian (guardar, pausar, reanudar, reiniciar, congelar, descongelar).

## 5. Clientes
- La respuesta de tokens **SHALL** incluir por token `route` (o `null`), `route_paused` y `route_clock: {elapsed_ms, running}` calculado al responder; el cliente suma el tiempo transcurrido desde que recibió la respuesta (sin depender del reloj del servidor).
- El tablero **SHALL** animar los tokens con ruta corriendo con `RoutePosition` a la tasa de refresco del navegador, sin peticiones.
- Solo el GM **SHALL** ver las rutas dibujadas (línea punteada, puntos numerados, flecha de sentido; `loop` cierra la figura). Los jugadores ven solo el token, y solo si su niebla lo permite.
- Los tokens ocultos con ruta siguen sin enviarse a los jugadores (`vtt.md`).

## 6. Interfaz del GM
- Herramienta **«Ruta de PNJ»** — funciona como la **pluma de Photoshop** (D-0068):
  - Requiere un token `npc`/`monster` seleccionado; sin él, el clic selecciona fichas.
  - Cada clic añade un **ancla** en el píxel exacto del fondo (redondeado a entero). El primer clic es P0: al guardar, el PNJ empieza ahí.
  - Mientras se dibuja, una **banda elástica** va del último ancla al cursor y **ya es curva** si ese ancla tiene manejador de salida (vista previa del próximo tramo, como en Photoshop); las anclas se ven como cuadritos y la primera se resalta al pasar por encima.
  - **Clic y arrastrar** al poner un ancla la hace **suave**: arrastrar saca su manejador de salida (`out`) hasta el cursor y el de entrada (`in`) queda simétrico; la curva se ve mientras se arrastra (D-0069). Un clic sin arrastrar (menos de 4 px de pantalla) deja un ancla de **esquina** (tramos rectos).
  - **Alt mientras se arrastra** un ancla nueva rompe la simetría: desde ese momento solo se mueve el manejador de salida (el de entrada se queda donde estaba).
  - **Mayús** restringe el tramo a múltiplos de 45°; mientras se arrastra un manejador, restringe su ángulo a múltiplos de 45° alrededor del ancla.
  - **Retroceso** borra el último ancla; **Esc** cancela el trazado.
  - **Cerrar**: clic sobre la primera ancla (radio de 10 px de pantalla) con 3 o más anclas → trazado **cerrado** (ciclo). **Clic y arrastrar** sobre ella al cerrar saca sus manejadores (salida en el cursor, entrada simétrica), que dan forma al tramo de cierre.
  - **Terminar abierto**: doble clic o **Intro** con 2 o más anclas → trazado **abierto** (una línea).
  - Al terminar **SHALL** abrirse la configuración de la ruta: trazado abierto → **Ida** (`once`) o **Ida y vuelta** (`pingpong`); trazado cerrado → **Ciclo** (`loop`). Además, la espera en cada punto. «Guardar» manda la ruta; «Cancelar» la descarta.
  - **Editar** (herramienta activa, PNJ seleccionado, sin trazado en curso), como la pluma con añadir/eliminar automático (D-0070):
    - **Clic sobre el trazado** entre dos anclas → **añade un ancla** ahí sin cambiar la forma (la curva se parte con De Casteljau; en tramo recto, ancla de esquina).
    - **Clic sobre un ancla** intermedia → **la elimina** (una ruta abierta conserva al menos 2 anclas y un ciclo al menos 3).
    - **Clic sobre un extremo** de una ruta abierta → **continúa el trazado** desde ese extremo (desde el inicio, la ruta se invierte); al terminar se vuelve a preguntar Ida / Ida y vuelta.
    - **Arrastrar un ancla** la mueve (al píxel, con sus manejadores) y guarda con el mismo modo, sin volver a preguntar.
    - **Arrastrar un manejador** lo mueve y el opuesto queda simétrico; con **Alt** se mueve solo ese (ancla de vértice, curva quebrada).
    - **Alt + clic sobre un ancla suave** la convierte en esquina (quita sus manejadores); **Alt + arrastrar desde un ancla de esquina** saca manejadores simétricos (la convierte en suave).
  - Un rótulo junto a las herramientas recuerda los atajos mientras la pluma está activa.
- Panel del token seleccionado, sección **Rutina**: estado (`Quieto`, `En ruta`, `Pausado` por el GM, `Detenido` por combate/modo/escena inactiva), modo (`Ida`, `Ida y vuelta`, `Patrulla`), espera común a todos los puntos, `Pausar`/`Reanudar`, `Reiniciar`, `Redibujar`, `Quitar ruta`; además velocidad y «Detecta jugadores» del token; y **Disposición** (solo editable en tokens sin `npc_id`; con `npc_id` muestra la relación del PNJ y enlaza a su ficha).
- Panel **PNJ de la escena**: lista los tokens `npc` de la escena (estático / en ruta / pausado) y un botón **«Colocar PNJ»** que abre la lista de PNJ de la campaña; al elegir uno, el siguiente clic en el mapa lo coloca.

## 7. API REST (añadidos)
| Método | Ruta | Rol |
|---|---|---|
| POST | `/api/campaigns/:id/vtt/scenes/:scene_id/tokens` | GM — acepta `npc_id` y `disposition` |
| PUT | `/api/campaigns/:id/vtt/tokens/:token_id/route` | GM — `{mode, points:[{x,y,wait_s}]}`; `null` o cuerpo vacío quita la ruta |
| POST | `/api/campaigns/:id/vtt/tokens/:token_id/route/{pause,resume,restart}` | GM |

## 8. Datos (migración 032)
- `vtt_tokens`: `npc_id BIGINT NULL REFERENCES campaign_npcs ON DELETE SET NULL`, `disposition VARCHAR(10) NOT NULL CHECK IN ('hostile','neutral','friendly')`, `route JSONB NULL`, `route_paused BOOLEAN NOT NULL DEFAULT FALSE`, `route_elapsed_ms BIGINT NOT NULL DEFAULT 0 CHECK (>= 0)`, `route_started_at TIMESTAMPTZ NULL`.
- Relleno: `monster` → `hostile`; `npc` con `detects = true` → `hostile` (conserva el comportamiento actual); resto → `neutral`.
- Índice parcial `vtt_tokens(scene_id) WHERE route_started_at IS NOT NULL`.

## 9. Fuera de alcance (v1)
Horarios por hora del día, rutas que esquivan obstáculos (pathfinding), PNJ que persiguen o huyen, diálogos al interactuar con un PNJ.
