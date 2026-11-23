# Matriz de trazabilidad de especificaciones

Fecha: 2026-11-22 · Rama `feat/content-catalog-review`.

Cada afirmación normativa de `openspec/specs/*.md` (frases MUST/SHALL/SHOULD/DEBE, escenarios GIVEN/WHEN/THEN, endpoints, tablas y elementos de UI listados) se contrastó leyendo el código. El proyecto usa el catálogo completo de 5etools (`content_entities` y la proyección tipada `srd_*`, que contiene todos los libros) en lugar de datos solo SRD; las afirmaciones que ese cambio deja sin efecto figuran como SUPERSEDED (véanse las notas de estado de `srd-data.md` y `srd-integration.md`). Las secciones «Decisiones de implementación (2026-11-21)» de cada spec cuentan como spec.

Estados: **IMPLEMENTED** (cumplido, con evidencia), **PARTIAL** (cumplido en parte), **MISSING** (no existe), **SUPERSEDED** (sustituido por una decisión posterior), **UNVERIFIABLE-IN-CODE** (depende de una instancia de Foundry con licencia o de configuración externa al repositorio).

## Resumen

| Spec | Total | IMPLEMENTED | PARTIAL | MISSING | SUPERSEDED | UNVERIFIABLE-IN-CODE |
|---|---|---|---|---|---|---|
| [architecture.md](specs/architecture.md) | 25 | 24 | 1 | 0 | 0 | 0 |
| [design-system.md](specs/design-system.md) | 17 | 15 | 2 | 0 | 0 | 0 |
| [security.md](specs/security.md) | 33 | 30 | 1 | 0 | 0 | 2 |
| [resilience.md](specs/resilience.md) | 27 | 26 | 1 | 0 | 0 | 0 |
| [lan-deployment.md](specs/lan-deployment.md) | 33 | 32 | 0 | 1 | 0 | 0 |
| [user-stories.md](specs/user-stories.md) | 81 | 77 | 2 | 0 | 2 | 0 |
| [characters.md](specs/characters.md) | 38 | 36 | 2 | 0 | 0 | 0 |
| [character-appearance.md](specs/character-appearance.md) | 24 | 24 | 0 | 0 | 0 | 0 |
| [srd-data.md](specs/srd-data.md) | 54 | 48 | 1 | 0 | 5 | 0 |
| [srd-integration.md](specs/srd-integration.md) | 68 | 63 | 4 | 1 | 0 | 0 |
| [market-bastions.md](specs/market-bastions.md) | 65 | 65 | 0 | 0 | 0 | 0 |
| [encounter-builder.md](specs/encounter-builder.md) | 31 | 31 | 0 | 0 | 0 | 0 |
| [vtt.md](specs/vtt.md) | 51 | 51 | 0 | 0 | 0 | 0 |
| [vtt-modes.md](specs/vtt-modes.md) | 38 | 37 | 1 | 0 | 0 | 0 |
| [foundry-integration.md](specs/foundry-integration.md) | 60 | 51 | 3 | 1 | 0 | 5 |
| [frontend-screens.md](specs/frontend-screens.md) | 181 | 158 | 8 | 4 | 11 | 0 |
| **Total** | **826** | **768** | **26** | **7** | **18** | **7** |

Antes de las correcciones del 2026-11-22 la auditoría daba 650 IMPLEMENTED, 113 PARTIAL, 38 MISSING,
18 SUPERSEDED y 7 UNVERIFIABLE-IN-CODE. Las 33 brechas abiertas restantes necesitan una decisión de
producto, no tienen fuente de datos o son trabajo grande que exige una instancia de Foundry con licencia.

### Notas de verificación

- Prueba en navegador del selector de intercambio (pila aislada, campaña con DM y dos jugadores): el
  jugador A elige a B como destinatario, ve los objetos intercambiables de B (sin 403 en red ni en
  consola), solicita uno y envía; B acepta y el objeto pasa al inventario de A. La primera pasada
  destapó un fallo: `Trade.tsx` volvía a filtrar en el cliente la lista de
  `GET /campaigns/:id/characters/:character_id/tradeable-items` por `is_tradeable`, campo que ese
  endpoint no devuelve, y la lista salía vacía. Ahora solo se filtra el inventario propio.
- SRD-22 y SRD-45/46/47 cambian la proyección del importador: los datos ya importados se corrigen al
  volver a importar el catálogo.
- `internal/websocket` e `internal/worker` no están conectados en `cmd/server/main.go` (código muerto).

## Brechas corregidas el 2026-11-22

- **FND-14** (foundry-integration.md): Los campos propios de la app en la misma fila no se sobrescriben
- **FND-22** (foundry-integration.md): Encolar un trabajo de embedding en el pool RAG por cada entrada de diario sincronizada
- **FND-23** (foundry-integration.md): El tier de lore usa por defecto el valor configurado salvo que el GM lo cambie
- **FND-28** (foundry-integration.md): Escenario: un usuario abre la vista Combate → iframe; se autentica en Foundry dentro del marco
- **FND-35** (foundry-integration.md): La UI indica que el inventario autoritativo vive en Foundry
- **FND-36** (foundry-integration.md): Los flujos de mercado y trade no se presentan como autoritativos sobre Foundry
- **FND-52** (foundry-integration.md): Clases, subclases y razas descriptivas (nombre, descripción, dado de golpe, salvaciones) sin advancement
- **FND-55** (foundry-integration.md): Las entradas homebrew (is_srd=FALSE) se conservan y se importan
- **ARCH-09** (architecture.md): Ollama solo se usa a través del pool de workers de Go
- **ARCH-15** (architecture.md): Un conflicto invalida el trade y notifica a ambas partes
- **ARCH-20** (architecture.md): Tier character_lore: solo el jugador dueño y el GM
- **ARCH-25** (architecture.md): En foundry la vista en vivo MAY ser el iframe; la UI de Foundry MUST NOT aparecer en campañas local
- **DS-04** (design-system.md): Sin violeta/lavanda; "muy raro" usa magenta
- **DS-06** (design-system.md): Tokens ok/warn/bad con umbrales de PV ≥60 % / <30 %
- **DS-08** (design-system.md): Tokens role-player / role-dm / role-admin
- **DS-09** (design-system.md): Tokens rar-* de rareza (común, poco común, raro, muy raro, legendario)
- **DS-14** (design-system.md): Contraste de texto WCAG AA en todos los temas
- **US-16** (user-stories.md): B ve los objetos y el oro ofrecidos
- **US-28** (user-stories.md): La transacción se registra en el log de auditoría de la campaña
- **US-33** (user-stories.md): "Mi historia": búsqueda acotada al lore personal del personaje
- **US-34** (user-stories.md): Solo se consultan los vectores de la historia del propio jugador
- **US-35** (user-stories.md): La respuesta solo usa la sección de historia del personaje
- **US-36** (user-stories.md): No incluye historias de otros personajes ni trama oculta
- **US-40** (user-stories.md): Consulta del GM incluye todos los tiers (trama, historias, oculto)
- **US-41** (user-stories.md): La respuesta del GM refleja acceso total
- **US-45** (user-stories.md): El GM recibe confirmación de entrega
- **US-47** (user-stories.md): Anuncio entregado a todos los conectados en tiempo real
- **US-48** (user-stories.md): Anuncio persistido en el historial de cada jugador
- **US-49** (user-stories.md): Jugadores offline reciben el anuncio al reconectar
- **US-53** (user-stories.md): El emisor ve el mensaje como "enviado"
- **US-74** (user-stories.md): Si el objeto desaparece, la oferta se invalida automáticamente
- **US-76** (user-stories.md): Se invita a A a actualizar la oferta
- **US-81** (user-stories.md): El GM recibe "Message queued for delivery"
- **LAN-03** (lan-deployment.md): En modo local no se muestran endpoints ni UI de Foundry
- **LAN-22** (lan-deployment.md): La búsqueda degradada respeta las reglas de tier del llamante
- **FS-14** (frontend-screens.md): Tarjeta de campaña: imagen, estado (Activa/En Pausa), nombre, descripción, DM, nº jugadores
- **FS-18** (frontend-screens.md): Hub: tiradas rápidas (arma, Sigilo, Percepción, Acrobacias…)
- **FS-20** (frontend-screens.md): Hub: vista rápida flotante con barra de PV + botón D20
- **FS-36** (frontend-screens.md): Conjuros: CD de salvación + bono de ataque
- **FS-41** (frontend-screens.md): Rasgos: sentidos pasivos Percepción, Investigación, Perspicacia
- **FS-42** (frontend-screens.md): Rasgos: tarjeta de idiomas y competencias (armaduras, armas, idiomas)
- **FS-44** (frontend-screens.md): Dotes y rasgos raciales en listas propias
- **FS-52** (frontend-screens.md): Bio: tarjeta física (alineamiento, edad, altura, peso, ojos, piel, pelo)
- **FS-54** (frontend-screens.md): Bio: historia autoexpandible con indicador de autoguardado
- **FS-59** (frontend-screens.md): Ofertante: avatar + nombre + personaje/nivel
- **FS-61** (frontend-screens.md): Destinatario: avatar + nombre + personaje/nivel
- **FS-63** (frontend-screens.md): Pie: Cancelar + "Enviar Oferta"
- **FS-66** (frontend-screens.md): Bandeja: buscador
- **FS-67** (frontend-screens.md): Bandeja: conversaciones con avatar, último mensaje, hora
- **FS-70** (frontend-screens.md): Chat: cabecera con destinatario + estado en línea
- **FS-80** (frontend-screens.md): Indicador "Buscando en el lore..." con puntos animados
- **FS-81** (frontend-screens.md): Fila de preguntas sugeridas encima de la entrada
- **FS-84** (frontend-screens.md): Mercado: chips Todo/Armas/Armaduras/Pociones/Magia
- **FS-88** (frontend-screens.md): Insignias de rareza por color (común, poco común verde, raro azul, muy raro, legendario)
- **FS-109** (frontend-screens.md): Detalle NPC: etiquetas de tipo/tamaño/VD
- **FS-110** (frontend-screens.md): Detalle NPC: CA, PV, Velocidad y Percepción pasiva
- **FS-112** (frontend-screens.md): Detalle NPC: rasgos y acciones (nombre + descripción, insignias de impacto/CD)
- **FS-131** (frontend-screens.md): Mapa: acciones "Editar" / "Ajustes" del propio mapa
- **FS-135** (frontend-screens.md): Notas visibles solo para el GM
- **FS-139** (frontend-screens.md): Calendario solo GM
- **FS-151** (frontend-screens.md): Encuentro: tarjeta de estado del personaje (avatar, PV/CA con barras, estado)
- **FS-159** (frontend-screens.md): Componente CampaignCard (imagen, estado, nombre, descripción, DM/jugadores)
- **FS-164** (frontend-screens.md): Componente ConversationRow (avatar, nombre, vista previa, hora, no leídos)
- **FS-165** (frontend-screens.md): Componente MessageBubble (avatar, contenido, hora, estado de entrega)
- **FS-171** (frontend-screens.md): Componente SkillRow (nombre, competencia, bono)
- **FS-174** (frontend-screens.md): Componente Toast (success/error/info/trade/message)
- **FS-180** (frontend-screens.md): Componente SourceEntry (icono de libro + título + tipo de fuente)
- **FS-181** (frontend-screens.md): Toda vista no listada debe especificarse antes de implementarse
- **SRD-15** (srd-data.md): Con referencia SRD, la UI SHOULD mostrar los datos oficiales junto a las modificaciones de campaña
- **SRD-22** (srd-data.md): `proficiency_bonus` SHALL derivarse del VD
- **SRD-41** (srd-data.md): …resultados incluyen name, school, casting_time, range, concentration
- **SRD-43** (srd-data.md): …el conjuro del personaje SHALL guardar `srd_ref_id`
- **SRD-45** (srd-data.md): Equipo SHALL categorizarse como Weapon/Armor/Shield/Adventuring Gear/Tool/Mount/Vehicle
- **SRD-46** (srd-data.md): Armas SHALL incluir damage_dice, damage_type, weapon_category, weapon_range (Melee/Ranged), properties
- **SRD-47** (srd-data.md): Armaduras SHALL incluir ac_base, ac_dex_bonus, ac_max_bonus, str_minimum, stealth_disadvantage, armor_category
- **SRD-54** (srd-data.md): Resultados SHALL incluir rank y ordenarse por él descendente
- **SRDI-03** (srd-integration.md): Crear personaje: SHOULD validar que la clase exista en srd_classes
- **SRDI-04** (srd-integration.md): …SHOULD validar que la raza exista en srd_races
- **SRDI-05** (srd-integration.md): …si no coincide SHALL devolver aviso (no error)
- **SRDI-07** (srd-integration.md): Ficha: SHOULD buscar la clase en srd_classes
- **SRDI-08** (srd-integration.md): …mostrar dado de golpe, salvaciones y rasgos de nivel 5 de la clase
- **SRDI-09** (srd-integration.md): …bono de competencia SHOULD seguir la tabla por nivel (nivel 5 → +3)
- **SRDI-13** (srd-integration.md): …guardar el conjuro con `srd_ref_id = srd_spell.id`
- **SRDI-14** (srd-integration.md): Espacios de conjuro SHOULD precargarse según la progresión de la clase del catálogo
- **SRDI-15** (srd-integration.md): …el jugador MAY modificar los totales
- **SRDI-18** (srd-integration.md): …SHOULD distinguirse visualmente (sin insignia SRD); el GM crea conjuros propios
- **SRDI-19** (srd-integration.md): Dar objeto del catálogo: copiar name, item_type, weight, description
- **SRDI-20** (srd-integration.md): …mapear la rareza a `inventory_items.rarity`
- **SRDI-22** (srd-integration.md): …propiedades de arma SHALL guardarse en la descripción
- **SRDI-23** (srd-integration.md): …CA de armadura SHALL guardarse/mostrarse
- **SRDI-30** (srd-integration.md): …tarjetas con name, type, CR, size, HP, AC
- **SRDI-31** (srd-integration.md): …filtros: búsqueda FTS, rango de VD, tipo, tamaño
- **SRDI-37** (srd-integration.md): …combate: CA (tipo), PV (dados), Velocidad
- **SRDI-39** (srd-integration.md): …info: salvaciones, habilidades, resistencias, inmunidades, vulnerabilidades, inmunidades a estados, sentidos, idiomas, VD (PX)
- **SRDI-40** (srd-integration.md): …rasgos con nombre + descripción
- **SRDI-41** (srd-integration.md): …acciones con nombre + descripción (ataque/salvación del texto)
- **SRDI-42** (srd-integration.md): …reacciones con nombre + descripción
- **SRDI-43** (srd-integration.md): …acciones legendarias: descripción + cada una
- **SRDI-49** (srd-integration.md): …la entrada SHALL referenciar al monstruo para ver su bloque durante el combate
- **MKT-01** (market-bastions.md): §2 Los personajes guardan monedas en `gold`, `silver` y `copper`
- **MKT-16** (market-bastions.md): §3 El GM conserva un atajo `buy` para entregar objetos a precio de lista
- **MKT-21** (market-bastions.md): §4 `value_cp` al crear desde el compendio con coste conocido
- **MKT-24** (market-bastions.md): §5 Pertenencias visibles y editables por el GM en el detalle del PNJ
- **ENC-06** (encounter-builder.md): Grupos de nivel mixto usan el nivel medio (SHOULD)
- **ENC-18** (encounter-builder.md): Botón «Añadir a Combate» añade los monstruos al tracker de iniciativa
- **VTT-38** (vtt.md): Frontera de confianza: lo secreto MUST usar `hidden`, aplicado por el servidor
- **VTM-04** (vtt-modes.md): Combate: toda la escena juega por turnos con todas las fichas no ocultas
- **VTM-06** (vtt-modes.md): Ritmo derivado de la velocidad de la hoja × exploration_pace (×2 por defecto, rango ×1–×4); sin personaje, speed_ft de la ficha
- **VTM-32** (vtt-modes.md): Servidor → clientes `vtt.token.moved` efímero
- **RES-11** (resilience.md): El cliente detecta 2 Pong perdidos seguidos, cierra el socket e inicia la reconexión
- **RES-12** (resilience.md): Un pool fijo de goroutines atiende todas las interacciones con Ollama
- **RES-13** (resilience.md): Tamaño configurable, 4 por defecto
- **RES-15** (resilience.md): Escenario: pool lleno → la consulta se encola con límite configurable; cola llena → error inmediato "busy"
- **RES-16** (resilience.md): Reconexión con backoff exponencial + jitter: base 1 s, máximo 30 s
- **CHR-31** (characters.md): Bono de competencia +2; aptitud mágica por clase (INT/SAB/CAR; ninguna para marciales)
- **CHR-36** (characters.md): Decisión: PV actuales acotados a [0, PV máx]; temporales no negativos
- **APP-10** (character-appearance.md): feature que no encaja con la raza se acota al dibujar; la piel válida se respeta aunque esté fuera de la paleta (D-0034)
- **SEC-03** (security.md): Tokens con TTL configurable (por defecto 1 h)
- **SEC-06** (security.md): Jugadores no alteran personajes ajenos ni acceden a elementos ocultos
- **SEC-10** (security.md): El DM tiene visibilidad de solo lectura sobre todos los intercambios y ofertas
- **SEC-11** (security.md): Esc.: modificar la hoja de otro jugador → 403 registrado con usuario, campaña y fecha
- **SEC-13** (security.md): Todas las rutas REST protegidas por Token Bucket

## Brechas abiertas y motivo

- **FND-02** (foundry-integration.md, PARTIAL): Foundry es dueño de personajes, NPCs, inventario, bestiario y mapas (tabla de propiedad: espejo de solo lectura) — decisión de producto: qué campos de personajes/objetos espejados de Foundry se bloquean en la app (hoy se pueden editar y la siguiente sincronización los sobrescribe)
- **FND-17** (foundry-integration.md, PARTIAL): Actor "npc" → npcs (nombre, CA, PV, velocidad, descripción) — los NPC de Foundry se escriben en `npcs` pero la UI lee `campaign_npcs`; elegir la tabla destino (y su migración) es una decisión
- **FND-20** (foundry-integration.md, PARTIAL): Escena → maps (nombre, imagen/fondo, notas) — las escenas de Foundry se escriben en `maps` pero la UI lee `campaign_maps`; elegir la tabla destino (y su migración) es una decisión
- **FND-25** (foundry-integration.md, MISSING): (SHOULD) Push de hooks del relay (updateActor) → actualizar el espejo sin resync completo + CHARACTER_UPDATE por Redis — (SHOULD) push en tiempo real desde el relay: trabajo grande que no se puede construir ni probar sin una instancia de Foundry con licencia
- **ARCH-06** (architecture.md, PARTIAL): En foundry, Foundry es la fuente de verdad; el backend mantiene un espejo de solo lectura (one-way) — igual que FND-02 (guardia de solo lectura sobre el espejo de Foundry; decisión)
- **DS-03** (design-system.md, PARTIAL): Acento ember #ff6a3d en oscuro / #e2491c en claro — el acento claro #d6421a es deliberado (#e2491c da ~4,0:1 y no cumple AA); se recomienda enmendar el spec
- **DS-10** (design-system.md, PARTIAL): Sidebar persistente y colapsable en escritorio; barra inferior + menú a pantalla completa en móvil (< 860 px) — pasar el punto de corte móvil de 768 a 860 px desplaza todos los estilos md:; el alcance requiere decisión
- **US-58** (user-stories.md, PARTIAL): El cliente detecta la caída del socket en ≤1 s — detectar la caída del socket en 1 s exige un latido a nivel de app de ~1 s; hoy el latido es de 30 s con vigilancia de 80 s (RES-11). Requiere decisión
- **US-62** (user-stories.md, PARTIAL): Timeout de 10 s para la consulta RAG — igual que CHR-14 (plazo de 30 s frente a 10 s; decisión)
- **LAN-33** (lan-deployment.md, MISSING): Un admin MAY promover usuarios a `dm` — la promoción a dm por un admin es MAY y hoy el rol dm no restringe nada; requiere decisión de producto
- **FS-02** (frontend-screens.md, PARTIAL): Login: correo con etiqueta flotante — etiqueta flotante cosmética; el sistema de diseño usa etiquetas fijas (decisión de diseño)
- **FS-33** (frontend-screens.md, PARTIAL): Hoja: lista de habilidades/competencias (nombre, modificador, bono total) — lista de 18 habilidades con modificador y competencia racial (frontend/src/lib/skills.ts); las elecciones de habilidades de clase y trasfondo no se guardan (requiere decisión de modelo)
- **FS-43** (frontend-screens.md, PARTIAL): Rasgos de clase: nombre + nivel + contador de usos + descripción — el contador de usos por descanso exige decidir cómo se recargan los usos
- **FS-72** (frontend-screens.md, MISSING): Chat: mensaje especial "Tirada solicitada" con icono de dado — un tipo de mensaje «Tirada solicitada» exige decidir si las tiradas van al chat o al lanzador de dados
- **FS-73** (frontend-screens.md, PARTIAL): Chat: redacción con enviar + acción rápida "Tirar dados" — igual que FS-72 (acción rápida «Tirar dados» en el chat; decisión)
- **FS-85** (frontend-screens.md, MISSING): Mercado: miniatura de imagen del objeto — ni el catálogo ni shop_items tienen imágenes de objetos (no hay fuente de datos)
- **FS-93** (frontend-screens.md, MISSING): Ajustes: interruptores de notificaciones push y boletín por correo — la app LAN no tiene canal push ni de correo
- **FS-94** (frontend-screens.md, MISSING): Ajustes: zona de peligro "Eliminar cuenta" — borrar la cuenta exige definir las reglas de cascada (campañas que dirige, personajes, mensajes)
- **FS-115** (frontend-screens.md, PARTIAL): Bestiario: tarjetas con imagen, nombre, VD, tipo — las imágenes de criaturas de 5etools no se importan (no hay fuente de datos)
- **FS-119** (frontend-screens.md, PARTIAL): Ficha: imagen (izq.), nombre + tipo en cursiva, CA y PV — igual que FS-115 (imagen en la ficha de criatura)
- **FS-142** (frontend-screens.md, PARTIAL): Bot: acciones auto-tiradas de NPC, reparto de botín, temporizadores — ejecutar de verdad las automatizaciones del bot es de tamaño L y exige decidir qué hace cada módulo; hoy se guardan y se citan en la prueba del bot
- **FS-172** (frontend-screens.md, PARTIAL): Componente FeatureCard (nivel, contador de usos) — igual que FS-43 (contador de usos; decisión)
- **SRD-51** (srd-data.md, PARTIAL): Toda tabla SRD con `name` MUST soportar FTS vía `tsvector` — tsvector en srd_classes/srd_races/srd_conditions: poco valor (listas cortas cargadas enteras por el creador, sin búsqueda); pendiente de priorizar
- **SRDI-21** (srd-integration.md, PARTIAL): …guardar `srd_ref_id` a srd_equipment o srd_magic_items — srd_ref_id resuelto en el servidor para equipo (content_id contra srd_equipment); apuntar srd_ref_id a objetos mágicos requiere una decisión de esquema
- **SRDI-53** (srd-integration.md, MISSING): …la canalización RAG MAY usar estas reglas como contexto — (MAY) añadir srd_rules al contexto RAG es una decisión de producto
- **SRDI-57** (srd-integration.md, PARTIAL): POST encounter/build con JWT (GM) — /srd/encounter/build no lleva campaña, así que comprobar GM de campaña requiere decisión (cálculo de solo lectura; la ruta del frontend ya está tras GMGuard)
- **SRDI-61** (srd-integration.md, PARTIAL): Endpoints de lista MUST soportar `?limit&offset` — excepción documentada: clases, razas y estados devuelven la lista completa porque el creador necesita ~160 razas (> página máxima de 100)
- **SRDI-63** (srd-integration.md, PARTIAL): Respuesta MUST incluir `total` — igual que SRDI-61 (excepción documentada)
- **VTM-34** (vtt-modes.md, PARTIAL): `vtt.object.updated` {scene_id} — el reinicio de objetos ya incluye scene_id; los hitos son de campaña y quedan como excepción pendiente de decisión
- **RES-05** (resilience.md, PARTIAL): Tipos explícitos: CHARACTER_UPDATE, SPELL_CAST, LORE_QUERY, GAME_EVENT, TRADE_OFFER/ACCEPTED/REJECTED, MESSAGE_GM/PLAYER — POST lore/search se publica como LORE_QUERY; qué significa GAME_EVENT (hoy state.changed es el evento genérico) requiere decisión
- **CHR-13** (characters.md, PARTIAL): RAG: respuesta entregada de forma asíncrona por el canal del socket — la respuesta del Oráculo llega por HTTP, no por socket; requiere decidir si se publica por WebSocket o se enmienda el spec (lan-deployment §4 ya fija 503/504 HTTP)
- **CHR-14** (characters.md, PARTIAL): Timeout: a los 10 s sin respuesta el worker aborta la goroutine — el plazo del Oráculo es 30 s, no 10 s; un LLM local en la Raspberry tarda más de 10 s. Requiere decidir si se enmienda el spec a 30 s
- **SEC-04** (security.md, PARTIAL): Los claims incluyen el rol (gm/player) y el contexto de campaña — el claim role del JWT es el rol global (dm/player/admin); el rol de campaña se resuelve por petición. Requiere decidir si se cambia el claim o se enmienda security.md

## architecture.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARCH-01 | API REST y WebSockets concurrentes con Go + Gin | IMPLEMENTED | cmd/server/main.go:123-150; internal/realtime/hub.go:127-132 |
| ARCH-02 | Frontend SPA en React | IMPLEMENTED | frontend/src/App.tsx; cmd/server/main.go:215-238 (fallback SPA) |
| ARCH-03 | Persistencia relacional y vectorial en una única PostgreSQL con pgvector en Docker | IMPLEMENTED | docker-compose.yml:33 (pgvector/pgvector:pg16); internal/repository/message_repo.go:250-258 |
| ARCH-04 | Cada campaña tiene game_mode; `local` por defecto | IMPLEMENTED | internal/service/campaign_service.go:27-28; internal/domain/campaign.go:36 |
| ARCH-05 | En local el backend es la fuente de verdad y el juego en vivo usa el VTT nativo | IMPLEMENTED | internal/handler/vtt_handler.go; frontend/src/lib/nav.ts:8 |
| ARCH-06 | En foundry, Foundry es la fuente de verdad; el backend mantiene un espejo de solo lectura (one-way) | PARTIAL | El espejo one-way existe (foundry_sync_service.go:65-117) pero no hay guardia de solo lectura (ver FND-02) |
| ARCH-07 | El backend es la única fuente de verdad de lore/RAG, mensajería, mercado, trades, eventos y notas | IMPLEMENTED | cmd/server/main.go:158-211 |
| ARCH-08 | Redis como bus Pub/Sub entre instancias | IMPLEMENTED | internal/pubsub/redis.go:35-61; cmd/server/main.go:50-54,92 |
| ARCH-09 | Ollama solo se usa a través del pool de workers de Go | IMPLEMENTED | igual que RES-12 (prueba del bot vía LoreWorkerPool.GenerateResponse; ver fixes de RES-12) — *corregido 2026-11-22* |
| ARCH-10 | El frontend no usa PostgreSQL directamente | IMPLEMENTED | frontend/src/services/api.ts (solo HTTP /api) |
| ARCH-11 | Conexiones WebSocket autenticadas | IMPLEMENTED | internal/realtime/hub.go:171-178 |
| ARCH-12 | Migraciones versionadas y reversibles | IMPLEMENTED | migrations/migrations.go:13-24; las 29 migraciones 0*.sql tienen `+goose Down` |
| ARCH-13 | Trades atómicos: ítems y oro se transfieren juntos o nada | IMPLEMENTED | internal/repository/trade_repository.go:177-247 |
| ARCH-14 | La oferta bloquea los ítems y el oro del ofertante hasta completar, cancelar o expirar (TTL 10 min) | IMPLEMENTED | internal/repository/trade_repository.go:124-154; cmd/server/main.go:102-115 |
| ARCH-15 | Un conflicto invalida el trade y notifica a ambas partes | IMPLEMENTED | igual que US-74 (TRADE_INVALIDATED publicado al invalidar) — *corregido 2026-11-22* |
| ARCH-16 | Tres tipos de mensaje: GM_BROADCAST, GM_DIRECT, PLAYER_DIRECT | IMPLEMENTED | internal/domain/message.go:8-10 (valores en minúscula) |
| ARCH-17 | Los mensajes directos solo los ven el emisor y el o los destinatarios | IMPLEMENTED | internal/repository/message_repo.go:43-63 |
| ARCH-18 | Entrega offline encolada y entregada al reconectar | IMPLEMENTED | internal/realtime/hub.go:202,231,371-394 (reenvío desde last_event_id); mensajes persistidos (message_repo.go:23-31) |
| ARCH-19 | Historial paginado y acotado por rol | IMPLEMENTED | internal/handler/message_handler.go:65-75; internal/repository/message_repo.go:43-63 |
| ARCH-20 | Tier character_lore: solo el jugador dueño y el GM | IMPLEMENTED | igual que SEC-06 (búsqueda character_lore de jugador limitada a sus personajes) — *corregido 2026-11-22* |
| ARCH-21 | Tier campaign_plot: todos los miembros | IMPLEMENTED | internal/repository/message_repo.go:243-248; RBAC de membresía |
| ARCH-22 | Tier gm_hidden_lore: solo el GM | IMPLEMENTED | internal/service/rag_service.go:146-148; message_repo.go:245 |
| ARCH-23 | El juego en vivo local es el VTT nativo (escenas, tokens, muros, luces, niebla 5e por usuario) | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx; frontend/src/lib/vision.ts; internal/handler/vtt_handler.go |
| ARCH-24 | En foundry, sync one-way vía módulo + relay; el backend solo consume la REST del relay | IMPLEMENTED | internal/foundry/client.go:107-160 |
| ARCH-25 | En foundry la vista en vivo MAY ser el iframe; la UI de Foundry MUST NOT aparecer en campañas local | IMPLEMENTED | /campaign/:id/combat guarded by campaign mode (local campaigns redirect to the hub), any member may open it in Foundry mode, sync button only for the campaign GM — frontend/src/App.tsx:53,105; frontend/src/pages/FoundryCombat.tsx:33 — *corregido 2026-11-22* |

## design-system.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| DS-01 | Tema oscuro por defecto; claro y alto contraste elegibles en Ajustes y guardados por dispositivo | IMPLEMENTED | frontend/src/index.css:10-101; frontend/src/lib/theme.ts:4-8; frontend/index.html:10; frontend/src/pages/SettingsPage.tsx:61-66 |
| DS-02 | Colores, radios, sombras y fuentes como custom properties en index.css; sin hex en componentes salvo mapa/VTT | IMPLEMENTED | frontend/src/index.css:10-216. Hex solo en TableCanvas/VirtualTable (VTT), en las muestras de tema de SettingsPage.tsx:64-66 (previsualizan otros temas) y en los sprites de avatar lib/avatar/* (pixel art, character-appearance.md) |
| DS-03 | Acento ember #ff6a3d en oscuro / #e2491c en claro | PARTIAL | Oscuro correcto (index.css:22); en claro se usa #d6421a (index.css:55). Probablemente adrede: #e2491c sobre blanco da ≈4.0:1 y no pasa AA; #d6421a da ≈4.5:1 |
| DS-04 | Sin violeta/lavanda; "muy raro" usa magenta | IMPLEMENTED | rar-* tokens (very rare = magenta in all three themes) mapped to --color-rar-*; used by InventoryTab and market badges — frontend/src/index.css:42-47,81-82,111-112,205-210; frontend/src/pages/InventoryTab.tsx:18-22; frontend/src/services/marketApi.ts:129-130 — *corregido 2026-11-22* |
| DS-05 | Tipografías: Geist (UI), Fraunces (nombres propios y lectura), Geist Mono (números) | IMPLEMENTED | frontend/index.html:14; frontend/src/index.css:194-196,284-285 |
| DS-06 | Tokens ok/warn/bad con umbrales de PV ≥60 % / <30 % | IMPLEMENTED | HpPanel amber threshold 60 % — frontend/src/components/character/HpPanel.tsx:43 — *corregido 2026-11-22* |
| DS-07 | Tokens info y gold | IMPLEMENTED | frontend/src/index.css:26-36 |
| DS-08 | Tokens role-player / role-dm / role-admin | IMPLEMENTED | role-player/--role-dm/--role-admin tokens, used by the top bar role label — frontend/src/index.css:39-41,202-204; frontend/src/components/layout/TopAppBar.tsx:30 — *corregido 2026-11-22* |
| DS-09 | Tokens rar-* de rareza (común, poco común, raro, muy raro, legendario) | IMPLEMENTED | rar-* tokens (very rare = magenta in all three themes) mapped to --color-rar-*; used by InventoryTab and market badges — frontend/src/index.css:42-47,81-82,111-112,205-210; frontend/src/pages/InventoryTab.tsx:18-22; frontend/src/services/marketApi.ts:129-130 — *corregido 2026-11-22* |
| DS-10 | Sidebar persistente y colapsable en escritorio; barra inferior + menú a pantalla completa en móvil (< 860 px) | PARTIAL | Implementado con el breakpoint `md` de Tailwind (768 px), no con 860 (components/layout/SideNav.tsx:47; Layout.tsx:34; no se sobrescribe --breakpoint-md en index.css) |
| DS-11 | Barra superior: breadcrumb, estado de conexión (conectado/reconectando/offline) y usuario con rol | IMPLEMENTED | frontend/src/components/layout/TopAppBar.tsx:18-50 |
| DS-12 | Herramientas del DM agrupadas en "Dirección", visibles solo para GM/admin | IMPLEMENTED | frontend/src/components/layout/SideNav.tsx:68; frontend/src/lib/nav.ts:18; BottomNav.tsx:30 (GM de campaña; el backend tampoco da poderes de campaña a admin) |
| DS-13 | Tirador rápido en todas las pantallas de campaña (d20–d4, modificador, normal/ventaja/desventaja, secreta para el GM) | IMPLEMENTED | frontend/src/components/layout/DiceRoller.tsx:6,36,58-67; Layout.tsx:41 |
| DS-14 | Contraste de texto WCAG AA en todos los temas | IMPLEMENTED | faint meets AA (dark #868a93 ≥4.7:1 on bg/elev/surface/surface-2; light #666970 ≥4.5:1 on all surfaces; contrast theme already passed) — frontend/src/index.css:22,65 — *corregido 2026-11-22* |
| DS-15 | Foco visible | IMPLEMENTED | frontend/src/index.css:230,248-253 |
| DS-16 | (SHOULD) Objetivos interactivos ≥ 28 px | IMPLEMENTED | frontend/src/index.css:263,275-277 (mc-btn 34 px, sm 28 px) |
| DS-17 | prefers-reduced-motion desactiva las animaciones | IMPLEMENTED | frontend/src/index.css:326-328 |

## security.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| SEC-01 | No se admite ni documenta JWT en la query string | IMPLEMENTED | internal/middleware/auth_middleware.go:20-33; internal/realtime/hub.go:165-175 (sin c.Query("token") en el repo) |
| SEC-02 | JWT solo en `Authorization: Bearer` (REST) y en el primer frame JSON (WS) | IMPLEMENTED | internal/middleware/auth_middleware.go:20-33; internal/realtime/hub.go:165-180; frontend/src/lib/RealtimeProvider.tsx:38 |
| SEC-03 | Tokens con TTL configurable (por defecto 1 h) | IMPLEMENTED | TTL defaults 3600/86400 when unset. internal/config/config.go:160,206; test internal/config/config_test.go — *corregido 2026-11-22* |
| SEC-04 | Los claims incluyen el rol (gm/player) y el contexto de campaña | PARTIAL | internal/service/auth_service.go:179-184 (rol global dm/player/admin); internal/middleware/auth_middleware.go:39-46 (campaña resuelta por petición) |
| SEC-05 | El middleware valida el rol en cada interacción | IMPLEMENTED | internal/middleware/auth_middleware.go:51-96; internal/middleware/character_middleware.go:13-36 |
| SEC-06 | Jugadores no alteran personajes ajenos ni acceden a elementos ocultos | IMPLEMENTED | A player's character_lore search without character_id is restricted to their own characters (internal/service/rag_service.go:173). The repo scope filter is in internal/repository/message_repo.go (LoreSearchScope). GetByCharacter hides gm_hidden_lore from players (message_repo.go:258). ListVisible hides gm_hidden_lore (message_repo.go:276). visible() denies hidden entries on the player's own character (internal/han… — *corregido 2026-11-22* |
| SEC-07 | El DM tiene visibilidad total del estado de la campaña | IMPLEMENTED | internal/middleware/auth_middleware.go:89-91; internal/service/character_service.go:134-137 |
| SEC-08 | Los jugadores solo inician intercambios con sus propios personajes | IMPLEMENTED | internal/service/trade_service.go:42-45 |
| SEC-09 | Los jugadores no ven ofertas pendientes de otros jugadores | IMPLEMENTED | internal/repository/trade_repository.go:306-311 |
| SEC-10 | El DM tiene visibilidad de solo lectura sobre todos los intercambios y ofertas | IMPLEMENTED | The GM bypass is removed from create/accept/reject/cancel/counter (internal/service/trade_service.go:72 mayActOnTrade); test internal/service/trade_authz_test.go. Trade.tsx shows actions only for the user's own character, so the GM gets none — *corregido 2026-11-22* |
| SEC-11 | Esc.: modificar la hoja de otro jugador → 403 registrado con usuario, campaña y fecha | IMPLEMENTED | CharacterService.AuthorizeInCampaign returns the campaign id. The middleware sets the audit campaign and reason before a 403 (internal/middleware/character_middleware.go:32). Test: internal/middleware/character_audit_test.go. — *corregido 2026-11-22* |
| SEC-12 | Esc.: el DM accede a la trama oculta y la respuesta la incluye | IMPLEMENTED | internal/repository/message_repo.go:243-247; internal/handler/lore_handler.go:50; internal/service/rag_service.go:146 |
| SEC-13 | Todas las rutas REST protegidas por Token Bucket | IMPLEMENTED | authIPLimit on POST /api/auth/logout (cmd/server/main.go:149) — *corregido 2026-11-22* |
| SEC-14 | Ritmo por defecto 100 req/min por usuario | IMPLEMENTED | internal/config/config.go:83-85; internal/middleware/ratelimit_middleware.go:189-210 |
| SEC-15 | Capacidad de ráfaga configurable por categoría de endpoint | IMPLEMENTED | internal/middleware/ratelimit_middleware.go:104-122,176-187; internal/config/config.go:73 |
| SEC-16 | WebSocket limitado a 5 mensajes por segundo | IMPLEMENTED | internal/realtime/hub.go:62-74,204,224; internal/config/config.go:86-88 |
| SEC-17 | Al violarlo, cierre inmediato con código 1008 | IMPLEMENTED | internal/realtime/hub.go:226-228,246-250 |
| SEC-18 | Esc.: >5 msgs en 1 s → cierre 1008, registro e IP bloqueada 30 s | IMPLEMENTED | internal/realtime/hub.go:152-157,247-249; internal/config/config.go:92-94 |
| SEC-19 | Se registran todas las violaciones de límite de ritmo | IMPLEMENTED | internal/middleware/audit_logger.go:176-179; internal/middleware/ratelimit_middleware.go:244-251 |
| SEC-20 | Se registran todos los fallos de autenticación | IMPLEMENTED | internal/middleware/audit_logger.go:107-120; internal/realtime/hub.go:171-178 |
| SEC-21 | Se registran todos los rechazos RBAC | IMPLEMENTED | internal/middleware/audit_logger.go:112,176-179 |
| SEC-22 | Entradas con fecha, usuario (si se conoce), IP, endpoint/acción y motivo | IMPLEMENTED | internal/middleware/audit_logger.go:96-105,148-178 |
| SEC-23 | Clave del relay de Foundry por env/config, nunca en el repo ni en el frontend | IMPLEMENTED | internal/config/config.go:179; config.yaml:48; .gitignore:49-51 |
| SEC-24 | El backend envía `x-api-key` solo del lado servidor; el cliente React no la recibe ni la reenvía | IMPLEMENTED | internal/foundry/client.go:150; internal/handler/foundry_handler.go:162-178 |
| SEC-25 | POST /api/foundry/sync solo para gm; jugadores 403 registrado | IMPLEMENTED | internal/handler/foundry_handler.go:68-71,86 |
| SEC-26 | Esc.: ningún bundle ni respuesta al navegador contiene la api_key | IMPLEMENTED | internal/handler/foundry_handler.go:162-186 (sin api_key en frontend/src) |
| SEC-27 | El proxy delante de Foundry restringe `frame-ancestors` a los orígenes de la app (sin comodín) | UNVERIFIABLE-IN-CODE | FOUNDRY_SETUP.md:72 (proxy externo); cmd/server/main.go:314-324 (CSP propia de la app) |
| SEC-28 | La cookie de sesión de Foundry `SameSite=None; Secure` solo sobre HTTPS | UNVERIFIABLE-IN-CODE | FOUNDRY_SETUP.md:74 |
| SEC-29 | CORS para llamadas desde el origen de Foundry limitado a orígenes conocidos | IMPLEMENTED | cmd/server/main.go:278-301; internal/config/config.go:185-189 |
| SEC-30 | Decisión: X-Forwarded-For solo desde proxies de `server.trusted_proxies` (TRUSTED_PROXIES) | IMPLEMENTED | cmd/server/main.go:126-128; internal/config/config.go:190-196 |
| SEC-31 | Decisión: WS 5 msg/s general, `vtt.move` 15/s; exceso → 1008 y baneo de IP 30 s | IMPLEMENTED | internal/realtime/hub.go:56-57,206-228 |
| SEC-32 | Decisión: login/registro/refresh limitados por IP (auth); ráfagas comparten presupuesto total por usuario | IMPLEMENTED | cmd/server/main.go:144-147; internal/middleware/ratelimit_middleware.go:201-224 |
| SEC-33 | Decisión: monstruos propios los crea cualquier autenticado; solo creador o admin editan/borran; catálogo de solo lectura | IMPLEMENTED | internal/repository/srd_repo.go:689,706; internal/handler/srd_handler.go:368,382 |

## resilience.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RES-01 | El estado de las conexiones WS se coordina externamente por canales Redis | IMPLEMENTED | internal/realtime/hub.go:280-295; internal/pubsub/redis.go:58-71 |
| RES-02 | Canal `campaign:{campaignId}` | IMPLEMENTED | internal/pubsub/redis.go:59,98,105 |
| RES-03 | Escenario: dos instancias, una mutación en "campaign:42" llega a todas las conexiones con vista consistente | IMPLEMENTED | internal/realtime/hub.go:288,297-323 (cada instancia se suscribe y reemite; estado en PostgreSQL) |
| RES-04 | Todos los mensajes Pub/Sub incluyen `timestamp` | IMPLEMENTED | internal/pubsub/redis.go:85,95,104 (segundos Unix; la deduplicación real usa event_id) |
| RES-05 | Tipos explícitos: CHARACTER_UPDATE, SPELL_CAST, LORE_QUERY, GAME_EVENT, TRADE_OFFER/ACCEPTED/REJECTED, MESSAGE_GM/PLAYER | PARTIAL | internal/realtime/middleware.go:60-104 emite CHARACTER_UPDATE, SPELL_CAST, TRADE_*, MESSAGE_*; LORE_QUERY y GAME_EVENT solo existen en el paquete sin uso internal/websocket/message_types.go:11-13 — *avance 2026-11-22: POST lore/search se publica como LORE_QUERY; qué significa GAME_EVENT (hoy state.changed es el evento genérico) requiere decisión* |
| RES-06 | El servidor emite Ping cada 30 s | IMPLEMENTED | internal/realtime/hub.go:53,339-348 |
| RES-07 | Sin Pong en 10 s la sesión se considera muerta | IMPLEMENTED | internal/realtime/hub.go:54,343,214-218 |
| RES-08 | Al morir se purgan todos los recursos de memoria y la presencia en Redis | IMPLEMENTED | internal/realtime/hub.go:192,268-278 (no se guarda presencia en Redis: nada que purgar) |
| RES-09 | Escenario heartbeat: ping, temporizador de 10 s, cierre forzado, limpieza de sesión | IMPLEMENTED | internal/realtime/hub.go:162,192,197-198,339-348 |
| RES-10 | El cliente responde a los Ping automáticamente | IMPLEMENTED | la API WebSocket del navegador responde a los frames de control de forma nativa; frontend/src/lib/RealtimeProvider.tsx:33 |
| RES-11 | El cliente detecta 2 Pong perdidos seguidos, cierra el socket e inicia la reconexión | IMPLEMENTED | server text heartbeat {"type":"heartbeat"} every 30 s with the ping; client watchdog closes after 80 s of silence and reconnects — internal/realtime/hub.go:64,370; frontend/src/lib/RealtimeProvider.tsx:9,33; test internal/realtime/heartbeat_test.go — *corregido 2026-11-22* |
| RES-12 | Un pool fijo de goroutines atiende todas las interacciones con Ollama | IMPLEMENTED | LoreWorkerPool.GenerateResponse (internal/service/rag_worker.go:108); the bot test is wired to lorePool (cmd/server/main.go:96); RAG_BUSY is mapped in bot_test_handler.go:121. Test: rag_worker_test.go — *corregido 2026-11-22* |
| RES-13 | Tamaño configurable, 4 por defecto | IMPLEMENTED | DefaultLorePoolSize = 4 (rag_worker.go:51) — *corregido 2026-11-22* |
| RES-14 | Los workers no bloquean el bucle de eventos WS | IMPLEMENTED | internal/service/rag_worker.go:84-92; internal/handler/lore_handler.go:165-180 |
| RES-15 | Escenario: pool lleno → la consulta se encola con límite configurable; cola llena → error inmediato "busy" | IMPLEMENTED | ErrLoreBusy sentinel (rag_worker.go:15). /lore/search answers 503 RAG_BUSY "El Oráculo está ocupado; inténtalo en unos segundos" (lore_handler.go:178), and LoreSearch.tsx shows it — *corregido 2026-11-22* |
| RES-16 | Reconexión con backoff exponencial + jitter: base 1 s, máximo 30 s | IMPLEMENTED | reconnect backoff base 1 s — frontend/src/lib/RealtimeProvider.tsx:28,45 — *corregido 2026-11-22* |
| RES-17 | Tras reconectar el cliente envía su último marcador para sincronizar el delta | IMPLEMENTED | frontend/src/lib/RealtimeProvider.tsx:38; internal/realtime/hub.go:202,371-392 (usa last_event_id en lugar de timestamp) |
| RES-18 | Apagado 1: dejar de aceptar conexiones | IMPLEMENTED | cmd/server/main.go:260,263; internal/realtime/hub.go:147-150 |
| RES-19 | Apagado 2: cerrar los WS con 1001 | IMPLEMENTED | internal/realtime/hub.go:84-99 |
| RES-20 | Apagado 3: vaciar los mensajes Pub/Sub pendientes | IMPLEMENTED | publicación síncrona sin búfer (internal/pubsub/redis.go:35-41); cmd/server/main.go:267 |
| RES-21 | Apagado 4: esperar las peticiones HTTP en curso con timeout | IMPLEMENTED | cmd/server/main.go:261-265 |
| RES-22 | Apagado 5: cerrar BD y Redis limpiamente | IMPLEMENTED | cmd/server/main.go:42,267 |
| RES-23 | El relay de Foundry se trata como dependencia externa que puede fallar | IMPLEMENTED | internal/service/foundry_sync_service.go:65-117; internal/foundry/client.go:105-129 |
| RES-24 | Escenario relay caído: error descriptivo, sin escritura parcial (cada tipo atómico), foundry_sync_state = error con causa y fecha | IMPLEMENTED | internal/service/foundry_sync_service.go:87-116; internal/repository/foundry_repo.go:37,205; internal/service/foundry_reference_sync_db_test.go:23 |
| RES-25 | Escenario diarios → lore: la sync no bloquea en Ollama; embeddings encolados en el pool respetando su límite | IMPLEMENTED | internal/service/foundry_sync_service.go:393-400; cmd/server/main.go:81 |
| RES-26 | Llamadas al relay con timeout configurable y reintentos acotados con backoff | IMPLEMENTED | internal/config/config.go:113-133; internal/foundry/client.go:50-52,95-129 |
| RES-27 | Una sync fallida no afecta a las funciones propias (lore, mensajería…) | IMPLEMENTED | internal/service/foundry_sync_service.go:87-92 (sync aislada; resto de servicios independientes) |

## lan-deployment.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| LAN-01 | Cada campaña tiene `game_mode` `local` (defecto) o `foundry` | IMPLEMENTED | migrations/014_playable_campaign.sql:2; internal/service/campaign_service.go:27-29; internal/domain/campaign.go:36 |
| LAN-02 | En modo local el backend es la fuente de verdad del estado | IMPLEMENTED | Personajes/combate/VTT nativos (cmd/server/main.go:173-210); frontend/src/pages/GMConsole.tsx:201 |
| LAN-03 | En modo local no se muestran endpoints ni UI de Foundry | IMPLEMENTED | /campaign/:id/combat guarded by campaign mode (local campaigns redirect to the hub), any member may open it in Foundry mode, sync button only for the campaign GM — frontend/src/App.tsx:53,105; frontend/src/pages/FoundryCombat.tsx:33 — *corregido 2026-11-22* |
| LAN-04 | En modo foundry aplica foundry-integration; el VTT nativo puede usarse | IMPLEMENTED | Rutas VTT sin restricción de modo (cmd/server/main.go:207) |
| LAN-05 | El relay de Foundry no es necesario para arrancar | IMPLEMENTED | cmd/server/main.go:78-81 (sin ping al relay) |
| LAN-06 | Arranque con `docker compose up -d` y `docker-compose.yml` en la raíz | IMPLEMENTED | docker-compose.yml:1-30 |
| LAN-07 | Stack: postgres (pgvector), redis y app (SPA + `/uploads`) | IMPLEMENTED | docker-compose.yml:11,32-33,47; cmd/server/main.go:214-238 |
| LAN-08 | `ollama` como perfil opcional `ai` | IMPLEMENTED | docker-compose.yml:58-60 |
| LAN-09 | Relay de Foundry como perfil opcional `foundry` | IMPLEMENTED | docker-compose.yml:65-67 |
| LAN-10 | Imagen multi-stage (Node para frontend, Go para cmd/server) | IMPLEMENTED | Dockerfile:3-18 |
| LAN-11 | La app corre como usuario no root | IMPLEMENTED | Dockerfile:21,30 |
| LAN-12 | Migraciones automáticas al arrancar | IMPLEMENTED | cmd/server/main.go:46 |
| LAN-13 | Uploads y datos en volúmenes con nombre | IMPLEMENTED | docker-compose.yml:29-30,39-40,73-80 |
| LAN-14 | Escucha en `0.0.0.0:${APP_PORT:-8080}` | IMPLEMENTED | docker-compose.yml:19; Dockerfile:28-29; internal/config/config.go:147-149 |
| LAN-15 | Orígenes WS/CORS configurables con `ALLOWED_ORIGINS` | IMPLEMENTED | internal/config/config.go:185-189; docker-compose.yml:28 |
| LAN-16 | Same-origin aceptado sin listar cada IP de la LAN | IMPLEMENTED | internal/realtime/hub.go:134-142; frontend/src/services/api.ts:5 |
| LAN-17 | `JWT_SECRET` obligatorio; no arranca sin él | IMPLEMENTED | docker-compose.yml:21; cmd/server/main.go:35-37; internal/config/config.go:203-205 |
| LAN-18 | Gherkin: la SPA carga desde `http://<ip>:8080` | IMPLEMENTED | cmd/server/main.go:215-238 |
| LAN-19 | Login, REST y WS funcionan contra el mismo origen | IMPLEMENTED | frontend/src/services/api.ts:5; frontend/src/lib/RealtimeProvider.tsx:32-33 |
| LAN-20 | Sin Ollama el servidor arranca y el resto funciona | IMPLEMENTED | cmd/server/main.go:77-80 (sin dependencia en arranque) |
| LAN-21 | Lore degrada a búsqueda por palabras con prefijo "Sin IA en este servidor…" y `sources` | IMPLEMENTED | internal/service/rag_service.go:175-180,210-213 |
| LAN-22 | La búsqueda degradada respeta las reglas de tier del llamante | IMPLEMENTED | A player's character_lore search without character_id is restricted to their own characters (internal/service/rag_service.go:173). The repo scope filter is in internal/repository/message_repo.go (LoreSearchScope). GetByCharacter hides gm_hidden_lore from players (message_repo.go:258). ListVisible hides gm_hidden_lore (message_repo.go:276). visible() denies hidden entries on the player's own character (internal/han… — *corregido 2026-11-22* |
| LAN-23 | Fallos de embedding se registran; la entrada queda sin vectorizar | IMPLEMENTED | internal/service/rag_worker.go:54-60 |
| LAN-24 | `RAG_UNAVAILABLE` 503 solo si la consulta no puede ejecutarse | IMPLEMENTED | internal/handler/lore_handler.go:173-175; internal/service/rag_worker.go:88-89 |
| LAN-25 | `RAG_TIMEOUT` 504 al exceder el plazo | IMPLEMENTED | internal/handler/lore_handler.go:178-179 |
| LAN-26 | La UI muestra "El Oráculo no está disponible en este servidor" | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:26; internal/handler/lore_handler.go:174 |
| LAN-27 | Bot test sin modelo de lenguaje → 503 `RAG_UNAVAILABLE` | IMPLEMENTED | internal/handler/bot_test_handler.go:100-102,119-121 |
| LAN-28 | Gherkin sin perfil ai: respuesta con pasajes legibles y fuentes | IMPLEMENTED | internal/service/rag_service.go:210-213 |
| LAN-29 | Gherkin: ninguna otra pantalla se ve afectada | IMPLEMENTED | Ollama solo en lore y bot (cmd/server/main.go:77,95) |
| LAN-30 | Gherkin: consulta no ejecutable → mensaje de Oráculo no disponible | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:26 |
| LAN-31 | El primer usuario de una instalación vacía recibe rol `admin` | IMPLEMENTED | internal/repository/campaign_repo.go:21-27 |
| LAN-32 | Los siguientes se registran como `player` | IMPLEMENTED | internal/service/auth_service.go:57 |
| LAN-33 | Un admin MAY promover usuarios a `dm` | MISSING | No hay endpoint de cambio de rol; sin impacto práctico: cualquier usuario crea campañas (internal/handler/auth_handler.go:112-127) |

## user-stories.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| US-01 | Login HTTP devuelve JWT firmado con claim de rol y expiración | IMPLEMENTED | cmd/server/main.go:145; internal/service/auth_service.go:40,181 |
| US-02 | El cliente abre un WebSocket tras autenticarse | IMPLEMENTED | frontend/src/lib/RealtimeProvider.tsx:33 |
| US-03 | El primer frame WS lleva el JWT en JSON para validación definitiva | IMPLEMENTED | frontend/src/lib/RealtimeProvider.tsx:38; internal/realtime/hub.go:165-175 |
| US-04 | Validación correcta promueve la conexión a sesión autenticada | IMPLEMENTED | internal/realtime/hub.go:187-201 (AUTH_SUCCESS) |
| US-05 | La pregunta de lore se envía por el canal WS | SUPERSEDED | REST `POST /campaigns/:id/lore/search` (internal/handler/lore_handler.go:32); lan-deployment.md §4 (decisión 2026-11-21) fija 503/504 HTTP |
| US-06 | El backend convierte el prompt en vector | IMPLEMENTED | internal/service/rag_service.go:169 |
| US-07 | Búsqueda por similitud en pgvector | IMPLEMENTED | internal/repository/message_repo.go:250-257 |
| US-08 | Se adjunta contexto relevante al prompt | IMPLEMENTED | internal/service/rag_service.go:188-208 |
| US-09 | Ollama responde de forma asíncrona por el socket | SUPERSEDED | Pool asíncrono + respuesta HTTP (internal/service/rag_worker.go:84-92; internal/handler/lore_handler.go:167-180); ver lan-deployment.md §4 |
| US-10 | La respuesta incluye referencias a fuentes | IMPLEMENTED | internal/service/rag_service.go:189-196; internal/handler/lore_handler.go:177 |
| US-11 | Cambio de PV se propaga a los jugadores de la campaña | IMPLEMENTED | internal/realtime/middleware.go:43,87; cmd/server/main.go:176 |
| US-12 | El estado se persiste en PostgreSQL | IMPLEMENTED | internal/repository/character_repo.go:88 |
| US-13 | El GM recibe la actualización con visibilidad completa | IMPLEMENTED | internal/realtime/hub.go:297-322 (sin audiencia = todos los miembros) |
| US-14 | A inicia oferta con objetos y/u oro | IMPLEMENTED | internal/handler/trade_handler.go:63-84; internal/repository/trade_repository.go:112-163 |
| US-15 | B recibe la notificación pendiente en tiempo real | IMPLEMENTED | internal/realtime/middleware.go:82-83 (TRADE_OFFER); frontend/src/lib/RealtimeProvider.tsx:49-53 |
| US-16 | B ve los objetos y el oro ofrecidos | IMPLEMENTED | the trade list names the offered and requested items. internal/domain/trade.go:44; internal/repository/trade_repository.go:325; frontend/src/pages/Trade.tsx. Tests: internal/domain/trade_names_test.go, internal/repository/trade_items_db_test.go — *corregido 2026-11-22* |
| US-17 | B puede aceptar, rechazar o contraofertar | IMPLEMENTED | cmd/server/main.go:190-194; frontend/src/pages/Trade.tsx:102 |
| US-18 | Al aceptar, objetos/oro se transfieren atómicamente | IMPLEMENTED | internal/repository/trade_repository.go:170-246 (una transacción) |
| US-19 | Inventarios de ambos actualizados en PostgreSQL | IMPLEMENTED | internal/repository/trade_repository.go:236-241 |
| US-20 | El intercambio se difunde a toda la campaña como evento | IMPLEMENTED | internal/realtime/middleware.go:71-72; internal/realtime/hub.go:363 |
| US-21 | El registro de intercambios es visible para el GM | IMPLEMENTED | internal/repository/trade_repository.go:306-311; frontend/src/pages/Trade.tsx:102 |
| US-22 | Objeto equipado o de misión: el sistema impide el intercambio | IMPLEMENTED | internal/repository/trade_repository.go:51-63,139-146 |
| US-23 | Se muestra error de objeto no intercambiable | IMPLEMENTED | internal/handler/trade_handler.go:49-50; frontend/src/pages/Trade.tsx:67,83 |
| US-24 | Cancelar antes de aceptar invalida la oferta | IMPLEMENTED | internal/service/trade_service.go:84-90; internal/repository/trade_repository.go:250-259 |
| US-25 | El receptor es notificado de la cancelación | IMPLEMENTED | internal/realtime/middleware.go:75-76 (TRADE_CANCELLED); frontend/src/pages/Trade.tsx:18 |
| US-26 | Cancelar no muta estado | IMPLEMENTED | internal/repository/trade_repository.go:250-259 (solo libera bloqueos) |
| US-27 | Transferencia de 200 po: A 500→300, B 100→300 | IMPLEMENTED | internal/repository/trade_repository.go:230-235 |
| US-28 | La transacción se registra en el log de auditoría de la campaña | IMPLEMENTED | The TRADE_ACCEPTED game_events payload now carries trade_id, both character ids, both gold amounts and both item id arrays. The handler sets realtime.EventDetailsKey (internal/handler/trade_handler.go:106), which is merged in internal/realtime/middleware.go:63. Test: TestTradeAuditDetails. game_events is the campaign audit trail; audit_logs is still unused — *corregido 2026-11-22* |
| US-29 | Ambos cambios se difunden en una sola operación atómica | IMPLEMENTED | internal/repository/trade_repository.go:170-246; un único evento TRADE_ACCEPTED |
| US-30 | Transferir más oro del que se posee se rechaza | IMPLEMENTED | internal/repository/trade_repository.go:130-132 |
| US-31 | Error "Insufficient gold balance" | IMPLEMENTED | internal/repository/trade_repository.go:36-41; internal/handler/trade_handler.go:41-44 |
| US-32 | Sin mutación de oro al rechazar | IMPLEMENTED | internal/repository/trade_repository.go:79 (rollback) |
| US-33 | "Mi historia": búsqueda acotada al lore personal del personaje | IMPLEMENTED | A player's character_lore search without character_id is restricted to their own characters (internal/service/rag_service.go:173). The repo scope filter is in internal/repository/message_repo.go (LoreSearchScope). GetByCharacter hides gm_hidden_lore from players (message_repo.go:258). ListVisible hides gm_hidden_lore (message_repo.go:276). visible() denies hidden entries on the player's own character (internal/han… — *corregido 2026-11-22* |
| US-34 | Solo se consultan los vectores de la historia del propio jugador | IMPLEMENTED | A player's character_lore search without character_id is restricted to their own characters (internal/service/rag_service.go:173). The repo scope filter is in internal/repository/message_repo.go (LoreSearchScope). GetByCharacter hides gm_hidden_lore from players (message_repo.go:258). ListVisible hides gm_hidden_lore (message_repo.go:276). visible() denies hidden entries on the player's own character (internal/han… — *corregido 2026-11-22* |
| US-35 | La respuesta solo usa la sección de historia del personaje | IMPLEMENTED | A player's character_lore search without character_id is restricted to their own characters (internal/service/rag_service.go:173). The repo scope filter is in internal/repository/message_repo.go (LoreSearchScope). GetByCharacter hides gm_hidden_lore from players (message_repo.go:258). ListVisible hides gm_hidden_lore (message_repo.go:276). visible() denies hidden entries on the player's own character (internal/han… — *corregido 2026-11-22* |
| US-36 | No incluye historias de otros personajes ni trama oculta | IMPLEMENTED | A player's character_lore search without character_id is restricted to their own characters (internal/service/rag_service.go:173). The repo scope filter is in internal/repository/message_repo.go (LoreSearchScope). GetByCharacter hides gm_hidden_lore from players (message_repo.go:258). ListVisible hides gm_hidden_lore (message_repo.go:276). visible() denies hidden entries on the player's own character (internal/han… — *corregido 2026-11-22* |
| US-37 | "Trama": búsqueda acotada a campaign_plot compartida | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:16-20; internal/repository/message_repo.go:254,273 |
| US-38 | Incluye resúmenes de capítulos y eventos resueltos | IMPLEMENTED | Entradas campaign_plot con chapter_order (internal/repository/message_repo.go:275; frontend/src/pages/LoreEditor.tsx:56) |
| US-39 | No incluye lore oculto del GM | IMPLEMENTED | internal/service/rag_service.go:146-148; internal/repository/message_repo.go:254 |
| US-40 | Consulta del GM incluye todos los tiers (trama, historias, oculto) | IMPLEMENTED | GM-only "all" scope (domain.LoreScopeAll; rag_service.go:146 forbids it for players) and a "Todo" chip (frontend/src/pages/LoreSearch.tsx:21) — *corregido 2026-11-22* |
| US-41 | La respuesta del GM refleja acceso total | IMPLEMENTED | GM-only "all" scope (domain.LoreScopeAll; rag_service.go:146 forbids it for players) and a "Todo" chip (frontend/src/pages/LoreSearch.tsx:21) — *corregido 2026-11-22* |
| US-42 | Mensaje directo del GM entregado en tiempo real por WS | IMPLEMENTED | Aviso MESSAGE_GM + recarga REST: internal/realtime/middleware.go:96-99; frontend/src/lib/RealtimeProvider.tsx:49-53 |
| US-43 | Aparece en la bandeja privada del jugador | IMPLEMENTED | internal/repository/message_repo.go:43-53,88-124; frontend/src/pages/Messages.tsx:63 |
| US-44 | No es visible para otros jugadores | IMPLEMENTED | internal/repository/message_repo.go:48 (el evento WS no lleva contenido) |
| US-45 | El GM recibe confirmación de entrega | IMPLEMENTED | Hub.IsOnline and OnlineUsers (internal/realtime/hub.go:276,288). POST messages returns delivery "delivered" or "queued" (internal/handler/message_handler.go:47). Messages.tsx shows "Mensaje en cola: X lo recibirá cuando se conecte." — *corregido 2026-11-22* |
| US-46 | El GM puede elegir "enviar a todos" | IMPLEMENTED | frontend/src/pages/Messages.tsx:34-35,58 |
| US-47 | Anuncio entregado a todos los conectados en tiempo real | IMPLEMENTED | gm_broadcast is stored as one row per other member in one INSERT..SELECT (internal/repository/message_repo.go:36 CreateBroadcast; message_service.go). Real-DB test internal/service/message_broadcast_db_test.go checks the conversation list, history and unread count for each player — *corregido 2026-11-22* |
| US-48 | Anuncio persistido en el historial de cada jugador | IMPLEMENTED | gm_broadcast is stored as one row per other member in one INSERT..SELECT (internal/repository/message_repo.go:36 CreateBroadcast; message_service.go). Real-DB test internal/service/message_broadcast_db_test.go checks the conversation list, history and unread count for each player — *corregido 2026-11-22* |
| US-49 | Jugadores offline reciben el anuncio al reconectar | IMPLEMENTED | gm_broadcast is stored as one row per other member in one INSERT..SELECT (internal/repository/message_repo.go:36 CreateBroadcast; message_service.go). Real-DB test internal/service/message_broadcast_db_test.go checks the conversation list, history and unread count for each player — *corregido 2026-11-22* |
| US-50 | Mensaje entre jugadores entregado en tiempo real | IMPLEMENTED | internal/realtime/middleware.go:100 (MESSAGE_PLAYER) |
| US-51 | Aparece solo en la bandeja de B | IMPLEMENTED | internal/repository/message_repo.go:48 |
| US-52 | No visible a otros jugadores ni al GM salvo que sea destinatario | IMPLEMENTED | internal/repository/message_repo.go:48; internal/service/message_service.go:42-47 |
| US-53 | El emisor ve el mensaje como "enviado" | IMPLEMENTED | Own bubbles show "Enviado", or "Leído" once read (Messages.tsx:99) — *corregido 2026-11-22* |
| US-54 | Historial de mensajes vía REST | IMPLEMENTED | cmd/server/main.go:169-170 |
| US-55 | Paginado por fecha | IMPLEMENTED | internal/repository/message_repo.go:49-50; internal/handler/message_handler.go:65-76 |
| US-56 | Solo mensajes relevantes al rol y destinatarios | IMPLEMENTED | internal/repository/message_repo.go:47-48 |
| US-57 | Mensajes ocultos del GM no aparecen a jugadores | IMPLEMENTED | Consulta por pareja (internal/repository/message_repo.go:48); no existe tipo oculto |
| US-58 | El cliente detecta la caída del socket en ≤1 s | PARTIAL | Solo `onclose` del navegador (frontend/src/lib/RealtimeProvider.tsx:57); sin heartbeat de cliente para caídas silenciosas |
| US-59 | Reconexión con backoff exponencial y jitter | IMPLEMENTED | frontend/src/lib/RealtimeProvider.tsx:57-61 |
| US-60 | Al reconectar pide sincronización con el último marcador | IMPLEMENTED | Cursor `last_event_id` en vez de timestamp: frontend/src/lib/RealtimeProvider.tsx:38 |
| US-61 | El backend devuelve los deltas desde ese marcador | IMPLEMENTED | internal/realtime/hub.go:371-392 (máx. 200 por reconexión; el cliente recarga consultas activas) |
| US-62 | Timeout de 10 s para la consulta RAG | PARTIAL | Plazo efectivo 30 s (internal/handler/lore_handler.go:165) y LLM 3×timeout (internal/service/rag_service.go:111) |
| US-63 | El worker aborta la goroutine limpiamente | IMPLEMENTED | internal/service/rag_worker.go:63,85 (ctx propagado, canal con buffer) |
| US-64 | Notificación de error controlada al usuario | IMPLEMENTED | internal/handler/lore_handler.go:178-179; frontend/src/pages/LoreSearch.tsx:27 |
| US-65 | Payload `{type: RAG_TIMEOUT, message, retryable: true}` | IMPLEMENTED | internal/handler/lore_handler.go:179 |
| US-66 | JWT inválido/expirado en el primer frame: cierre 4001 | IMPLEMENTED | internal/realtime/hub.go:170-179 |
| US-67 | No se aceptan más frames de ese cliente | IMPLEMENTED | internal/realtime/hub.go:179 (return + defer Close) |
| US-68 | Modificar personaje ajeno: 403 por RBAC | IMPLEMENTED | internal/middleware/character_middleware.go:24-31 |
| US-69 | Sin mutación en BD | IMPLEMENTED | internal/middleware/character_middleware.go:30 (Abort antes del handler) |
| US-70 | El rechazo se registra para auditoría | IMPLEMENTED | internal/middleware/audit_logger.go:176-179 |
| US-71 | Oferta de 500 po con 300: rechazada | IMPLEMENTED | internal/repository/trade_repository.go:130-132 |
| US-72 | Error "Insufficient gold: attempted 500, available 300" | IMPLEMENTED | internal/repository/trade_repository.go:40 |
| US-73 | Sin mutación de inventario ni oro | IMPLEMENTED | internal/repository/trade_repository.go:79 |
| US-74 | Si el objeto desaparece, la oferta se invalida automáticamente | IMPLEMENTED | Deleting a requested item invalidates its pending offers and releases the offeror's locked items. internal/repository/item_repo.go:81 (DB test) An accept that finds an item gone already invalidated the offer; it now also publishes TRADE_INVALIDATED. internal/handler/trade_handler.go:51; internal/realtime/middleware.go:82 (forced-event test) Selling or equipping a requested item is still only caught at accept. — *corregido 2026-11-22* |
| US-75 | El receptor recibe "Trade invalidated: item no longer available" | IMPLEMENTED | internal/repository/trade_repository.go:24; internal/handler/trade_handler.go:47-48 |
| US-76 | Se invita a A a actualizar la oferta | IMPLEMENTED | "Invalidada" status; the offeror gets "Rehacer oferta", which refills the form. frontend/src/pages/Trade.tsx:22,125 — *corregido 2026-11-22* |
| US-77 | Más de 5 intercambios/min por jugador: 429 | IMPLEMENTED | internal/handler/trade_handler.go:23-37,64,140 |
| US-78 | Mensaje "Trade rate limit exceeded. Wait before retrying." | IMPLEMENTED | internal/handler/trade_handler.go:35 |
| US-79 | Mensaje a jugador offline persistido en su historial | IMPLEMENTED | internal/repository/message_repo.go:23-31 |
| US-80 | Encolado para entrega en su próxima conexión | IMPLEMENTED | Persistencia + carga REST al conectar y replay de game_events (internal/realtime/hub.go:202; frontend/src/pages/Messages.tsx:20) |
| US-81 | El GM recibe "Message queued for delivery" | IMPLEMENTED | Hub.IsOnline and OnlineUsers (internal/realtime/hub.go:276,288). POST messages returns delivery "delivered" or "queued" (internal/handler/message_handler.go:47). Messages.tsx shows "Mensaje en cola: X lo recibirá cuando se conecte." — *corregido 2026-11-22* |

## characters.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| CHR-01 | Mutación en tiempo real del estado del personaje (PV, inventario, características) | IMPLEMENTED | cmd/server/main.go:175-187; internal/service/character_service.go:176 |
| CHR-02 | Lanzar un conjuro descuenta de inmediato el espacio y persiste | IMPLEMENTED | internal/repository/character_repo.go:150-179 |
| CHR-03 | Toda mutación de personaje se difunde por Redis Pub/Sub al canal de la campaña | IMPLEMENTED | internal/realtime/middleware.go:11-55; internal/realtime/hub.go:353-369 |
| CHR-04 | Esc.: Proyectil mágico descuenta 1 espacio, persiste en PostgreSQL y se difunde | IMPLEMENTED | internal/repository/character_repo.go:165-179; internal/realtime/middleware.go:84-85 (SPELL_CAST) |
| CHR-05 | Esc.: curación acotada a PV máximos, exceso descartado | IMPLEMENTED | internal/service/character_service.go:290-295; frontend/src/components/character/HpPanel.tsx:21 |
| CHR-06 | Esc.: sin espacios → error en UI, sin mutación, sin difusión | IMPLEMENTED | internal/handler/character_handler.go:194-195 (409); frontend/src/pages/SpellsTab.tsx:45; internal/realtime/middleware.go:14 (solo 2xx) |
| CHR-07 | Consultas de lore delegadas a un pool de workers Go asíncrono sin bloquear el WS | IMPLEMENTED | internal/service/rag_worker.go:40-73; internal/handler/lore_handler.go:168 |
| CHR-08 | Pool con número máximo de workers configurable | IMPLEMENTED | internal/config/config.go:62-65; config.yaml:30 |
| CHR-09 | RAG: la pregunta se convierte en embedding | IMPLEMENTED | internal/service/rag_service.go:169 |
| CHR-10 | RAG: búsqueda por similitud en pgvector | IMPLEMENTED | internal/repository/message_repo.go:250-256 |
| CHR-11 | RAG: top-K adjuntado al prompt | IMPLEMENTED | internal/service/rag_service.go:170,188-208 (K=5) |
| CHR-12 | RAG: prompt enriquecido enviado a Ollama | IMPLEMENTED | internal/service/rag_service.go:210 |
| CHR-13 | RAG: respuesta entregada de forma asíncrona por el canal del socket | PARTIAL | internal/handler/lore_handler.go:165-180 (respuesta HTTP, no evento WS) |
| CHR-14 | Timeout: a los 10 s sin respuesta el worker aborta la goroutine | PARTIAL | internal/handler/lore_handler.go:165 (plazo 30 s); internal/service/rag_service.go:111 (generación 3×10 s) |
| CHR-15 | Timeout: payload de error descriptivo al usuario | IMPLEMENTED | internal/handler/lore_handler.go:178-179 (RAG_TIMEOUT) |
| CHR-16 | Timeout: las demás conexiones WS no se ven afectadas | IMPLEMENTED | internal/service/rag_worker.go:48-71 (pool aparte del hub) |
| CHR-17 | Raza y clase del catálogo (srd_races/srd_classes, todas las fuentes) mostrando rasgos y competencias | IMPLEMENTED | frontend/src/pages/CreateCharacter.tsx:41-42,177-182 |
| CHR-18 | Creación como asistente raza→apariencia→clase→características→detalles con avatar siempre visible | IMPLEMENTED | frontend/src/pages/CreateCharacter.tsx:24,134-140 |
| CHR-19 | El selector de raza agrupa por raza base | IMPLEMENTED | frontend/src/lib/avatar/raceGroups.ts:8-22 |
| CHR-20 | characters.race acepta nombres largos (TEXT) | IMPLEMENTED | migrations/020_character_appearance.sql:5 |
| CHR-21 | Métodos: matriz estándar, compra de 27 puntos (8–15), tiradas, manual (3–20) | IMPLEMENTED | frontend/src/components/character/AbilityScores.tsx:10,82-91 |
| CHR-22 | Mejoras +2/+1 o +1/+1/+1, prerrellenadas desde la raza, nunca por encima de 20 | IMPLEMENTED | frontend/src/components/character/AbilityScores.tsx:177; frontend/src/pages/CreateCharacter.tsx:43; internal/service/stat_roll_rules.go:54-64 |
| CHR-23 | Tiradas hechas por el servidor (6× 4d6, mejores 3) y guardadas por jugador y campaña (stat_rolls) | IMPLEMENTED | internal/service/stat_roll_rules.go:17-37; internal/handler/stat_roll_handler.go:54-63 |
| CHR-24 | Pedir de nuevo devuelve la misma tirada mientras no se use | IMPLEMENTED | migrations/019_stat_rolls.sql:15; internal/repository/stat_roll_repo.go:58-67 |
| CHR-25 | Crear con tirada verifica base = totales (cada uno una vez) y mejoras; la marca como usada | IMPLEMENTED | internal/service/character_service.go:60-78,94-96 |
| CHR-26 | El DM ve todas las tiradas y puede descartar una sin usar | IMPLEMENTED | internal/handler/stat_roll_handler.go:34-42,66-80; frontend/src/components/character/StatRollsPanel.tsx:13-16 |
| CHR-27 | Nuevo personaje nivel 1; rechaza características fuera de 3–20 (10 si se omite) | IMPLEMENTED | internal/service/character_rules.go:66-77 |
| CHR-28 | PV máx = dado de golpe máx + mod CON (mín 1); PV actuales = máx | IMPLEMENTED | internal/service/character_rules.go:78-79 |
| CHR-29 | CA = 10 + mod DES | IMPLEMENTED | internal/service/character_rules.go:80 |
| CHR-30 | Velocidad de la raza del catálogo; si no, 25 (enano/mediano/gnomo) o 30 | IMPLEMENTED | internal/service/character_service.go:87-89; internal/service/character_rules.go:52-60 |
| CHR-31 | Bono de competencia +2; aptitud mágica por clase (INT/SAB/CAR; ninguna para marciales) | IMPLEMENTED | internal/service/character_rules.go:85-86 (clases marciales sin característica de lanzamiento); test internal/service/character_rules_test.go:29 — *corregido 2026-11-22* |
| CHR-32 | Espacios de nivel 1: 2 lanzadores completos, 1 brujo, 0 medios y marciales | IMPLEMENTED | internal/service/character_rules.go:18-31; internal/service/character_service.go:104-123 |
| CHR-33 | Clases y razas en inglés y español; clase desconocida → d8 | IMPLEMENTED | internal/service/character_rules.go:36-42,54 |
| CHR-34 | Esc.: Mago CON 14 DES 16 → PV 8, CA 13, 2 espacios, INT | IMPLEMENTED | internal/service/character_rules_test.go:9; internal/service/character_rules_test.go:52 |
| CHR-35 | Esc.: recarga ve las mismas tiradas; 15+2 → CON 17; un 16 no tirado se rechaza | IMPLEMENTED | internal/service/stat_roll_rules_test.go:23; internal/service/character_service.go:72-77 |
| CHR-36 | Decisión: PV actuales acotados a [0, PV máx]; temporales no negativos | IMPLEMENTED | internal/service/character_service.go:269-271 (PV actuales acotados a [0, máx], temporales >= 0); test internal/service/catalog_value_test.go:37 — *corregido 2026-11-22* |
| CHR-37 | Decisión: raza guardada con libro; Percepción pasiva suma competencia si la raza la otorga; sin libro → XPHB y luego PHB | IMPLEMENTED | internal/repository/character_repo.go:204-221; internal/service/character_service.go:84-86; frontend/src/pages/CreateCharacter.tsx:84 |
| CHR-38 | Decisión: espacios de conjuro serializados en snake_case (level, total, used) | IMPLEMENTED | internal/domain/character.go:134-139 |

## character-appearance.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| APP-01 | Todo PJ tiene avatar pixel-art dibujado por código desde máscaras por capas, sin imágenes | IMPLEMENTED | frontend/src/lib/avatar/render.ts:53; frontend/src/lib/avatar/sprites/outfits.ts:56 |
| APP-02 | characters.appearance JSONB nullable con la forma {v, body, skin, eyes, hair, hairColor, outfit, outfitColors, feature} | IMPLEMENTED | migrations/020_character_appearance.sql:3; internal/domain/appearance.go:50-60 |
| APP-03 | body 0 o 1 (siluetas A y B) | IMPLEMENTED | internal/service/appearance_rules.go:41 |
| APP-04 | hair 0–8 (0 calvo, 1–4 A, 5–8 B); cualquier cuerpo usa cualquier peinado | IMPLEMENTED | internal/service/appearance_rules.go:18,42; frontend/src/lib/avatar/types.ts:102 |
| APP-05 | outfit 0–7 (4 A + 4 B distintos), colores primario y secundario; cualquier cuerpo cualquier atuendo | IMPLEMENTED | internal/service/appearance_rules.go:19,43; frontend/src/lib/avatar/sprites/outfits.ts:56-60 |
| APP-06 | feature 0–3, opción racial con significado según la raza | IMPLEMENTED | internal/service/appearance_rules.go:20,44 |
| APP-07 | Colores en formato #rrggbb | IMPLEMENTED | internal/service/appearance_rules.go:23,47-51 |
| APP-08 | El servidor rechaza claves desconocidas, v≠1, índices fuera de rango, colores mal formados o >1 KB | IMPLEMENTED | internal/service/appearance_rules.go:32-51 |
| APP-09 | Familia visual no guardada: se deriva de race en cada dibujo | IMPLEMENTED | frontend/src/components/avatar/PixelAvatar.tsx:27 |
| APP-10 | feature que no encaja con la raza se acota al dibujar; la piel válida se respeta aunque esté fuera de la paleta (D-0034) | IMPLEMENTED | frontend/src/components/avatar/PixelAvatar.tsx:28, frontend/src/components/vtt/TableCanvas.tsx:81, frontend/src/pages/EditAppearance.tsx:30 sin strictSkin; reseteo al cambiar de raza en creator/look.ts; tests CustomSkin.test.tsx (T-11) |
| APP-11 | Personaje sin apariencia se dibuja con el aspecto por defecto de su raza | IMPLEMENTED | frontend/src/lib/avatar/types.ts:90-91 |
| APP-12 | Razas agrupadas por raza base; una entrada por raza base y luego se elige libro/variante | IMPLEMENTED | frontend/src/lib/avatar/raceGroups.ts:8-28; frontend/src/components/character/creator/RaceStep.tsx:32-35 |
| APP-13 | Cada raza base: tamaño, tipo de cabeza, paleta de piel y 2–4 opciones con nombre | IMPLEMENTED | frontend/src/lib/avatar/races.ts:14-26,214-227 |
| APP-14 | Coincidencia EN/ES; razas desconocidas → humanoide del tamaño del catálogo | IMPLEMENTED | frontend/src/lib/avatar/races.ts:229-245 |
| APP-15 | La clase no cambia la ropa; color por clase; aura de 1–2 px; clase desconocida → color derivado del nombre | IMPLEMENTED | frontend/src/lib/avatar/classColors.ts:23-28; frontend/src/lib/avatar/render.ts:84-99 |
| APP-16 | Avatar en creación, retrato de ficha, plantilla de grupo y hub (busto) y fichas VTT (busto en círculo, anillo del color de clase, sin suavizado) | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:46; frontend/src/pages/PartyRoster.tsx:81; frontend/src/pages/CampaignHub.tsx:37; frontend/src/components/vtt/TableCanvas.tsx:206,215; frontend/src/lib/avatar/render.ts:133 |
| APP-17 | PUT /api/characters/:id/appearance por dueño o DM; resto 403 | IMPLEMENTED | cmd/server/main.go:177; internal/service/character_service.go:141-153; internal/middleware/character_middleware.go:24-31 |
| APP-18 | Paso 1 Raza: rejilla de razas base con miniaturas y búsqueda; luego entrada y rasgos | IMPLEMENTED | frontend/src/components/character/creator/RaceStep.tsx:30,43-55 |
| APP-19 | Paso 2 Apariencia: cuerpo, piel, ojos, peinado y color, atuendo y dos colores, opción racial, botón aleatorio | IMPLEMENTED | frontend/src/components/character/creator/AppearanceEditor.tsx:22-40 |
| APP-20 | Paso 3 Clase: rejilla con el color de cada clase; elegir fija el aura | IMPLEMENTED | frontend/src/components/character/creator/ClassStep.tsx:29; frontend/src/pages/CreateCharacter.tsx:135 |
| APP-21 | Paso 4 Características; paso 5 Detalles: nombre, trasfondo, alineamiento, resumen, crear | IMPLEMENTED | frontend/src/pages/CreateCharacter.tsx:146-171 |
| APP-22 | Esc.: Tiflin, atuendo 6 en cuerpo A y peinado 2; la opción racial ofrece cuernos | IMPLEMENTED | frontend/src/lib/avatar/races.ts:75-77 |
| APP-23 | Esc.: "hair": 12 → 400 y se conserva la apariencia; otro jugador no DM → 403 | IMPLEMENTED | internal/handler/character_handler.go:100-105; internal/service/appearance_rules_test.go:11; internal/middleware/character_middleware.go:24-31 |
| APP-24 | Esc.: personaje anterior (appearance null) se dibuja con el aspecto por defecto | IMPLEMENTED | frontend/src/lib/avatar/types.ts:91; frontend/src/lib/avatar/types.ts:127-131 |

## srd-data.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| SRD-01 | (Estado) Fuente de verdad = `content_entities` importado por `cmd/content-import` (todos los libros, `source` = código 5etools) | IMPLEMENTED | cmd/content-import/main.go:51; migrations/012_content_catalog.sql:12 |
| SRD-02 | (Estado) La importación proyecta monstruos, conjuros, objetos, clases (con tabla de espacios), razas, subclases, condiciones y reglas en `srd_*` | IMPLEMENTED | internal/content/postgres.go:120-194; internal/content/progression.go:121-126 |
| SRD-03 | (Estado) `is_srd` solo informativo: ninguna función MUST filtrar/limitar contenido por él | IMPLEMENTED | internal/repository/srd_repo.go:119 (filtro opcional, nunca forzado) |
| SRD-04 | (Estado) Criaturas homebrew = filas con `created_by` (source `Homebrew`), editables solo por creador o admin | IMPLEMENTED | internal/repository/srd_repo.go:663-714; internal/handler/srd_handler.go:368,382 |
| SRD-05 | (Estado) Filas importadas (`created_by` NULL) son de solo lectura | IMPLEMENTED | internal/repository/srd_repo.go:689,706 (`created_by IS NOT NULL`) |
| SRD-06 | Atribución 5e-bits / CC-BY-4.0 del SRD 5.1 | SUPERSEDED | Nota de estado: solo aplica si se distribuye solo el SRD |
| SRD-07 | Cobertura: tablas `srd_monsters`, `srd_spells`, `srd_equipment`, `srd_magic_items`, `srd_classes`, `srd_races`, `srd_conditions`, `srd_rules` | IMPLEMENTED | migrations/008_srd_reference_data.sql:9,74,125,177,214,268,285,297 |
| SRD-08 | Conteos de la tabla de cobertura (334 monstruos, 319 conjuros…) | SUPERSEDED | Nota de estado (catálogo completo ~4.5k monstruos) |
| SRD-09 | Las tablas SRD MUST ser de solo lectura para el código de la aplicación | IMPLEMENTED | Únicos escritores: import (internal/content/postgres.go:120), sync Foundry (internal/repository/srd_export_repo.go:94) y homebrew propio (srd_repo.go:663) |
| SRD-10 | Solo el script de importación SHALL escribir en tablas SRD (excepción homebrew según nota) | IMPLEMENTED | internal/content/postgres.go:120-194; internal/repository/foundry_repo.go:181 (sync = importación) |
| SRD-11 | Todas las filas SRD MUST tener `is_srd = TRUE` | SUPERSEDED | Nota de estado: `is_srd` marca pertenencia al SRD; postgres.go:129 usa entity.IsSRD |
| SRD-12 | El GM MAY crear entradas homebrew en las mismas tablas con `is_srd = FALSE` | IMPLEMENTED | internal/repository/srd_repo.go:663-667; internal/service/srd_homebrew.go:179 |
| SRD-13 | Entidades de campaña MAY referenciar el SRD vía `srd_ref_id` | IMPLEMENTED | migrations/008_srd_reference_data.sql:329-331; migrations/017_market.sql:39-40 |
| SRD-14 | Borrar una referencia SRD MUST NOT propagar a entidades de campaña | IMPLEMENTED | migrations/008_srd_reference_data.sql:329-331 (ON DELETE SET NULL); migrations/024_combatant_ac.sql:4 |
| SRD-15 | Con referencia SRD, la UI SHOULD mostrar los datos oficiales junto a las modificaciones de campaña | IMPLEMENTED | official catalog data shown next to the copy: frontend/src/components/character/OfficialData.tsx:8,20; SpellsTab.tsx:64 (OfficialSpell when srd_ref_id); InventoryTab.tsx:61 ("Datos oficiales" details → OfficialItem) — *corregido 2026-11-22* |
| SRD-16 | `name` de monstruo MUST ser único entre entradas SRD | SUPERSEDED | migrations/012_content_catalog.sql:58,64 (identidad `(name, source)`) |
| SRD-17 | `size` MUST ser Tiny…Gargantuan | IMPLEMENTED | internal/content/postgres.go:437-453; internal/service/srd_homebrew.go:24,115 |
| SRD-18 | `type` MUST seguir las categorías SRD | IMPLEMENTED | internal/service/srd_homebrew.go:25-27,119 (homebrew); postgres.go:405 (catálogo según fuente) |
| SRD-19 | `cr` MUST ser un VD válido (0, 1/8, 1/4, 1/2, 1–30) | IMPLEMENTED | internal/service/srd_homebrew.go:123-127; srd_repo.go:34-35 (VD no numéricos del catálogo → NULL) |
| SRD-20 | `xp` SHALL coincidir con la tabla VD→PX | IMPLEMENTED | internal/content/postgres.go:368-388; internal/service/srd_service.go:23-33 |
| SRD-21 | Las seis características MUST ser enteros ≥ 1 | IMPLEMENTED | internal/service/srd_homebrew.go:134-138; migrations/022_srd_constraints.sql:9-11 |
| SRD-22 | `proficiency_bonus` SHALL derivarse del VD | IMPLEMENTED | CR 21+/25+/29+ give +7/+8/+9: internal/content/postgres.go:351; test internal/content/equipment_test.go (TestProficiencyByCR). Needs re-import — *corregido 2026-11-22* |
| SRD-23 | `speed`, `traits`, `actions`, `legendary_actions`, `reactions`, `saving_throws`, `skills` SHALL guardarse como JSON | IMPLEMENTED | migrations/008_srd_reference_data.sql:20,31-34,39-40 (JSONB) |
| SRD-24 | La capa de aplicación MUST parsear esos campos devolviendo `null` si fallan | IMPLEMENTED | internal/service/srd_detail.go:11-21,37-48 |
| SRD-25 | Escenario búsqueda "dragon": FTS sobre srd_monsters | IMPLEMENTED | internal/repository/srd_repo.go:85-92 |
| SRD-26 | …resultados incluyen coincidencias por nombre o tipo | IMPLEMENTED | migrations/008_srd_reference_data.sql:60 (vector = name+type+subtype) |
| SRD-27 | …ordenados por relevancia descendente | IMPLEMENTED | internal/repository/srd_repo.go:96 (nombre exacto/prefijo primero, luego `rank DESC`) |
| SRD-28 | …cada resultado incluye name, size, type, cr, xp, hp, ac | IMPLEMENTED | internal/domain/srd_monster.go:71-84; srd_repo.go:147 |
| SRD-29 | Escenario cr_min=5/cr_max=10: solo VD numérico entre 5.0 y 10.0 inclusive | IMPLEMENTED | internal/repository/srd_repo.go:103-110; internal/handler/srd_handler.go:79-86 |
| SRD-30 | …VD fraccionarios convertidos a su valor numérico | IMPLEMENTED | internal/repository/srd_repo.go:34-35 |
| SRD-31 | Escenario detalle: respuesta con stats, características, acciones, rasgos, acciones legendarias | IMPLEMENTED | internal/repository/srd_repo.go:175-188 |
| SRD-32 | …campos JSON devueltos como objetos estructurados | IMPLEMENTED | internal/service/srd_service.go:67-73; srd_detail.go:25-48 |
| SRD-33 | `name` de conjuro MUST ser único entre conjuros SRD | SUPERSEDED | migrations/012_content_catalog.sql:59,65 (identidad `(name, source)`) |
| SRD-34 | `level` MUST estar entre 0 y 9 | IMPLEMENTED | migrations/008_srd_reference_data.sql:77 |
| SRD-35 | `school` MUST ser una de las 8 escuelas | IMPLEMENTED | internal/content/postgres.go:456-463 (añade "Psionic" de libros UA) |
| SRD-36 | `concentration` y `ritual` SHALL ser booleanos | IMPLEMENTED | migrations/008_srd_reference_data.sql:82-83 |
| SRD-37 | `components_v/s/m` SHALL ser booleanos | IMPLEMENTED | migrations/008_srd_reference_data.sql:84-86 |
| SRD-38 | `material_desc` SHALL describir el componente material | IMPLEMENTED | internal/content/postgres.go:129 (`flatText(components["m"])`) |
| SRD-39 | `classes` SHALL ser array JSON de clases | IMPLEMENTED | migrations/008_srd_reference_data.sql:90; postgres.go:129 (`classNames`) |
| SRD-40 | Escenario nivel=3 y clase=Wizard: solo conjuros de nivel 3 de Mago | IMPLEMENTED | internal/repository/srd_repo.go:240-253,513-516 |
| SRD-41 | …resultados incluyen name, school, casting_time, range, concentration | IMPLEMENTED | `range` in spell list items: internal/domain/srd_spell.go:50; internal/repository/srd_repo.go:289; frontend/src/types/srd.ts (SpellListItem.range) — *corregido 2026-11-22* |
| SRD-42 | Escenario añadir conjuro: copiar name, level, school, casting_time, range, duration, description | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:26-31 |
| SRD-43 | …el conjuro del personaje SHALL guardar `srd_ref_id` | IMPLEMENTED | AddSpell accepts content_entity_id and resolves srd_ref_id: internal/domain/spell.go (ContentEntityID); internal/service/character_service.go:501; internal/repository/srd_repo.go (SpellRefByContent/refByContent); SpellsTab.tsx:34 sends content_entity_id — *corregido 2026-11-22* |
| SRD-44 | …actualizaciones futuras SHALL NOT modificar la copia | IMPLEMENTED | internal/repository/item_repo.go:145-150 (copia de campos) |
| SRD-45 | Equipo SHALL categorizarse como Weapon/Armor/Shield/Adventuring Gear/Tool/Mount/Vehicle | IMPLEMENTED | 5etools type codes mapped to Weapon/Armor/Shield/Adventuring Gear/Tool/Mount/Vehicle: internal/content/equipment.go:27; used at internal/content/postgres.go:182; tests internal/content/equipment_test.go. Needs re-import — *corregido 2026-11-22* |
| SRD-46 | Armas SHALL incluir damage_dice, damage_type, weapon_category, weapon_range (Melee/Ranged), properties | IMPLEMENTED | weapon_range Melee/Ranged + range_normal/range_long parsed: internal/content/equipment.go:31,67; postgres.go:182-185 — *corregido 2026-11-22* |
| SRD-47 | Armaduras SHALL incluir ac_base, ac_dex_bonus, ac_max_bonus, str_minimum, stealth_disadvantage, armor_category | IMPLEMENTED | armor_category Light/Medium/Heavy/Shield, ac_dex_bonus, ac_max_bonus (2 for medium), str_minimum from `strength`: internal/content/equipment.go:33-61. Also fixes shields counted as armor in srd_loadout.go isShield and ShopManager item_type regex (category now "Weapon"/"Armor"/"Shield") — *corregido 2026-11-22* |
| SRD-48 | Escenario mercado: objetos clonados con precio correcto | IMPLEMENTED | frontend/src/components/market/ShopManager.tsx:277-289; internal/repository/market_repo.go:113 (`shop_items` sustituye a `marketplace_items`, market-bastions.md) |
| SRD-49 | …el objeto de mercado SHALL conservar `srd_ref_id` | IMPLEMENTED | frontend/src/components/market/ShopManager.tsx:282,288; migrations/017_market.sql:39-40 |
| SRD-50 | Tabla VD→PX/bono de competencia MUST implementarse como constante | IMPLEMENTED | internal/service/srd_service.go:23-33; internal/service/srd_homebrew.go:31-50 |
| SRD-51 | Toda tabla SRD con `name` MUST soportar FTS vía `tsvector` | PARTIAL | migrations/008_srd_reference_data.sql:43,94,149,186,304 (sin vector: srd_classes, srd_races, srd_conditions) |
| SRD-52 | Consultas SHALL sanearse: quitar caracteres especiales, tokens entre comillas | IMPLEMENTED | internal/repository/srd_repo.go:37-58 |
| SRD-53 | Índices FTS MUST usar configuración `english` | IMPLEMENTED | migrations/008_srd_reference_data.sql:60,111,163,200,315 |
| SRD-54 | Resultados SHALL incluir rank y ordenarse por él descendente | IMPLEMENTED | rank returned and ordered `rank DESC, name` when there is a query for equipment/magic items/rules: internal/repository/srd_repo.go:382,472,673; Rank fields in internal/domain/srd_equipment.go, srd_rules.go — *corregido 2026-11-22* |

## srd-integration.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| SRDI-01 | (Estado) La capa de referencia es el catálogo ampliado (`content_entities` + proyección `srd_*`), `is_srd` informativo | IMPLEMENTED | internal/content/postgres.go:120-194; migrations/012_content_catalog.sql:12,43-54 |
| SRDI-02 | Arquitectura: entidades de campaña enlazan con `srd_ref_id` opcional (spells, inventory_items, marketplace_items) | IMPLEMENTED | migrations/008_srd_reference_data.sql:329-331; migrations/017_market.sql:39 |
| SRDI-03 | Crear personaje: SHOULD validar que la clase exista en srd_classes | IMPLEMENTED | class/race checked against the catalog (versioned race names "Elf (XPHB)" accepted), non-blocking `warnings` in the create response: internal/service/character_service.go:54 (catalogWarnings), domain/character.go (Character.Warnings db:"-"); UI notice with "Ir a la ficha": frontend/src/pages/CreateCharacter.tsx:96,134; tests internal/service/character_catalog_test.go (TestCatalogWarnings) — *corregido 2026-11-22* |
| SRDI-04 | …SHOULD validar que la raza exista en srd_races | IMPLEMENTED | class/race checked against the catalog (versioned race names "Elf (XPHB)" accepted), non-blocking `warnings` in the create response: internal/service/character_service.go:54 (catalogWarnings), domain/character.go (Character.Warnings db:"-"); UI notice with "Ir a la ficha": frontend/src/pages/CreateCharacter.tsx:96,134; tests internal/service/character_catalog_test.go (TestCatalogWarnings) — *corregido 2026-11-22* |
| SRDI-05 | …si no coincide SHALL devolver aviso (no error) | IMPLEMENTED | class/race checked against the catalog (versioned race names "Elf (XPHB)" accepted), non-blocking `warnings` in the create response: internal/service/character_service.go:54 (catalogWarnings), domain/character.go (Character.Warnings db:"-"); UI notice with "Ir a la ficha": frontend/src/pages/CreateCharacter.tsx:96,134; tests internal/service/character_catalog_test.go (TestCatalogWarnings) — *corregido 2026-11-22* |
| SRDI-06 | …el personaje SHALL crearse igualmente (homebrew) | IMPLEMENTED | internal/service/character_service.go:91; character_rules.go:36-42 (clase desconocida → d8) |
| SRDI-07 | Ficha: SHOULD buscar la clase en srd_classes | IMPLEMENTED | "Clase según el compendio" block (hit die, saves, armour/weapon/tool proficiencies) and class features up to the character's level. frontend/src/pages/FeaturesTab.tsx:72,110 — *corregido 2026-11-22* |
| SRDI-08 | …mostrar dado de golpe, salvaciones y rasgos de nivel 5 de la clase | IMPLEMENTED | "Clase según el compendio" block (hit die, saves, armour/weapon/tool proficiencies) and class features up to the character's level. frontend/src/pages/FeaturesTab.tsx:72,110 — *corregido 2026-11-22* |
| SRDI-09 | …bono de competencia SHOULD seguir la tabla por nivel (nivel 5 → +3) | IMPLEMENTED | proficiency bonus recalculated on level change (2+(level-1)/4): internal/service/character_service.go:336 (ProficiencyBonusForLevel); tests TestProficiencyBonusForLevel, TestApplyCharacterUpdatesLevelAndCoins — *corregido 2026-11-22* |
| SRDI-10 | Añadir conjuro: la UI SHALL consultar el catálogo de conjuros con el término | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:24 (`/content?type=spell`, el catálogo sustituye a `/api/srd/spells` según la nota de estado) |
| SRDI-11 | …mostrar coincidencias con autocompletado | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:51 |
| SRDI-12 | …copiar name, level, school, casting_time, range, duration, description, components, damage_type | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:29-30 |
| SRDI-13 | …guardar el conjuro con `srd_ref_id = srd_spell.id` | IMPLEMENTED | AddSpell accepts content_entity_id and resolves srd_ref_id: internal/domain/spell.go (ContentEntityID); internal/service/character_service.go:501; internal/repository/srd_repo.go (SpellRefByContent/refByContent); SpellsTab.tsx:34 sends content_entity_id — *corregido 2026-11-22* |
| SRDI-14 | Espacios de conjuro SHOULD precargarse según la progresión de la clase del catálogo | IMPLEMENTED | slots initialised from srd_class_spell_slots (projected by the import, internal/content/progression.go:121) at the character level, fallback to the fixed level-1 table; re-synced on level/class change keeping used ≤ total: internal/service/character_service.go:101,(initializeSpellSlots); internal/repository/character_repo.go (SetSpellSlotTotal); test TestSpellSlotTotalsFromCatalog — *corregido 2026-11-22* |
| SRDI-15 | …el jugador MAY modificar los totales | IMPLEMENTED | `PUT /api/characters/:id/spell-slots/:level {total}` (owner/GM via character middleware): cmd/server/main.go:187; internal/handler/character_handler.go:191; service character_service.go:231; UI "Editar totales" in SpellsTab.tsx:61 — *corregido 2026-11-22* |
| SRDI-16 | Conjuro propio: `srd_ref_id` SHALL ser NULL | IMPLEMENTED | internal/service/character_service.go:359 (NULL si no se envía) |
| SRDI-17 | …SHALL funcionar igual que los del catálogo en la UI | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:49 (misma tarjeta para todos) |
| SRDI-18 | …SHOULD distinguirse visualmente (sin insignia SRD); el GM crea conjuros propios | IMPLEMENTED | "Conjuro propio" form (POST without srd_ref_id) and Catálogo/Propio badge: frontend/src/pages/SpellsTab.tsx:56,64,66 — *corregido 2026-11-22* |
| SRDI-19 | Dar objeto del catálogo: copiar name, item_type, weight, description | IMPLEMENTED | readable description (entries flattened via entriesText): frontend/src/lib/catalogItem.ts (catalogItemDescription); InventoryTab.tsx:44 and card shows the description — *corregido 2026-11-22* |
| SRDI-20 | …mapear la rareza a `inventory_items.rarity` | IMPLEMENTED | rarity normalised ("very rare"→very_rare, artifact→legendary, none/unknown→common) and item_type mapped from type codes: frontend/src/lib/catalogItem.ts (catalogRarity, catalogItemType) — *corregido 2026-11-22* |
| SRDI-21 | …guardar `srd_ref_id` a srd_equipment o srd_magic_items | PARTIAL | frontend/src/pages/InventoryTab.tsx:41; migrations/008_srd_reference_data.sql:330 (FK solo a srd_equipment) — *avance 2026-11-22: srd_ref_id resuelto en el servidor para equipo (content_id contra srd_equipment); apuntar srd_ref_id a objetos mágicos requiere una decisión de esquema* |
| SRDI-22 | …propiedades de arma SHALL guardarse en la descripción | IMPLEMENTED | weapon damage, range and properties written into the description: frontend/src/lib/catalogItem.ts (catalogItemDescription) — *corregido 2026-11-22* |
| SRDI-23 | …CA de armadura SHALL guardarse/mostrarse | IMPLEMENTED | armor/shield AC (with DEX cap, STR, stealth) written into the description and shown on the card: frontend/src/lib/catalogItem.ts; InventoryTab.tsx:61 — *corregido 2026-11-22* |
| SRDI-24 | Mercado "Poblar desde catálogo": SHALL presentar el catálogo de equipo | IMPLEMENTED | frontend/src/components/market/ShopManager.tsx:270-310 |
| SRDI-25 | …el GM SHALL elegir objetos | IMPLEMENTED | frontend/src/components/market/ShopManager.tsx:211,303 |
| SRDI-26 | …insertar name, item_type, rarity, precio (cost_gp), weight, description | IMPLEMENTED | frontend/src/components/market/ShopManager.tsx:280-288; internal/repository/market_repo.go:113 (`shop_items`) |
| SRDI-27 | …`attunement_required` desde `requires_attunement` | IMPLEMENTED | frontend/src/components/market/ShopManager.tsx:288 |
| SRDI-28 | …el GM MAY ajustar el precio | IMPLEMENTED | internal/handler/market_handler.go:234-263 (edición del objeto tras añadirlo) |
| SRDI-29 | Bestiario: SHALL cargar de `/api/srd/monsters` | IMPLEMENTED | frontend/src/pages/Bestiary.tsx:20; frontend/src/services/srdService.ts (searchMonsters) |
| SRDI-30 | …tarjetas con name, type, CR, size, HP, AC | IMPLEMENTED | size on bestiary cards: frontend/src/pages/Bestiary.tsx:186 — *corregido 2026-11-22* |
| SRDI-31 | …filtros: búsqueda FTS, rango de VD, tipo, tamaño | IMPLEMENTED | CR min/max filter (backend cr_min/cr_max): frontend/src/pages/Bestiary.tsx:134-140 — *corregido 2026-11-22* |
| SRDI-32 | …insignia "SRD" / "Homebrew" | IMPLEMENTED | frontend/src/pages/Bestiary.tsx:166-167 (adaptado: código de libro o "Propia") |
| SRDI-33 | Monstruo propio: guardado en srd_monsters con `is_srd = FALSE` | IMPLEMENTED | internal/repository/srd_repo.go:663-667 |
| SRDI-34 | …aparece en el bestiario junto a los demás | IMPLEMENTED | internal/repository/srd_repo.go:27-29,80 (solo oculta legado sin `created_by`) |
| SRDI-35 | …disponible para el generador de encuentros | IMPLEMENTED | internal/repository/srd_repo.go:191-218 |
| SRDI-36 | Detalle: cabecera name, size, type, subtype, alignment | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:136 |
| SRDI-37 | …combate: CA (tipo), PV (dados), Velocidad | IMPLEMENTED | speed objects {number, condition} rendered, canHover skipped: frontend/src/pages/CreatureDetail.tsx:16 — *corregido 2026-11-22* |
| SRDI-38 | …características con modificadores | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:62-69,166 |
| SRDI-39 | …info: salvaciones, habilidades, resistencias, inmunidades, vulnerabilidades, inmunidades a estados, sentidos, idiomas, VD (PX) | IMPLEMENTED | catalog saves/skills strings ("+5") no longer shown as "++5": CreatureDetail.tsx:26 — *corregido 2026-11-22* |
| SRDI-40 | …rasgos con nombre + descripción | IMPLEMENTED | trait/action/reaction/legendary text from `desc` or 5etools `entries` (tags stripped): CreatureDetail.tsx:13 (actionText); MonsterAction.entries in frontend/src/types/srd.ts — *corregido 2026-11-22* |
| SRDI-41 | …acciones con nombre + descripción (ataque/salvación del texto) | IMPLEMENTED | trait/action/reaction/legendary text from `desc` or 5etools `entries` (tags stripped): CreatureDetail.tsx:13 (actionText); MonsterAction.entries in frontend/src/types/srd.ts — *corregido 2026-11-22* |
| SRDI-42 | …reacciones con nombre + descripción | IMPLEMENTED | trait/action/reaction/legendary text from `desc` or 5etools `entries` (tags stripped): CreatureDetail.tsx:13 (actionText); MonsterAction.entries in frontend/src/types/srd.ts — *corregido 2026-11-22* |
| SRDI-43 | …acciones legendarias: descripción + cada una | IMPLEMENTED | trait/action/reaction/legendary text from `desc` or 5etools `entries` (tags stripped): CreatureDetail.tsx:13 (actionText); MonsterAction.entries in frontend/src/types/srd.ts — *corregido 2026-11-22* |
| SRDI-44 | …diseño tipo bloque de estadísticas del Monster Manual | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:130-280 |
| SRDI-45 | Encuentro aceptado: una entrada por monstruo en el rastreador | IMPLEMENTED | frontend/src/pages/EncounterBuilder.tsx:47-53; internal/handler/combat_handler.go:54-82 |
| SRDI-46 | …iniciativa 1d20 + mod DES del catálogo | IMPLEMENTED | internal/service/encounter_combatants.go:124 |
| SRDI-47 | …PV = hp del monstruo | IMPLEMENTED | internal/service/encounter_combatants.go:110-126 |
| SRDI-48 | …CA = ac del monstruo | IMPLEMENTED | internal/service/encounter_combatants.go:120,127 |
| SRDI-49 | …la entrada SHALL referenciar al monstruo para ver su bloque durante el combate | IMPLEMENTED | combat board links monster combatants (srd_monster_id) to the stat block for the GM: frontend/src/components/content/CombatBoard.tsx:53; CreatureDetail "Añadir a Combate" now uses POST /combat/encounter {monster_id, count:1} so the server resolves HP/AC/initiative: CreatureDetail.tsx:93 — *corregido 2026-11-22* |
| SRDI-50 | …se emite `ENCOUNTER_STARTED` a los participantes | IMPLEMENTED | internal/realtime/middleware.go:89-90; internal/realtime/realtime_test.go:61 |
| SRDI-51 | Reglas: `/api/srd/rules` SHALL hacer FTS sobre `srd_rules.content` | IMPLEMENTED | internal/repository/srd_repo.go:602-607; migrations/008_srd_reference_data.sql:315 |
| SRDI-52 | …devolver secciones con título y contenido completo | IMPLEMENTED | internal/repository/srd_repo.go:634 |
| SRDI-53 | …la canalización RAG MAY usar estas reglas como contexto | MISSING | Sin uso de srd_rules en internal/service (opcional, MAY) |
| SRDI-54 | Endpoints GET monsters, monsters/:id, spells, spells/:id, equipment, equipment/:id, magic-items, magic-items/:id | IMPLEMENTED | internal/handler/srd_handler.go:43-50 |
| SRDI-55 | Endpoints GET classes, classes/:name, races, races/:name, conditions, rules | IMPLEMENTED | internal/handler/srd_handler.go:51-56 |
| SRDI-56 | POST spells/plan y loadout/analyze (JWT) | IMPLEMENTED | internal/handler/srd_handler.go:60,66 |
| SRDI-57 | POST encounter/build con JWT (GM) | PARTIAL | internal/handler/srd_handler.go:57-59 (cualquier usuario autenticado; la ruta del front sí está tras GMGuard) |
| SRDI-58 | Todos los endpoints SRD con JWT | IMPLEMENTED | cmd/server/main.go:150,195 |
| SRDI-59 | Límite global compartido (100 req/min por usuario) | IMPLEMENTED | cmd/server/main.go:121,150; internal/config/config.go:83-84 |
| SRDI-60 | Generador de encuentros y planificador: ráfaga 10 req/min por usuario | IMPLEMENTED | internal/handler/srd_handler.go:25,34-35,59-60 |
| SRDI-61 | Endpoints de lista MUST soportar `?limit&offset` | PARTIAL | internal/repository/srd_repo.go:61-72 (monsters/spells/equipment/magic-items/rules) ; srd_handler.go:202-251 (classes/races/conditions sin paginar) |
| SRDI-62 | Límite por defecto 20, máximo 100 | IMPLEMENTED | internal/repository/srd_repo.go:61-72 |
| SRDI-63 | Respuesta MUST incluir `total` | PARTIAL | internal/domain/srd_rules.go:35-40 (listas paginadas) ; classes/races/conditions devuelven solo `{data}` |
| SRDI-64 | Formato `{data, total, limit, offset}` | IMPLEMENTED | internal/domain/srd_rules.go:35-40 |
| SRDI-65 | (Decisión) `/combat/encounter` acepta `{monster_id, count}`, el servidor resuelve PV/CA/iniciativa e ignora el cliente | IMPLEMENTED | internal/handler/combat_handler.go:54-82; internal/service/encounter_combatants.go:90-133 |
| SRDI-66 | (Decisión) En campañas locales la UI abre `/gm/combat` | IMPLEMENTED | frontend/src/pages/EncounterBuilder.tsx:52-53 |
| SRDI-67 | (Decisión) PX por VD según la DMG; PV "especiales" numéricos se leen | IMPLEMENTED | internal/content/postgres.go:368-388,541-559 |
| SRDI-68 | (Decisión) Filas antiguas sin enlace se ocultan si hay criatura homónima en el catálogo, sin borrarse | IMPLEMENTED | internal/repository/srd_repo.go:22-29,80,195 |

## market-bastions.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| MKT-01 | §2 Los personajes guardan monedas en `gold`, `silver` y `copper` | IMPLEMENTED | gp/sp/cp shown and editable in the inventory; PUT /characters/:id accepts silver/copper (clamped ≥0) and the repo persists them: frontend/src/pages/InventoryTab.tsx:79; internal/domain/character.go (UpdateCharacterRequest.Silver/Copper); internal/service/character_service.go:390; internal/repository/character_repo.go (Update silver=$30, copper=$31) — *corregido 2026-11-22* |
| MKT-02 | §2 Precios y valores guardados en cobre (`*_cp`) | IMPLEMENTED | migrations/017_market.sql:7,35; internal/service/market_rules.go:9-21 |
| MKT-03 | §2 Pago desde el valor total del monedero, cambio en el menor número de monedas; cobros igual | IMPLEMENTED | internal/service/market_rules.go:25-62; internal/service/market_rules_test.go:5 |
| MKT-04 | §3 Campos de tienda (name, description, icon, npc_id, availability, scene_id, object_id, price_pct, buy_rate_pct def. 50, buys_types) | IMPLEMENTED | migrations/017_market.sql:10-25; internal/handler/market_handler.go:114-159 |
| MKT-05 | §3 Tienda disponible si `open`, o `scene` y su escena es la activa | IMPLEMENTED | internal/service/market.go:30-48 |
| MKT-06 | §3 Con `object_id` y escena activa, token a ≤1,5 casillas del objeto; el GM siempre accede | IMPLEMENTED | internal/service/market.go:31-33,49-54; internal/repository/market_repo.go:153-169 |
| MKT-07 | §3 Campos de objeto de tienda (…, `srd_ref`, `stock` -1 = ilimitado) | IMPLEMENTED | migrations/017_market.sql:29-44 |
| MKT-08 | §3 GM añade objetos a mano o desde el compendio (precio del catálogo), edita, borra y repone | IMPLEMENTED | frontend/src/components/market/ShopManager.tsx:211-226,251-255,270-292; internal/handler/market_handler.go:239-300 |
| MKT-09 | §3 `marketplace_items` migrados a una tienda «Mercado general» (`open`) por campaña | IMPLEMENTED | migrations/017_market.sql:84-93 |
| MKT-10 | §3 El objeto del mapa enlazado abre la tienda al interactuar | IMPLEMENTED | internal/service/vtt_play.go:526-529; frontend/src/pages/VirtualTable.tsx:226,259-263 |
| MKT-11 | §3 Sin compra instantánea: carrito en el navegador → pedido con oferta (def. precio de lista), nota y habilidad opcional; disponibilidad y stock al enviar | IMPLEMENTED | frontend/src/components/market/ShopView.tsx:21,31,205-217; internal/service/market.go:184-253; internal/handler/market_handler.go:310-314 |
| MKT-12 | §3 Modal del GM con el pedido pendiente más antiguo, «N en cola», líneas, lista, oferta, nota y tirada secreta | IMPLEMENTED | frontend/src/components/market/OfferDesk.tsx:13-15,64-92,110-113; internal/handler/market_handler.go:471-506 |
| MKT-13 | §3 GM cierra al precio acordado, propone precio (jugador acepta/rechaza) o rechaza | IMPLEMENTED | internal/service/market.go:259-288; OfferDesk.tsx:105-109; ShopView.tsx:270-286 |
| MKT-14 | §3 Cierre atómico (stock, cobro, inventario con `value_cp`); si falla, el pedido sigue abierto y el GM ve el motivo | IMPLEMENTED | internal/repository/market_repo.go:530-582; internal/service/market.go:292-304; OfferDesk.tsx:49,104 |
| MKT-15 | §3 Máx. un pedido activo por personaje; el jugador puede retirarlo | IMPLEMENTED | migrations/017_market.sql:82; internal/repository/market_repo.go:424-426; internal/service/market.go:284-285 |
| MKT-16 | §3 El GM conserva un atajo `buy` para entregar objetos a precio de lista | IMPLEMENTED | the GM buy shortcut takes `character_id`, checks it belongs to the campaign and charges the list price to that character. A "Entregar a" picker and "Entregar" button were added to the shop stock. internal/service/market.go:103; internal/repository/market_repo.go:179; internal/handler/market_handler.go:309; frontend/src/components/market/ShopManager.tsx:239. DB test: internal/service/market_give_db_test.go — *corregido 2026-11-22* |
| MKT-17 | §3 Venta a tienda: objeto con `value_cp`, tienda disponible que compra el tipo; pago floor(value×rate/100); no se venden atados a misión, equipados o bloqueados | IMPLEMENTED | internal/repository/market_repo.go:257-283; internal/service/market.go:121-148 |
| MKT-18 | §3 El objeto vendido se añade al stock de la tienda a valor completo | IMPLEMENTED | internal/repository/market_repo.go:295-314 |
| MKT-19 | §4 `value_cp` al comprar | IMPLEMENTED | internal/repository/market_repo.go:229-232,563-566 |
| MKT-20 | §4 `value_cp` al producirlo un bastión | IMPLEMENTED | internal/service/bastion_rules.go:240-245; internal/repository/bastion_repo.go:550-553 |
| MKT-21 | §4 `value_cp` al crear desde el compendio con coste conocido | IMPLEMENTED | internal/service/character_service.go:39,414-421; internal/repository/item_repo.go:21-29; frontend/src/pages/InventoryTab.tsx:41 (content_id -> value_cp leído del catálogo en el servidor); test internal/service/catalog_value_test.go:10 — *corregido 2026-11-22* |
| MKT-22 | §4 Sin valor no se puede vender hasta que el GM lo tasa | IMPLEMENTED | internal/repository/market_repo.go:267; internal/handler/market_handler.go:46-80; frontend/src/components/bastion/AppraisalPanel.tsx:18 |
| MKT-23 | §5 Tabla `npc_items` (npc_id, name, quantity, value_cp, description, location, source) | IMPLEMENTED | migrations/017_market.sql:47-58 |
| MKT-24 | §5 Pertenencias visibles y editables por el GM en el detalle del PNJ | IMPLEMENTED | "Pertenencias" section in the NPC detail page (carried and at home; value, source, description; add, edit, remove). frontend/src/components/market/NPCBelongings.tsx; frontend/src/pages/NPCDetail.tsx:118 — *corregido 2026-11-22* |
| MKT-25 | §6.1 Personaje nivel ≥5 funda un bastión; el GM siempre | IMPLEMENTED | internal/service/bastion.go:133-151; frontend/src/pages/Bastions.tsx:146-153 |
| MKT-26 | §6.1 El bastión registra instalaciones básicas/especiales, empleados, defensores, almacén, obras y registro de turnos | IMPLEMENTED | migrations/021_bastions.sql:44-115; frontend/src/components/bastion/BastionView.tsx:141 |
| MKT-27 | §6.2 Tipos básicos y tamaños (4/16/36 casillas) | IMPLEMENTED | internal/service/bastion_rules.go:47-58,90-94 |
| MKT-28 | §6.2 Un bastión nuevo empieza con una básica reducida y una amplia | IMPLEMENTED | internal/service/bastion.go:166-171 |
| MKT-29 | §6.2 Costes de añadir/ampliar, oro por adelantado, obra completa tras los días en turnos de 7 | IMPLEMENTED | internal/service/bastion_rules.go:66-88,196-206; internal/service/bastion.go:255-294 |
| MKT-30 | §6.3 Espacios especiales por nivel (5→2, 9→4, 13→5, 17→6), gratis, nivel mínimo y requisito que confirma el GM | IMPLEMENTED | internal/service/bastion_rules.go:33-45; internal/service/bastion.go:244-252; BastionView.tsx:251 |
| MKT-31 | §6.3 Catálogo como datos, sembrado y editable por campaña, con opciones de orden (objeto, oro, defensores, narrativa, coste, turnos) | IMPLEMENTED | migrations/021_bastions.sql:7-20; internal/repository/bastion_repo.go:49-50; internal/service/bastion.go:531-612; frontend/src/components/bastion/CatalogEditor.tsx |
| MKT-32 | §6.3 Catálogo sembrado con las 29 instalaciones 2024 por nivel | IMPLEMENTED | migrations/021_bastions.sql:119-177 |
| MKT-33 | §6.4 Órdenes (Craft…Trade); cada instalación especial recibe como máximo una orden permitida con una opción | IMPLEMENTED | internal/service/bastion.go:319-388; internal/handler/bastion_handler.go:30 |
| MKT-34 | §6.4 Turno del GM: órdenes resuelven (almacén con value_cp, oro, defensores, narrativa), multi-turno, coste al emitir | IMPLEMENTED | internal/service/bastion_rules.go:154-176,237-266; internal/repository/bastion_repo.go:371-436; internal/service/bastion.go:377-384 |
| MKT-35 | §6.4 Si todo en Mantener, tirada d100 en tabla de eventos sembrada y editable (11 eventos) | IMPLEMENTED | internal/service/bastion_rules.go:142-150,178-194; migrations/021_bastions.sql:180-191 |
| MKT-36 | §6.4 Las obras avanzan 7 días | IMPLEMENTED | internal/service/bastion_rules.go:196-206 |
| MKT-37 | §6.4 Entrada de registro por bastión; se notifica a los dueños | IMPLEMENTED | internal/repository/bastion_repo.go:437-440; internal/realtime/middleware.go:93-95 |
| MKT-38 | §6.5 El dueño vende bienes del almacén o los pasa a su inventario | IMPLEMENTED | internal/service/bastion.go:461-521 |
| MKT-39 | §6.5 Comprador aleatorio 85 % anónimo / 15 % PNJ; pago value×bastion_sale_pct/100 | IMPLEMENTED | internal/service/bastion_rules.go:283-299; internal/service/bastion_rules_test.go:273 |
| MKT-40 | §6.5 Comprador PNJ: bienes a sus pertenencias (60 % inventario / 40 % hogar) con fuente; el vendedor ve el nombre solo si es PNJ | IMPLEMENTED | internal/service/bastion.go:479-490; internal/repository/bastion_repo.go:514-518 |
| MKT-41 | §7 GET `/shops` (jugadores: disponibles + `available` + motivo) | IMPLEMENTED | internal/handler/market_handler.go:28,104-112; internal/service/market.go:58-69 |
| MKT-42 | §7 POST/PUT/DELETE `/shops[/:shop_id]` (GM) | IMPLEMENTED | internal/handler/market_handler.go:29-31,127-185 |
| MKT-43 | §7 GET `/shops/:shop_id/items` · POST/PUT/DELETE `/shop-items[/:item_id]` | IMPLEMENTED | internal/handler/market_handler.go:32-35 (alta en POST `/shops/:shop_id/items`) |
| MKT-44 | §7 POST `/shops/:shop_id/buy` (GM) | IMPLEMENTED | internal/handler/market_handler.go:36,311-326 (ver MKT-16) |
| MKT-45 | §7 POST `/shops/:shop_id/sell` (jugador) | IMPLEMENTED | internal/handler/market_handler.go:37,328-340 |
| MKT-46 | §7 POST `/shops/:shop_id/offers` | IMPLEMENTED | internal/handler/market_handler.go:39,454-469 |
| MKT-47 | §7 GET `/offers` (GM cola; jugador los suyos) | IMPLEMENTED | internal/handler/market_handler.go:40,476-507 |
| MKT-48 | §7 POST `/offers/:offer_id/:action` (accept/reject/counter/withdraw) | IMPLEMENTED | internal/handler/market_handler.go:41,509-522 |
| MKT-49 | §7 GET/POST `/npcs/:npc_id/items` · PUT/DELETE `/npc-items/:id` (GM) | IMPLEMENTED | internal/handler/market_handler.go:42-45 |
| MKT-50 | §7 GET `/bastions` · GET `/bastions/:bid` (dueño/GM) | IMPLEMENTED | internal/handler/bastion_handler.go:23,26; internal/service/bastion.go:80-115 |
| MKT-51 | §7 POST `/bastions` · PUT `/bastions/:bid` | IMPLEMENTED | internal/handler/bastion_handler.go:24,27 |
| MKT-52 | §7 POST `/bastions/:bid/facilities` · DELETE `/bastion-facilities/:fid` | IMPLEMENTED | internal/handler/bastion_handler.go:28-29 |
| MKT-53 | §7 PUT `/bastion-facilities/:fid/order` (dueño) | IMPLEMENTED | internal/handler/bastion_handler.go:30; internal/service/bastion.go:326 |
| MKT-54 | §7 POST `/bastions/turn` (GM) | IMPLEMENTED | internal/handler/bastion_handler.go:25,135-136 |
| MKT-55 | §7 POST `/bastions/:bid/sell` · `/take` (dueño) | IMPLEMENTED | internal/handler/bastion_handler.go:31-32; internal/service/bastion.go:467,512 |
| MKT-56 | §7 GET/PUT `/bastion-catalog` (GM) | IMPLEMENTED | internal/handler/bastion_handler.go:33-34,175-188 |
| MKT-57 | Escenario: la tienda abre con su escena | IMPLEMENTED | internal/service/market.go:41-47 |
| MKT-58 | Escenario: mostrador en el mapa («Acércate al mostrador», interactuar abre la tienda) | IMPLEMENTED | internal/service/market.go:49-53; internal/service/vtt_play.go:515-529 |
| MKT-59 | Escenario: regateo de un carrito (nada se cobra hasta cerrar; tirada secreta; un solo pedido) | IMPLEMENTED | internal/service/market.go:184-253,292-304; migrations/017_market.sql:82 |
| MKT-60 | Escenario: venta a tienda al 50 % (7 po 5 pp y la tienda lista a 15 po) | IMPLEMENTED | internal/repository/market_repo.go:280-314 |
| MKT-61 | Escenario: bienes del bastión comprados por un PNJ | IMPLEMENTED | internal/repository/bastion_repo.go:514-518; internal/service/bastion_rules_test.go:246 |
| MKT-62 | Escenario: turno solo-Mantener tira evento | IMPLEMENTED | internal/service/bastion_rules_test.go:138 |
| MKT-63 | Decisión: `BASTION_TURN` y aviso solo para turnos de los últimos 2 min | IMPLEMENTED | internal/realtime/middleware.go:93-95; frontend/src/components/layout/BastionTurnNotice.tsx:15-20 |
| MKT-64 | Decisión: `bastion_sale_pct` editable (0–100) en Tasación | IMPLEMENTED | frontend/src/components/bastion/AppraisalPanel.tsx:67-73; internal/domain/campaign.go:48 |
| MKT-65 | Decisión: rangos d100 y opciones editables por el GM; mecánicas de eventos las resuelve el GM | IMPLEMENTED | frontend/src/components/bastion/CatalogEditor.tsx; internal/service/bastion.go:531-612 |

## encounter-builder.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ENC-01 | El GM genera encuentros equilibrados con presupuesto de PX usando los datos de monstruos (catálogo completo en `srd_monsters`) | IMPLEMENTED | internal/service/srd_encounter.go:356-384; internal/handler/srd_handler.go:59 |
| ENC-02 | Tabla de umbrales de PX por nivel 1–20 | IMPLEMENTED | internal/service/srd_encounter.go:45-66 |
| ENC-03 | PartyBudget = umbral × tamaño del grupo | IMPLEMENTED | internal/service/srd_encounter.go:131-139 |
| ENC-04 | `party_size` entre 1 y 20 | IMPLEMENTED | internal/service/srd_encounter.go:70 |
| ENC-05 | `party_level` entre 1 y 20 | IMPLEMENTED | internal/service/srd_encounter.go:71 |
| ENC-06 | Grupos de nivel mixto usan el nivel medio (SHOULD) | IMPLEMENTED | party size and average level are prefilled from the campaign's characters and can still be edited. frontend/src/pages/EncounterBuilder.tsx:24 — *corregido 2026-11-22* |
| ENC-07 | Multiplicadores por número de monstruos | IMPLEMENTED | internal/service/srd_encounter.go:114-128 |
| ENC-08 | AdjustedXP = suma PX × multiplicador | IMPLEMENTED | internal/service/srd_encounter.go:204-218 |
| ENC-09 | Estrategia 1: un monstruo con PX en [0,6; 1,1]·presupuesto, ordenado por cercanía | IMPLEMENTED | internal/service/srd_encounter.go:194,237-243,341-348 |
| ENC-10 | Estrategia 2: grupos idénticos de 2–6, targetXP = presupuesto/multiplicador, ventana [0,8; 1,2] | IMPLEMENTED | internal/service/srd_encounter.go:252-268 |
| ENC-11 | Estrategia 3: 1 fuerte + N débiles en [0,8; 1,2] | IMPLEMENTED | internal/service/srd_encounter.go:270-310; internal/service/srd_encounter_test.go:145 |
| ENC-12 | Contrato de entrada (party_size, party_level, difficulty, monster_type, environment, max_monster_count) | IMPLEMENTED | internal/service/srd_encounter.go:69-76 |
| ENC-13 | Contrato de salida (party_budget, target_difficulty, suggestions[monsters, total_xp, adjusted_xp, monster_count, actual_difficulty]) | IMPLEMENTED | internal/service/srd_encounter.go:78-111 |
| ENC-14 | `difficulty` ∈ easy/medium/hard/deadly (400 si no) | IMPLEMENTED | internal/service/srd_encounter.go:27-34; internal/handler/srd_handler.go:278-281 |
| ENC-15 | Al menos 3 sugerencias cuando sea posible (SHOULD) | IMPLEMENTED | internal/service/srd_encounter.go:333-339 |
| ENC-16 | Sin coincidencias: array vacío con mensaje explicativo | IMPLEMENTED | internal/service/srd_encounter.go:371-382 |
| ENC-17 | Clasificación trivial/easy/medium/hard/deadly | IMPLEMENTED | internal/service/srd_encounter.go:142-154; internal/service/srd_encounter_test.go:48 |
| ENC-18 | Botón «Añadir a Combate» añade los monstruos al tracker de iniciativa | IMPLEMENTED | the button is renamed "Añadir a combate". frontend/src/pages/EncounterBuilder.tsx:242 — *corregido 2026-11-22* |
| ENC-19 | Cada monstruo con iniciativa tirada 1d20 + mod. DES | IMPLEMENTED | internal/service/encounter_combatants.go:124 |
| ENC-20 | PG del monstruo = valor hp del catálogo | IMPLEMENTED | internal/service/encounter_combatants.go:110-126 |
| ENC-21 | El encuentro se registra como game_event | IMPLEMENTED | internal/realtime/middleware.go:89-90; internal/realtime/hub.go:363 |
| ENC-22 | CA sin armadura = 10 + DES | IMPLEMENTED | internal/service/srd_loadout.go:82-83 |
| ENC-23 | Armadura ligera = base + DES | IMPLEMENTED | internal/service/srd_loadout.go:89-90 |
| ENC-24 | Armadura media = base + DES (máx. 2) | IMPLEMENTED | internal/service/srd_loadout.go:91-95 |
| ENC-25 | Armadura pesada = base (sin DES) | IMPLEMENTED | internal/service/srd_loadout.go:96-97 |
| ENC-26 | Escudo +2 | IMPLEMENTED | internal/service/srd_loadout.go:122-125 |
| ENC-27 | Peso total = Σ peso × cantidad | IMPLEMENTED | internal/service/srd_loadout.go:65-71 |
| ENC-28 | Capacidad de carga = FUE × 15 | IMPLEMENTED | internal/service/srd_loadout.go:59-61 |
| ENC-29 | Peso > capacidad → «Encumbered» | IMPLEMENTED | internal/service/srd_loadout.go:130-133 |
| ENC-30 | Peso > 2 × capacidad → «Heavily Encumbered» | IMPLEMENTED | internal/service/srd_loadout.go:134-137 |
| ENC-31 | FUE < str_minimum de armadura pesada → aviso «Speed reduced by 10 ft.» y requisito de FUE en el análisis | IMPLEMENTED | internal/service/srd_loadout.go:117-120; internal/service/srd_encounter_test.go:166 |

## vtt.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| VTT-01 | Mesa táctica nativa por campaña que funciona en LAN sin Foundry ni servicios externos | IMPLEMENTED | cmd/server/main.go:116,207; internal/handler/vtt_handler.go:34 |
| VTT-02 | Escenas con cuadrícula ajustable, fichas en tiempo real, muros y puertas, luces, regla y niebla dinámica por usuario según visión 5e | IMPLEMENTED | frontend/src/components/vtt/TableCanvas.tsx:6; frontend/src/lib/vision.ts:108 |
| VTT-03 | Iluminación avanzada (color, animada, elevación, conos) fuera de alcance v1 | IMPLEMENTED | internal/domain/vtt.go:25 (las luces solo tienen radios bright/dim) |
| VTT-04 | Arquitectura: capas de canvas, motor de visión en cliente, memoria de explorado en localStorage, filtrado por rol y colisión en servidor, Hub.Publish("vtt.*") → Redis, tablas vtt_scenes/vtt_tokens | IMPLEMENTED | migrations/015_vtt.sql:3,25; internal/realtime/hub.go:353 |
| VTT-05 | Escena: nombre, URL de mapa, ancho/alto, cuadrícula (70 por defecto), desplazamiento, pies por casilla (5), luz ambiente, niebla, muros, luces | IMPLEMENTED | internal/domain/vtt.go:89-111; internal/handler/vtt_handler.go:236 |
| VTT-06 | Cero o una escena activa por campaña | IMPLEMENTED | migrations/015_vtt.sql:23; internal/repository/vtt_repo.go:83-100 |
| VTT-07 | Los jugadores solo ven la escena activa | IMPLEMENTED | internal/handler/vtt_handler.go:105,136-139 |
| VTT-08 | Solo el GM crea, edita, activa o borra escenas | IMPLEMENTED | internal/handler/vtt_handler.go:228,249,284,297 (no existe rol admin global; GM de la campaña) |
| VTT-09 | El GM sube mapas PNG/JPEG/WebP ≤ 15 MB, validados por contenido y guardados en el directorio de subidas | IMPLEMENTED | internal/handler/upload_handler.go:16-18,52,61 |
| VTT-10 | Escenario: activar escena → única activa, evento vtt.scene.activated, jugadores la ven sin recargar | IMPLEMENTED | internal/handler/vtt_handler.go:296-306; frontend/src/lib/RealtimeProvider.tsx:49-53 |
| VTT-11 | Escenario: un jugador lista escenas y solo recibe la activa o ninguna | IMPLEMENTED | internal/repository/vtt_repo.go:33-35; internal/handler/vtt_handler.go:105 |
| VTT-12 | Ficha: nombre, tipo pc/npc/monster, personaje, dueño, imagen o color, posición, tamaño, PV, CA, oculta y campos de visión/luz | IMPLEMENTED | internal/domain/vtt.go:113-143 |
| VTT-13 | Una ficha PC creada desde un personaje toma como dueño al usuario del personaje | IMPLEMENTED | internal/handler/vtt_handler.go:420-426 |
| VTT-14 | La ficha PC prellena visión en la oscuridad por raza (60 ft; drow 120 ft) | IMPLEMENTED | internal/service/vtt_rules.go:72-84; internal/service/vtt_rules_test.go:34 |
| VTT-15 | La ficha de monstruo prellena visión en la oscuridad/vista ciega desde `senses` | IMPLEMENTED | internal/handler/vtt_handler.go:439; internal/service/vtt_rules.go:90-104 |
| VTT-16 | Las posiciones se ajustan a la cuadrícula al soltar | IMPLEMENTED | internal/handler/vtt_handler.go:450,529; internal/service/vtt_rules.go:108-120 |
| VTT-17 | Ver ficha: jugador solo no ocultas; GM siempre | IMPLEMENTED | internal/repository/vtt_repo.go:102-107; internal/handler/vtt_handler.go:85 |
| VTT-18 | Mover ficha: dueño las suyas, no dueño MUST NOT, GM todas | IMPLEMENTED | internal/handler/vtt_handler.go:497-501 |
| VTT-19 | Editar visión, PV, oculta, dueño: solo GM | IMPLEMENTED | internal/handler/vtt_handler.go:460 |
| VTT-20 | Crear/borrar fichas: solo GM | IMPLEMENTED | internal/handler/vtt_handler.go:403,551 |
| VTT-21 | Escenario: ficha oculta no llega al jugador; el GM la recibe marcada como oculta | IMPLEMENTED | internal/handler/vtt_handler.go:85; internal/repository/vtt_repo.go:105-107 |
| VTT-22 | Escenario: el dueño arrastra su ficha → se persiste, se emite vtt.token.moved y los demás la actualizan sin recargar la escena | IMPLEMENTED | internal/handler/vtt_handler.go:538-546; frontend/src/pages/VirtualTable.tsx:77-88 |
| VTT-23 | Escenario: mover una ficha ajena → HTTP 403 sin persistir | IMPLEMENTED | internal/handler/vtt_handler.go:498-500 |
| VTT-24 | Escenario: cruzar un muro cerrado → 422 "Movement blocked by a wall"; el GM puede atravesarlo | IMPLEMENTED | internal/handler/vtt_handler.go:534-536; internal/service/vtt_rules.go:14-24 |
| VTT-25 | Visión calculada en el cliente; el GM ve todo y puede previsualizar «Ver como…» | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx:172-176,401-402 |
| VTT-26 | LOS: muros y puertas cerradas bloquean la vista; puertas abiertas no | IMPLEMENTED | frontend/src/lib/vision.ts:31,113; internal/domain/vtt.go:22 |
| VTT-27 | Lit: ambiente bright/dim ilumina todo; dark = unión de luces (fichas y escena) ∩ su LOS | IMPLEMENTED | frontend/src/lib/vision.ts:115-132 |
| VTT-28 | Regla: LOS ∩ rango de visión ∩ (Lit ∪ visión en la oscuridad ∪ vista ciega) | IMPLEMENTED | frontend/src/lib/vision.ts:138-148; internal/service/vtt_play_rules.go:63-76 |
| VTT-29 | La visión en la oscuridad ve la oscuridad como luz tenue | IMPLEMENTED | frontend/src/lib/vision.ts:164-173 |
| VTT-30 | Área visible = unión de las fichas del usuario; fichas con PV ≤ 0 siguen viendo | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx:175; frontend/src/lib/vision.ts:138 |
| VTT-31 | Fichas ajenas solo se dibujan si su centro está en el área visible | IMPLEMENTED | frontend/src/components/vtt/TableCanvas.tsx:140 |
| VTT-32 | Zonas exploradas recordadas por usuario y escena, atenuadas y sin fichas | IMPLEMENTED | frontend/src/components/vtt/TableCanvas.tsx:94-111; frontend/src/lib/vision.ts:150-162 |
| VTT-33 | La luz tenue y las zonas solo con visión en la oscuridad se dibujan oscurecidas | IMPLEMENTED | frontend/src/lib/vision.ts:164-173 |
| VTT-34 | Con la niebla desactivada los jugadores ven todo el mapa y todas las fichas no ocultas | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx:173; frontend/src/components/vtt/TableCanvas.tsx:103 |
| VTT-35 | Escenario: escena oscura; enano con 60 ft ve 60 ft limitado por muros, humano nada más allá de su ficha | IMPLEMENTED | frontend/src/lib/vision.ts:138-147; internal/service/vtt_play_rules_test.go:22 |
| VTT-36 | Escenario: antorcha 20/20 → ve 40 ft recortado por muros, 20–40 ft como luz tenue | IMPLEMENTED | frontend/src/lib/vision.ts:115-132,164-173 |
| VTT-37 | Escenario: el GM abre una puerta → deja de bloquear vista y movimiento; los clientes recalculan con vtt.scene.updated | IMPLEMENTED | frontend/src/components/vtt/TableCanvas.tsx:375-376; internal/handler/vtt_handler.go:279 |
| VTT-38 | Frontera de confianza: lo secreto MUST usar `hidden`, aplicado por el servidor | IMPLEMENTED | players get hidden combatants masked («Criatura oculta», token_id 0, row kept) — internal/handler/vtt_play_handler.go:311,323; internal/repository/vtt_play_repo.go:224 (t.hidden); internal/domain/vtt.go VTTCombatant.Hidden; tests internal/handler/vtt_combat_mask_test.go, internal/service/vtt_play_db_test.go — *corregido 2026-11-22* |
| VTT-39 | Cualquier miembro puede medir distancias en la escena activa | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx:21; frontend/src/components/vtt/TableCanvas.tsx:344 |
| VTT-40 | Distancia en pies con feet_per_cell y regla 5e de diagonales (Chebyshev) | IMPLEMENTED | frontend/src/lib/vision.ts:66-69 |
| VTT-41 | El GM añade una ficha a la iniciativa en una acción con su nombre y PV | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx:164-169,446 |
| VTT-42 | Los PV de una ficha PC muestran los PV actuales del personaje | IMPLEMENTED | internal/handler/vtt_handler.go:89-99; internal/repository/vtt_repo.go:148-164 |
| VTT-43 | Evento vtt.scene.activated {scene_id} | IMPLEMENTED | internal/handler/vtt_handler.go:305 |
| VTT-44 | Evento vtt.scene.updated en ajustes, muros, puertas, luces y alta/edición/baja de fichas | IMPLEMENTED | internal/handler/vtt_handler.go:279,455,485,560 |
| VTT-45 | Evento vtt.token.moved {scene_id, token_id, x, y} solo para fichas no ocultas | IMPLEMENTED | internal/handler/vtt_handler.go:542-546 |
| VTT-46 | Mover una ficha oculta publica vtt.scene.updated sin coordenadas | IMPLEMENTED | internal/handler/vtt_handler.go:542-543 |
| VTT-47 | Los movimientos no disparan el state.changed genérico | IMPLEMENTED | internal/realtime/middleware.go:18-21 |
| VTT-48 | API REST de §8 (12 rutas con sus roles) | IMPLEMENTED | internal/handler/vtt_handler.go:35-45; internal/handler/upload_handler.go:27 |
| VTT-49 | Decisión: movimiento de ficha oculta efímero, solo a GMs y dueño, nunca en game_events | IMPLEMENTED | internal/service/vtt_play.go:117-118,393-394,464-482 |
| VTT-50 | Decisión: vtt.object.looted solo a GMs y mostrado en su pantalla | IMPLEMENTED | internal/service/vtt_play.go:486-495; frontend/src/components/layout/GMLootNotices.tsx:24 |
| VTT-51 | Decisión: los nombres de escena y ficha conservan lo escrito mientras se guarda o sube el mapa | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx:39-47,94-107 |

## vtt-modes.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| VTM-01 | Cada escena tiene `mode` narrative/exploration/combat; solo el GM lo cambia | IMPLEMENTED | migrations/016_vtt_modes.sql:3; internal/handler/vtt_handler.go:205,249 |
| VTM-02 | Narrativo: el jugador ve solo la imagen a pantalla completa, sin cuadrícula, fichas, niebla ni herramientas | IMPLEMENTED | frontend/src/pages/VirtualTable.tsx:246-252; internal/handler/vtt_handler.go:78-80 |
| VTM-03 | Exploración: movimiento libre en tiempo real, niebla, objetos, zonas y detección; sin turnos | IMPLEMENTED | internal/service/vtt_play.go:70-184 |
| VTM-04 | Combate: toda la escena juega por turnos con todas las fichas no ocultas | IMPLEMENTED | Activate starts whole-scene combat for a scene already in combat mode (shared helper) — internal/handler/vtt_handler.go:280 (startSceneCombat), :272, :316 — *corregido 2026-11-22* |
| VTM-05 | Jugadores mueven sus fichas con WASD/flechas o joystick táctil; el GM arrastra cualquiera | IMPLEMENTED | frontend/src/lib/useExplorationMovement.ts:54-58,80-81; frontend/src/pages/VirtualTable.tsx:306 |
| VTM-06 | Ritmo derivado de la velocidad de la hoja × exploration_pace (×2 por defecto, rango ×1–×4); sin personaje, speed_ft de la ficha | IMPLEMENTED | movement paced by the linked character's current sheet speed — internal/service/vtt_play.go:365 (TokenSpeed), :110, :400; internal/handler/vtt_handler.go:541; DB test internal/service/vtt_play_db_test.go — *corregido 2026-11-22* |
| VTM-07 | Una ficha en sigilo se mueve a la mitad | IMPLEMENTED | internal/service/vtt_play_rules.go:85-87; frontend/src/lib/useExplorationMovement.ts:72 |
| VTM-08 | Movimiento por WS `vtt.move`, validado (propiedad, fuera de combate, muros, distancia ≤ tiempo + 25 %), emitido efímero; persistido ≤ 1/s | IMPLEMENTED | internal/service/vtt_play.go:76-120; cmd/server/main.go:98 |
| VTM-09 | Un paso bloqueado se desliza por el eje libre (o se detiene); el cliente aplica la misma regla | IMPLEMENTED | internal/service/vtt_rules.go:28-39; frontend/src/lib/useExplorationMovement.ts:13-19 |
| VTM-10 | `corrected: true` si difiere > ¼ casilla y el cliente se resincroniza; última posición persistida en ~1,5 s | IMPLEMENTED | internal/service/vtt_play.go:106,431-451; frontend/src/lib/useExplorationMovement.ts:65-69 |
| VTM-11 | Las fichas en combate MUST NOT moverse en tiempo real | IMPLEMENTED | internal/service/vtt_play.go:87-89; internal/handler/vtt_handler.go:522-525 |
| VTM-12 | Escenario: enano 25 ft y elfo 30 ft 3 s a ×2; 60 ft en 1 s se recorta | IMPLEMENTED | internal/service/vtt_play.go:99-101; internal/service/vtt_play_rules_test.go:45 |
| VTM-13 | El GM coloca objetos con nombre, posición, discover_dc, requisitos, botín, per_character o un solo uso | IMPLEMENTED | internal/handler/vtt_play_handler.go:159-241; frontend/src/components/vtt/PlayLayer.tsx:127-186 |
| VTM-14 | Requisito: hitos de campaña marcados por el GM | IMPLEMENTED | internal/service/vtt_play.go:550-564; internal/handler/vtt_play_handler.go:53-101 |
| VTM-15 | Condiciones silenciosas (clase, raza, objeto, pasiva ≥ N) evaluadas en servidor; el jugador solo ve éxito o fracaso | IMPLEMENTED | internal/service/vtt_play_rules.go:185-215; internal/service/vtt_play.go:566-568 |
| VTM-16 | Prueba explícita habilidad + CD: el servidor tira d20 + modificador, muestra la tirada; bono fijo opcional del GM | IMPLEMENTED | internal/service/vtt_play.go:570-578 |
| VTM-17 | Botín `fixed` (objetos y oro) o `table` ponderada tirada en silencio | IMPLEMENTED | internal/service/vtt_play.go:589-600; internal/service/vtt_play_rules.go:226-242 |
| VTM-18 | Interactuar requiere la ficha a 5 ft; un intento por personaje y objeto; el GM puede reiniciar | IMPLEMENTED | internal/service/vtt_play.go:515-525; internal/repository/vtt_play_repo.go:120-126; internal/handler/vtt_play_handler.go:258-269 |
| VTM-19 | Al tener éxito el botín se añade de forma atómica y se avisa al GM | IMPLEMENTED | internal/repository/vtt_play_repo.go:114-145; internal/service/vtt_play.go:611 |
| VTM-20 | Escenario: cofre DC 14 + hito + Investigación CD 12 + tabla; tirada mostrada, botín silencioso, 2.º intento rechazado | IMPLEMENTED | internal/service/vtt_play.go:534-612; internal/handler/vtt_play_handler.go:276-277 |
| VTM-21 | El GM dibuja zonas de encuentro vinculadas a monstruos; entrar en una zona armada dispara el encuentro una vez | IMPLEMENTED | internal/service/vtt_play.go:145-152; frontend/src/components/vtt/PlayLayer.tsx:98 |
| VTM-22 | Monstruos con `detects` detectan con sus sentidos; un PJ en sigilo hace Sigilo silencioso al entrar en su vista, detectado si < Percepción pasiva | IMPLEMENTED | internal/service/vtt_play.go:154-182 |
| VTM-23 | El GM puede iniciar un encuentro a mano seleccionando fichas | IMPLEMENTED | internal/handler/vtt_play_handler.go:312-357; frontend/src/pages/VirtualTable.tsx:503 |
| VTM-24 | Participantes: monstruos vinculados/detectores + PJ a ≤ 60 ft con LOS; iniciativa automática d20 + DES | IMPLEMENTED | internal/service/vtt_play.go:188-232 |
| VTM-25 | Los de fuera siguen explorando y ven un marcador ⚔; quien entra a 60 ft con LOS se une al final del asalto | IMPLEMENTED | frontend/src/components/vtt/TableCanvas.tsx:279-289; internal/service/vtt_play.go:134-143,249-256 |
| VTM-26 | Orden por iniciativa; solo el combatiente activo mueve hasta su velocidad (Correr la dobla); regla de distancia 5e | IMPLEMENTED | internal/service/vtt_play.go:354-389 |
| VTM-27 | Turno de jugador con temporizador de 30 s en servidor; al agotarse pasa conservando el movimiento; GM pausa/reanuda o +15 s; monstruos/PNJ sin temporizador | IMPLEMENTED | internal/service/vtt_play.go:327-351,403-428; frontend/src/components/vtt/PlayLayer.tsx:65-69 |
| VTM-28 | El GM termina el combate; termina solo cuando todos los monstruos tienen PV ≤ 0; vuelven a exploración | IMPLEMENTED | internal/service/vtt_play.go:258-260,294-316; internal/handler/vtt_handler.go:482-484 |
| VTM-29 | Varios combates simultáneos en la misma escena | IMPLEMENTED | internal/repository/vtt_play_repo.go:184-195; migrations/016_vtt_modes.sql:66 |
| VTM-30 | Escenario: turno de Lyra agota 30 s → avanza, emite vtt.combat.updated, los exploradores siguen moviéndose | IMPLEMENTED | internal/service/vtt_play.go:270,419-424,87-89 |
| VTM-31 | Cliente → servidor `vtt.move` {token_id,x,y} ~8 Hz | IMPLEMENTED | frontend/src/lib/useExplorationMovement.ts:89; internal/realtime/hub.go:56-57 |
| VTM-32 | Servidor → clientes `vtt.token.moved` efímero | IMPLEMENTED | combat moves and REST drags send vtt.token.moved via ephemeral Broadcast — internal/service/vtt_play.go:68 (BroadcastMoved), :418; internal/handler/vtt_handler.go:564 — *corregido 2026-11-22* |
| VTM-33 | `vtt.combat.updated` {scene_id, combat_id} | IMPLEMENTED | internal/service/vtt_play.go:230,270,314 |
| VTM-34 | `vtt.object.updated` {scene_id} | PARTIAL | reinicio (internal/handler/vtt_play_handler.go:267) envía {object_id} y hitos (vtt_play_handler.go:99) {milestone_id}, sin scene_id — *avance 2026-11-22: el reinicio de objetos ya incluye scene_id; los hitos son de campaña y quedan como excepción pendiente de decisión* |
| VTM-35 | `vtt.object.looted` solo al GM {object_id, character_id, success, detail} | IMPLEMENTED | internal/service/vtt_play.go:486-495 |
| VTM-36 | REST hitos: GET miembro / POST GM; PUT GM | IMPLEMENTED | internal/handler/vtt_play_handler.go:19-21,62-63,83-84 |
| VTM-37 | REST objetos: GET filtrado / POST GM; PUT/DELETE GM; interact dueño de ficha adyacente; reset GM | IMPLEMENTED | internal/handler/vtt_play_handler.go:22-27,114-157 |
| VTM-38 | REST combates: GET miembro; POST GM (token_ids); next/end/pause/extend/dash; move; sneak (dueño) | IMPLEMENTED | internal/handler/vtt_play_handler.go:28-32,381-474 |

## foundry-integration.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| FND-01 | Sync unidireccional Foundry→app; la app no escribe estado de juego en Foundry | IMPLEMENTED | internal/foundry/client.go:107-160 (solo GET /clients, /search, /get); internal/service/foundry_sync_service.go:65-117 |
| FND-02 | Foundry es dueño de personajes, NPCs, inventario, bestiario y mapas (tabla de propiedad: espejo de solo lectura) | PARTIAL | Las filas espejadas (foundry_uuid) se pueden editar en la app sin guardia (se pisan en el siguiente sync): internal/repository/foundry_repo.go:94-134; no hay chequeo de foundry_uuid en internal/service ni internal/handler |
| FND-03 | La app es dueña de lore, mensajería, mercado, trades, eventos y notas | IMPLEMENTED | internal/service/foundry_sync_service.go:79-86 (el sync solo toca actores, escenas, diario y monstruos) |
| FND-04 | Escritura de vuelta a Foundry fuera de alcance (MAY futuro) | IMPLEMENTED | internal/foundry/client.go:28-30 (no hay rutas de escritura) |
| FND-05 | El mundo Foundry tiene instalado el módulo foundryvtt-rest-api con API key y URL del relay | UNVERIFIABLE-IN-CODE | Configuración del mundo Foundry (fuera del repo) |
| FND-06 | Relay foundryvtt-rest-api-relay self-hosted como servicio en infra/docker-compose.yml | IMPLEMENTED | infra/docker-compose.yml:36-44; docker-compose.yml:65-71 (perfil foundry) |
| FND-07 | El backend accede a Foundry solo por la REST del relay, nunca a sus ficheros de BD | IMPLEMENTED | internal/foundry/client.go:132-160 |
| FND-08 | base_url/api_key/client_id configurables en config.yaml (foundry:) y por env; la key no se commitea | IMPLEMENTED | config.yaml:46-53; internal/config/config.go:178-180; .env.example:21-23 |
| FND-09 | Escenario: GM invoca POST /api/foundry/sync → pull de todos los tipos, upsert por foundry_uuid, resultado en foundry_sync_state | IMPLEMENTED | internal/handler/foundry_handler.go:80-95; internal/service/foundry_sync_service.go:65-117 |
| FND-10 | Escenario: player invoca POST /api/foundry/sync → 403 y queda registrado | IMPLEMENTED | internal/handler/foundry_handler.go:68-71; internal/middleware/audit_logger.go:109-120 |
| FND-11 | Cada entidad espejada guarda foundry_uuid único | IMPLEMENTED | migrations/010_foundry_integration.sql:6-17,38,54; migrations/011_foundry_reference.sql:5-27 |
| FND-12 | Upsert por foundry_uuid: insertar si falta, actualizar campos sincronizados si existe | IMPLEMENTED | internal/repository/foundry_repo.go:94-192 |
| FND-13 | Política de conflicto "Foundry gana" | IMPLEMENTED | internal/repository/foundry_repo.go:100-107,123-128 |
| FND-14 | Los campos propios de la app en la misma fila no se sobrescriben | IMPLEMENTED | re-sync no longer overwrites lore_tier — internal/repository/foundry_repo.go:166-172; DB test internal/service/foundry_lore_db_test.go — *corregido 2026-11-22* |
| FND-15 | Escenario borrado: marcar is_foundry_orphan=TRUE; no borrar en duro filas referenciadas | IMPLEMENTED | internal/repository/foundry_repo.go:50-70 (solo UPDATE, nunca DELETE) |
| FND-16 | Actor "character" → characters (nombre, raza, clase, nivel, características, PV máx/actuales/temp, CA, velocidad); el resto se ignora | IMPLEMENTED | internal/foundry/mapping.go:103-138 |
| FND-17 | Actor "npc" → npcs (nombre, CA, PV, velocidad, descripción) | PARTIAL | Se escribe en la tabla `npcs` (mapping.go:141-161; foundry_repo.go:136-148), pero la app lee los NPC de campaign_npcs (internal/repository/campaign_resource_repo.go:22), así que el espejo no se ve en ninguna parte |
| FND-18 | Ítems embebidos → inventory_items del personaje (por el foundry_uuid del actor); se conserva equipado/sintonizado | IMPLEMENTED | internal/foundry/mapping.go:164-186; internal/service/foundry_sync_service.go:156-162 |
| FND-19 | Monstruo de compendio → srd_monsters con marca de origen distinta del SRD incluido | IMPLEMENTED | internal/repository/foundry_repo.go:179-192 (is_srd=FALSE + foundry_uuid) |
| FND-20 | Escena → maps (nombre, imagen/fondo, notas) | PARTIAL | Las notas no se mapean (mapping.go:189-201; foundry_repo.go:150-158) y la tabla `maps` no la lee la app (usa campaign_maps, campaign_resource_repo.go:23) |
| FND-21 | Entrada de diario → lore | IMPLEMENTED | internal/service/foundry_sync_service.go:196-229 |
| FND-22 | Encolar un trabajo de embedding en el pool RAG por cada entrada de diario sincronizada | IMPLEMENTED | journal entries whose text changed are re-embedded (needs_embedding = new OR content changed) — internal/repository/foundry_repo.go:172; internal/service/foundry_sync_service.go:220,225 — *corregido 2026-11-22* |
| FND-23 | El tier de lore usa por defecto el valor configurado salvo que el GM lo cambie | IMPLEMENTED | re-sync no longer overwrites lore_tier — internal/repository/foundry_repo.go:166-172; DB test internal/service/foundry_lore_db_test.go — *corregido 2026-11-22* |
| FND-24 | Solo se sincronizan los campos que usa el esquema (importación con pérdida) | IMPLEMENTED | internal/foundry/mapping.go:11-46 |
| FND-25 | (SHOULD) Push de hooks del relay (updateActor) → actualizar el espejo sin resync completo + CHARACTER_UPDATE por Redis | MISSING | No hay ninguna suscripción a eventos del relay en internal/foundry ni internal/service (grep updateActor = 0) |
| FND-26 | Sin push: sync manual del GM (o periódico) como alternativa | IMPLEMENTED | frontend/src/pages/FoundryCombat.tsx:52-69; internal/handler/foundry_handler.go:44 |
| FND-27 | La vista de combate / juego en vivo es el cliente Foundry en un iframe con src=VITE_FOUNDRY_URL | IMPLEMENTED | frontend/src/pages/FoundryCombat.tsx:7,104-110 |
| FND-28 | Escenario: un usuario abre la vista Combate → iframe; se autentica en Foundry dentro del marco | IMPLEMENTED | /campaign/:id/combat guarded by campaign mode (local campaigns redirect to the hub), any member may open it in Foundry mode, sync button only for the campaign GM — frontend/src/App.tsx:53,105; frontend/src/pages/FoundryCombat.tsx:33 — *corregido 2026-11-22* |
| FND-29 | El proxy inverso de Foundry envía CSP frame-ancestors con el origen de la app | UNVERIFIABLE-IN-CODE | El proxy de Foundry no está en el repo |
| FND-30 | El proxy de Foundry no envía X-Frame-Options DENY/SAMEORIGIN | UNVERIFIABLE-IN-CODE | El proxy de Foundry no está en el repo |
| FND-31 | La cookie de sesión de Foundry es SameSite=None; Secure | UNVERIFIABLE-IN-CODE | Depende de la configuración de la instancia Foundry |
| FND-32 | CORS configurado para llamadas desde el origen de Foundry | IMPLEMENTED | cmd/server/main.go:278-302 (allowed_origins configurable) |
| FND-33 | El JWT de la app y la sesión de Foundry son independientes; no se pasa el JWT al iframe | IMPLEMENTED | frontend/src/pages/FoundryCombat.tsx:105-110 (src es la URL a secas) |
| FND-34 | Escenario: un trade o una compra en el mercado no se propagan a Foundry | IMPLEMENTED | internal/repository/trade_repository.go:236 (solo BD local); no hay escritura en el relay |
| FND-35 | La UI indica que el inventario autoritativo vive en Foundry | IMPLEMENTED | frontend/src/components/foundry/FoundryAuthorityNotice.tsx; frontend/src/pages/InventoryTab.tsx:82; frontend/src/pages/Trade.tsx:109; frontend/src/pages/Marketplace.tsx:25 (aviso: el inventario oficial vive en Foundry) — *corregido 2026-11-22* |
| FND-36 | Los flujos de mercado y trade no se presentan como autoritativos sobre Foundry | IMPLEMENTED | mismo aviso en Inventario, Intercambios y Mercado — *corregido 2026-11-22* |
| FND-37 | POST /api/foundry/sync (JWT GM) | IMPLEMENTED | internal/handler/foundry_handler.go:44,86 |
| FND-38 | GET /api/foundry/status (JWT) | IMPLEMENTED | internal/handler/foundry_handler.go:43,145-179 |
| FND-39 | GET /api/foundry/health (JWT) | IMPLEMENTED | internal/handler/foundry_handler.go:42,181-187; cmd/server/main.go:150,206 |
| FND-40 | /api/foundry/sync restringido a rol gm | IMPLEMENTED | internal/handler/foundry_handler.go:55-77 |
| FND-41 | Límite de ráfaga en el sync (5 req/min por usuario) | IMPLEMENTED | internal/handler/foundry_handler.go:17,41-45; config.yaml:38 |
| FND-42 | x-api-key solo en el servidor, nunca expuesta al frontend | IMPLEMENTED | internal/foundry/client.go:150; frontend solo usa VITE_FOUNDRY_URL |
| FND-43 | Formato de respuesta {status, last_synced_at, counts{...}, errors[]} | IMPLEMENTED | internal/handler/foundry_handler.go:162-179; internal/domain/foundry.go:52-59 |
| FND-44 | Escenario relay/Foundry caído: error claro, sin corrupción parcial (transacción por tipo), status="error" con causa | IMPLEMENTED | internal/service/foundry_sync_service.go:87-116; internal/repository/foundry_repo.go:36-46 |
| FND-45 | Los embeddings del lore sincronizado no bloquean el sync; van a la cola del pool RAG | IMPLEMENTED | internal/service/rag_worker.go:75-82; internal/service/foundry_sync_service.go:233-236 |
| FND-46 | Escenario bootstrap: exportar srd_* como MÓDULO Foundry con packs de compendio | IMPLEMENTED | cmd/foundry-export/main.go:45-91,150-185 |
| FND-47 | Tras instalar el módulo, Foundry es la fuente de verdad de los datos de referencia (sync inverso autoritativo) | IMPLEMENTED | internal/service/foundry_sync_service.go:314-389 |
| FND-48 | El relay no escribe referencia; se emite JSON fuente compilado con @foundryvtt/foundryvtt-cli | IMPLEMENTED | cmd/foundry-export/main.go:86-91,111 |
| FND-49 | _id determinista de 16 caracteres a partir de tipo + nombre | IMPLEMENTED | internal/foundry/export.go:23-30 |
| FND-50 | El _id se guarda en srd_*.foundry_uuid | IMPLEMENTED | cmd/foundry-export/main.go:144; internal/repository/srd_export_repo.go:83-88 |
| FND-51 | Monstruos, conjuros e ítems se exportan con alta fidelidad | IMPLEMENTED | internal/foundry/export.go:44-160 |
| FND-52 | Clases, subclases y razas descriptivas (nombre, descripción, dado de golpe, salvaciones) sin advancement | IMPLEMENTED | class export includes descriptive saving throws (system.saves) — internal/foundry/export.go:174,211; test internal/foundry/export_saves_test.go — *corregido 2026-11-22* |
| FND-53 | Escenario POST /api/foundry/sync/reference: leer los compendios con GET /search filtrando documentType/subType | IMPLEMENTED | internal/foundry/client.go:204-215; internal/service/foundry_sync_service.go:336-371 |
| FND-54 | Upsert en la tabla srd_* correspondiente por foundry_uuid (gana Foundry) | IMPLEMENTED | internal/repository/srd_export_repo.go:93-164 |
| FND-55 | Las entradas homebrew (is_srd=FALSE) se conservan y se importan | IMPLEMENTED | compendium documents marked source.custom="Homebrew" import with is_srd=false — internal/foundry/export.go:235 (IsSRDDocument); internal/service/foundry_sync_service.go:338-370; test internal/foundry/export_saves_test.go — *corregido 2026-11-22* |
| FND-56 | CLI cmd/foundry-export | IMPLEMENTED | cmd/foundry-export/main.go |
| FND-57 | POST /api/foundry/sync/reference (dm/admin) | IMPLEMENTED | internal/handler/foundry_handler.go:45,101-126 |
| FND-58 | Bloque de configuración foundry (relay_base_url, api_key, client_id, default_lore_tier, sync_compendium) | IMPLEMENTED | config.yaml:46-53; internal/config/config.go:103-112 |
| FND-59 | VITE_FOUNDRY_URL apunta al cliente Foundry del iframe | IMPLEMENTED | frontend/src/pages/FoundryCombat.tsx:7 |
| FND-60 | Comportamiento en vivo extremo a extremo (relay conectado al mundo, compendios en /search, iframe sirviendo Foundry) | UNVERIFIABLE-IN-CODE | Requiere una instancia Foundry con licencia; contrato cubierto por internal/foundry/client_test.go |

## frontend-screens.md

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| FS-01 | Login: dos columnas (marca / formulario; apilado en móvil) | IMPLEMENTED | frontend/src/pages/Login.tsx:34-42 |
| FS-02 | Login: correo con etiqueta flotante | PARTIAL | frontend/src/pages/Login.tsx:47 (etiqueta fija sobre el campo) |
| FS-03 | Login: contraseña con mostrar/ocultar | IMPLEMENTED | frontend/src/pages/Login.tsx:48 |
| FS-04 | Login: casilla "Recordarme" | IMPLEMENTED | frontend/src/pages/Login.tsx:51; frontend/src/lib/AuthProvider.tsx:27-28 |
| FS-05 | Login: botón "Iniciar Sesión" y enlace "¿No tienes cuenta? Regístrate" | IMPLEMENTED | frontend/src/pages/Login.tsx:52,54 |
| FS-06 | Login correcto: guarda el JWT y redirige a la lista de campañas | IMPLEMENTED | frontend/src/pages/Login.tsx:26-27; frontend/src/lib/AuthProvider.tsx:28 |
| FS-07 | Login fallido: error inline | IMPLEMENTED | frontend/src/pages/Login.tsx:29,50 |
| FS-08 | Registro: dos columnas; usuario, correo, contraseña, confirmar; toggle de visibilidad; "Crear Cuenta"; enlace a login | IMPLEMENTED | frontend/src/pages/Register.tsx:37-142 |
| FS-09 | Registro: la confirmación de contraseña debe coincidir | IMPLEMENTED | frontend/src/pages/Register.tsx:19-21 |
| FS-10 | Lista de campañas: sidebar (escritorio) + rejilla de tarjetas + barra inferior (móvil) | IMPLEMENTED | frontend/src/components/layout/Layout.tsx:31-40; frontend/src/pages/CampaignList.tsx:76 |
| FS-11 | Avatar + nombre de usuario + insignia de rol | IMPLEMENTED | frontend/src/components/layout/TopAppBar.tsx:30,44-49 (en la barra superior) |
| FS-12 | Sidebar con enlaces Campaigns, Party Roster, Combat Log, Campaign Notes, Settings | SUPERSEDED | openspec/specs/design-system.md:21-23; frontend/src/lib/nav.ts:4-31 |
| FS-13 | Barra superior: búsqueda, avatar, logo | IMPLEMENTED | frontend/src/pages/CampaignList.tsx:52-55; frontend/src/components/layout/SideNav.tsx:48-53; TopAppBar.tsx:44 |
| FS-14 | Tarjeta de campaña: imagen, estado (Activa/En Pausa), nombre, descripción, DM, nº jugadores | IMPLEMENTED | migration 030_campaign_cover.sql adds `campaigns.cover_url` (Up and Down tried on the test DB) Backend: create and update accept it, with ValidCoverURL (only "", /uploads/ or http(s)). internal/service/campaign_service.go:31; test internal/service/campaign_cover_test.go Campaign list shows the cover image. frontend/src/pages/CampaignList.tsx:82 Campaign creation takes a URL. frontend/src/pages/CreateCampaign.tsx:4… — *corregido 2026-11-22* |
| FS-15 | "Crear Campaña" solo DM: botón escritorio + FAB móvil | IMPLEMENTED | frontend/src/pages/CampaignList.tsx:43-48,112-116 |
| FS-16 | Hub de campaña: nombre + estado de conexión | IMPLEMENTED | frontend/src/pages/CampaignHub.tsx:29; frontend/src/components/layout/TopAppBar.tsx:39-42 |
| FS-17 | Hub: estadísticas rápidas CA, Iniciativa, Velocidad, Percepción pasiva | IMPLEMENTED | frontend/src/pages/CampaignHub.tsx:33 |
| FS-18 | Hub: tiradas rápidas (arma, Sigilo, Percepción, Acrobacias…) | IMPLEMENTED | ability-check buttons and a skill roll picker in the hub. frontend/src/pages/CampaignHub.tsx:41-42 — *corregido 2026-11-22* |
| FS-19 | Hub: estado del grupo con barras de PV | IMPLEMENTED | frontend/src/pages/CampaignHub.tsx:35 |
| FS-20 | Hub: vista rápida flotante con barra de PV + botón D20 | IMPLEMENTED | floating HP bar for the player's own character in the hub. frontend/src/pages/CampaignHub.tsx:50 — *corregido 2026-11-22* |
| FS-21 | Hub: barra inferior Sheet/Plot/Chat/Market/Inbox | SUPERSEDED | openspec/specs/design-system.md:21; frontend/src/components/layout/BottomNav.tsx:10-25 |
| FS-22 | Consola del DM solo para el GM | IMPLEMENTED | frontend/src/App.tsx:50-62,81 |
| FS-23 | Consola: pestañas Combat/NPCs/Party/Events (barra superior y barra inferior móvil) | SUPERSEDED | openspec/specs/design-system.md:23; frontend/src/pages/GMConsole.tsx:19-32,161-171; frontend/src/lib/nav.ts:18-30 |
| FS-24 | Acciones rápidas: Tirada secreta, Encuentro aleatorio, Añadir nota | IMPLEMENTED | frontend/src/pages/GMConsole.tsx:91-93,191-197 |
| FS-25 | Consola: iniciativa ordenada con PV y turno actual resaltado | IMPLEMENTED | frontend/src/pages/GMConsole.tsx:142-159 |
| FS-26 | Consola: estado del grupo en tarjetas con PV | IMPLEMENTED | frontend/src/pages/GMConsole.tsx:114-140 |
| FS-27 | Hoja: pestañas compartidas Stats/Spells/Inventory/Bio | IMPLEMENTED | frontend/src/components/character/CharacterTabs.tsx:4-10 |
| FS-28 | Hoja: cabecera avatar + nombre + clase/nivel/raza | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:55-64 |
| FS-29 | Hoja: fila CA / Iniciativa / Velocidad | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:67-80 |
| FS-30 | Hoja: PV actual/máx con barra + Curar | IMPLEMENTED | frontend/src/components/character/HpPanel.tsx:31-54 |
| FS-31 | Hoja: rejilla 2×3 de características (modificador grande + puntuación) | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:85-98 |
| FS-32 | Hoja: característica de lanzamiento resaltada | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:34-36,89 |
| FS-33 | Hoja: lista de habilidades/competencias (nombre, modificador, bono total) | PARTIAL | frontend/src/pages/CharacterSheet.tsx:100-113 (solo Percepción pasiva) — *avance 2026-11-22: lista de 18 habilidades con modificador y competencia racial (frontend/src/lib/skills.ts); las elecciones de habilidades de clase y trasfondo no se guardan (requiere decisión de modelo)* |
| FS-34 | Hoja: FAB de tirada D20 | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:116-123 |
| FS-35 | Hoja: barra inferior Sheet/Plot/Chat/Market/Inbox | SUPERSEDED | frontend/src/components/layout/BottomNav.tsx:10-25 |
| FS-36 | Conjuros: CD de salvación + bono de ataque | IMPLEMENTED | spell attack bonus next to the save DC. frontend/src/pages/SpellsTab.tsx:60 — *corregido 2026-11-22* |
| FS-37 | Conjuros: espacios por nivel con puntos llenos/vacíos | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:47-48 |
| FS-38 | Conjuros: lista por nivel con nombre, escuela, descripción expandible, tiempo/alcance/duración, "Lanzar" | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:39,49 |
| FS-39 | Conjuros: buscador de conjuros | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:42,51 (botón en cabecera + modal) |
| FS-40 | Conjuros: descanso largo restaura espacios | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:47; cmd/server/main.go:178 |
| FS-41 | Rasgos: sentidos pasivos Percepción, Investigación, Perspicacia | IMPLEMENTED | passive Investigation and Insight. frontend/src/pages/FeaturesTab.tsx:65 — *corregido 2026-11-22* |
| FS-42 | Rasgos: tarjeta de idiomas y competencias (armaduras, armas, idiomas) | IMPLEMENTED | (read only): proficiencies from srd_classes and languages from srd_races in the FeaturesTab class block. frontend/src/pages/FeaturesTab.tsx:72 — *corregido 2026-11-22* |
| FS-43 | Rasgos de clase: nombre + nivel + contador de usos + descripción | PARTIAL | frontend/src/pages/FeaturesTab.tsx:62-72 (sin nivel; usos solo como texto informativo) |
| FS-44 | Dotes y rasgos raciales en listas propias | IMPLEMENTED | features grouped as class features, racial traits and feats. frontend/src/pages/FeaturesTab.tsx:17 — *corregido 2026-11-22* |
| FS-45 | Rasgos: sidebar con Campaigns/Character Hub/Encounter Builder/… | SUPERSEDED | frontend/src/lib/nav.ts:4-31 |
| FS-46 | Inventario: oro con edición | IMPLEMENTED | frontend/src/pages/InventoryTab.tsx:76 |
| FS-47 | Inventario: 8 ranuras de equipo con "Vacío" | IMPLEMENTED | frontend/src/pages/InventoryTab.tsx:13-16,78-80 |
| FS-48 | Mochila: nombre, cantidad, tipo, peso, rareza, Usar/Equipar/Eliminar | IMPLEMENTED | frontend/src/pages/InventoryTab.tsx:55-66,85-87 |
| FS-49 | Inventario: barra de peso fija | IMPLEMENTED | frontend/src/pages/InventoryTab.tsx:90-93 |
| FS-50 | Inventario: añadir objeto | IMPLEMENTED | frontend/src/pages/InventoryTab.tsx:71,94 |
| FS-51 | Inventario: objetos sintonizados (máx. 3) | IMPLEMENTED | frontend/src/pages/InventoryTab.tsx:12,81-84 |
| FS-52 | Bio: tarjeta física (alineamiento, edad, altura, peso, ojos, piel, pelo) | IMPLEMENTED | physical traits card (age, height, weight, eyes, skin, hair). It uses the existing `characters.physical_description` column, so no migration was needed. frontend/src/pages/BiographyTab.tsx:78; internal/domain/character.go:137; internal/repository/character_repo.go:72; test internal/domain/physical_test.go — *corregido 2026-11-22* |
| FS-53 | Bio: rasgos de personalidad / ideales / vínculos / defectos | IMPLEMENTED | frontend/src/pages/BiographyTab.tsx:57-67 |
| FS-54 | Bio: historia autoexpandible con indicador de autoguardado | IMPLEMENTED | biography autosaves 1.5 s after the last edit; shows "Guardado a las HH:MM"; the backstory box grows with its text. frontend/src/pages/BiographyTab.tsx:41 — *corregido 2026-11-22* |
| FS-55 | Bio: notas adicionales | IMPLEMENTED | frontend/src/pages/BiographyTab.tsx:80-89 |
| FS-56 | Bio: botón Guardar | IMPLEMENTED | frontend/src/pages/BiographyTab.tsx:93-100 (al final del formulario, no fijo) |
| FS-57 | Bio: barra inferior Stats/Spells/Inventory/Bio | SUPERSEDED | frontend/src/components/character/CharacterTabs.tsx:13-25 |
| FS-58 | Intercambio: dos paneles (escritorio) / apilado (móvil) | IMPLEMENTED | frontend/src/pages/Trade.tsx:86-99 |
| FS-59 | Ofertante: avatar + nombre + personaje/nivel | IMPLEMENTED | pixel avatars for the offeror, the recipient and both sides of each offer. frontend/src/pages/Trade.tsx:27 — *corregido 2026-11-22* |
| FS-60 | Ofertante: oro a transferir + objetos seleccionados + añadir objeto | IMPLEMENTED | frontend/src/pages/Trade.tsx:77,89-90 |
| FS-61 | Destinatario: avatar + nombre + personaje/nivel | IMPLEMENTED | pixel avatars for the offeror, the recipient and both sides of each offer. frontend/src/pages/Trade.tsx:27 — *corregido 2026-11-22* |
| FS-62 | Destinatario: oro solicitado deshabilitado (0 por defecto) + objetos solicitados del destinatario | IMPLEMENTED | frontend/src/pages/Trade.tsx:63,95-97; cmd/server/main.go:167 |
| FS-63 | Pie: Cancelar + "Enviar Oferta" | IMPLEMENTED | a "Cancelar" button clears the new-offer form. frontend/src/pages/Trade.tsx:123 — *corregido 2026-11-22* |
| FS-64 | Insignia "Pendiente" con punto ámbar | IMPLEMENTED | frontend/src/pages/Trade.tsx:14-25,85 |
| FS-65 | Mensajería: bandeja + área de chat | IMPLEMENTED | frontend/src/pages/Messages.tsx:53-93 |
| FS-66 | Bandeja: buscador | IMPLEMENTED | Inbox search by name or last message (Messages.tsx:71) — *corregido 2026-11-22* |
| FS-67 | Bandeja: conversaciones con avatar, último mensaje, hora | IMPLEMENTED | Initials avatars in conversations and bubbles; delivery or read state on own bubbles (Messages.tsx:77,96-99) — *corregido 2026-11-22* |
| FS-68 | Bandeja: conversaciones con el DM con borde ámbar | IMPLEMENTED | frontend/src/pages/Messages.tsx:64-66 |
| FS-69 | Bandeja: contadores de no leídos | IMPLEMENTED | frontend/src/pages/Messages.tsx:66 |
| FS-70 | Chat: cabecera con destinatario + estado en línea | IMPLEMENTED | The chat header shows the name, a DM badge, and "En línea"/"Desconectado" from the new GET /campaigns/:id/presence (cmd/server/main.go:173; message_handler.go Presence; Messages.tsx:86) — *corregido 2026-11-22* |
| FS-71 | Chat: burbujas del DM en ámbar, del jugador en primario | IMPLEMENTED | frontend/src/pages/Messages.tsx:79-84 |
| FS-72 | Chat: mensaje especial "Tirada solicitada" con icono de dado | MISSING | frontend/src/types/index.ts:194 (solo gm_broadcast/gm_direct/player_direct) |
| FS-73 | Chat: redacción con enviar + acción rápida "Tirar dados" | PARTIAL | frontend/src/pages/Messages.tsx:89-92 (sin "Tirar dados") |
| FS-74 | Enter envía, Shift+Enter salto de línea | IMPLEMENTED | frontend/src/pages/Messages.tsx:90 |
| FS-75 | Mensajería: barra inferior Hub/Stats/Lore/Trade/Chat | SUPERSEDED | frontend/src/components/layout/BottomNav.tsx:10-25 |
| FS-76 | Oráculo: interfaz tipo chat a pantalla completa | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:71-119; frontend/src/components/layout/Layout.tsx:19 |
| FS-77 | Selector de ámbito: Mi Personaje / Trama / Lore Oculto (ámbar, solo GM) | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:16-20,48,79-86 |
| FS-78 | Burbujas de pregunta (derecha) y respuesta (izquierda) | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:96-99 |
| FS-79 | "Ver Fuentes (N)" expandible | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:102-106 |
| FS-80 | Indicador "Buscando en el lore..." con puntos animados | IMPLEMENTED | "Buscando en el lore…" text next to the typing dots. frontend/src/pages/LoreSearch.tsx:115 — *corregido 2026-11-22* |
| FS-81 | Fila de preguntas sugeridas encima de la entrada | IMPLEMENTED | suggestion chips stay visible above the input after the first question. frontend/src/pages/LoreSearch.tsx:119 — *corregido 2026-11-22* |
| FS-82 | Entrada + enviar; autoscroll a nuevos mensajes | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:54,114-117 |
| FS-83 | Mercado: búsqueda "Buscar objetos..." | IMPLEMENTED | frontend/src/components/market/ShopView.tsx:117 |
| FS-84 | Mercado: chips Todo/Armas/Armaduras/Pociones/Magia | IMPLEMENTED | category chips for the item types in stock. frontend/src/components/market/ShopView.tsx:123 — *corregido 2026-11-22* |
| FS-85 | Mercado: miniatura de imagen del objeto | MISSING | frontend/src/components/market/ShopView.tsx:128-139 |
| FS-86 | Mercado: nombre + rareza + tipo + precio en po | IMPLEMENTED | frontend/src/components/market/ShopView.tsx:131-135 |
| FS-87 | Mercado: botón "Comprar" inmediato | SUPERSEDED | openspec/specs/market-bastions.md:49; frontend/src/components/market/ShopView.tsx:140-146 (carrito + pedido) |
| FS-88 | Insignias de rareza por color (común, poco común verde, raro azul, muy raro, legendario) | IMPLEMENTED | rarity badges coloured with `rarityClass`. frontend/src/services/marketApi.ts:133 — *corregido 2026-11-22* |
| FS-89 | Mercado: barra inferior / lateral Sheet/Plot/Chat/Market/Inbox | SUPERSEDED | frontend/src/lib/nav.ts:6-17 |
| FS-90 | Ajustes: avatar editable + nombre + correo solo lectura | IMPLEMENTED | frontend/src/pages/SettingsPage.tsx:75-86 |
| FS-91 | Ajustes: cambiar contraseña + estado 2FA | IMPLEMENTED | frontend/src/pages/SettingsPage.tsx:88-110; cmd/server/main.go:154-157 |
| FS-92 | Ajustes: selector de tema claro/oscuro | IMPLEMENTED | frontend/src/pages/SettingsPage.tsx:112-125 |
| FS-93 | Ajustes: interruptores de notificaciones push y boletín por correo | MISSING | frontend/src/pages/SettingsPage.tsx:112-129 |
| FS-94 | Ajustes: zona de peligro "Eliminar cuenta" | MISSING | frontend/src/pages/SettingsPage.tsx:127-129; cmd/server/main.go:152-157 (sin endpoint) |
| FS-95 | Ajustes: "Guardar cambios" | IMPLEMENTED | frontend/src/pages/SettingsPage.tsx:85 (por sección) |
| FS-96 | Ajustes: barra inferior Hub/Stats/Profile/Lore | SUPERSEDED | frontend/src/components/layout/BottomNav.tsx:10-25 |
| FS-97 | Combate GM: tarjeta del turno actual con borde + "Turno actual" | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:50-52 |
| FS-98 | Combate: lista ordenada (iniciativa, nombre, Jugador/Enemigo, barra y texto de PV) | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:49-57 |
| FS-99 | Combate: "Añadir Combatiente" | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:62 |
| FS-100 | Contador "Ronda N" | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:47; frontend/src/pages/GMConsole.tsx:145 |
| FS-101 | Estado del grupo: avatar + clase + nivel + PV; borde rojo con PV bajo | IMPLEMENTED | frontend/src/pages/GMConsole.tsx:121-136 |
| FS-102 | "Añadir Jugador" al combate | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:34,63 |
| FS-103 | NPCs: rejilla con avatar, nombre, rol, estado | IMPLEMENTED | frontend/src/components/content/CampaignResourcePanel.tsx:105-122 |
| FS-104 | NPCs: Aliado verde / Enemigo rojo / Neutral gris | IMPLEMENTED | frontend/src/components/content/CampaignResourcePanel.tsx:15-19 |
| FS-105 | NPCs: "Añadir NPC" | IMPLEMENTED | frontend/src/components/content/CampaignResourcePanel.tsx:22,136 |
| FS-106 | NPCs: buscar/filtrar por nombre o estado | IMPLEMENTED | frontend/src/components/content/CampaignResourcePanel.tsx:100-103,140-145 |
| FS-107 | Detalle NPC en `/campaign/:campaignId/gm/npcs/:npcId` | IMPLEMENTED | frontend/src/App.tsx:102 |
| FS-108 | Detalle NPC: perfil (avatar grande, nombre, rol, estado) | IMPLEMENTED | frontend/src/pages/NPCDetail.tsx:67 |
| FS-109 | Detalle NPC: etiquetas de tipo/tamaño/VD | IMPLEMENTED | NPC type, size and CR tags, plus traits and actions cards, stored in the stats JSON and editable in the NPC editor. frontend/src/pages/NPCDetail.tsx:26 — *corregido 2026-11-22* |
| FS-110 | Detalle NPC: CA, PV, Velocidad y Percepción pasiva | IMPLEMENTED | NPC passive Perception (10 + WIS mod). frontend/src/pages/NPCDetail.tsx:90 — *corregido 2026-11-22* |
| FS-111 | Detalle NPC: rejilla 3×2 de características | IMPLEMENTED | frontend/src/pages/NPCDetail.tsx:69 |
| FS-112 | Detalle NPC: rasgos y acciones (nombre + descripción, insignias de impacto/CD) | IMPLEMENTED | NPC type, size and CR tags, plus traits and actions cards, stored in the stats JSON and editable in the NPC editor. frontend/src/pages/NPCDetail.tsx:26 — *corregido 2026-11-22* |
| FS-113 | Detalle NPC: lore y notas del DM | IMPLEMENTED | frontend/src/pages/NPCDetail.tsx:86 |
| FS-114 | Detalle NPC: "Añadir a Combate", Editar, Eliminar | IMPLEMENTED | frontend/src/pages/NPCDetail.tsx:93-98 |
| FS-115 | Bestiario: tarjetas con imagen, nombre, VD, tipo | PARTIAL | frontend/src/pages/Bestiary.tsx:150-185 (icono genérico en vez de imagen) |
| FS-116 | Bestiario: filtro por tipo | IMPLEMENTED | frontend/src/pages/Bestiary.tsx:108-122 |
| FS-117 | Bestiario: VD coloreado por amenaza | IMPLEMENTED | frontend/src/components/ui/CRBadge.tsx:8-19 |
| FS-118 | Ficha de criatura en `/campaign/:campaignId/gm/bestiary/:creatureId` | IMPLEMENTED | frontend/src/App.tsx:101 |
| FS-119 | Ficha: imagen (izq.), nombre + tipo en cursiva, CA y PV | PARTIAL | frontend/src/pages/CreatureDetail.tsx:133-158 (sin imagen) |
| FS-120 | Ficha: tamaño, CA, PV, velocidad | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:136-156 |
| FS-121 | Ficha: características 3→6 columnas con puntuación y modificador | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:161-169 |
| FS-122 | Ficha: dl con salvaciones, habilidades, resistencias/inmunidades, sentidos, idiomas, desafío | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:172-227 |
| FS-123 | Ficha: rasgos, acciones, acciones legendarias | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:230-282 |
| FS-124 | Ficha: "Add to Encounter" | IMPLEMENTED | frontend/src/pages/CreatureDetail.tsx:72-86,285-290 (añade al combate) |
| FS-125 | Galería de mapas: miniatura + nombre + ubicación | IMPLEMENTED | frontend/src/pages/MapGallery.tsx:4-9; frontend/src/components/content/CampaignResourcePanel.tsx:106-117 |
| FS-126 | Galería: "Nuevo mapa"; clic → detalle | IMPLEMENTED | frontend/src/pages/MapGallery.tsx:4; frontend/src/components/content/CampaignResourcePanel.tsx:114 |
| FS-127 | Detalle de mapa en `/gm/maps/:mapId`: imagen a ancho completo + nombre/ubicación | IMPLEMENTED | frontend/src/App.tsx:103; frontend/src/pages/MapDetail.tsx:96,104-105,126 |
| FS-128 | Mapa: zoom/desplazamiento con marcadores (primario/ámbar) | IMPLEMENTED | frontend/src/pages/MapDetail.tsx:40-75,108 |
| FS-129 | Mapa: controles flotantes de zoom + capas Cuadrícula/Niebla/Marcadores | IMPLEMENTED | frontend/src/pages/MapDetail.tsx:97-100,111-115 |
| FS-130 | Mapa: hoja inferior con lugar, descripción, Editar y puntos de interés | IMPLEMENTED | frontend/src/pages/MapDetail.tsx:117-133 |
| FS-131 | Mapa: acciones "Editar" / "Ajustes" del propio mapa | IMPLEMENTED | "Editar" in the map detail edits name, location, image URL and description. frontend/src/pages/MapDetail.tsx:134 — *corregido 2026-11-22* |
| FS-132 | Notas: editor separado del Oráculo | IMPLEMENTED | frontend/src/pages/CampaignNotes.tsx:3-8; frontend/src/components/content/CampaignResourcePanel.tsx:150-160 |
| FS-133 | Notas agrupadas por sesión/fecha | IMPLEMENTED | frontend/src/components/content/CampaignResourcePanel.tsx:125-131,146-147 |
| FS-134 | Notas: editor Markdown | IMPLEMENTED | frontend/src/components/content/CampaignResourcePanel.tsx:120,157; frontend/src/components/ui/Markdown.tsx |
| FS-135 | Notas visibles solo para el GM | IMPLEMENTED | CampaignResourceHandler.List is GM-only (internal/handler/campaign_resource_handler.go:55). Every screen that lists notes, events, NPCs and maps is behind GMGuard (App.tsx:92-98) or isGM (Marketplace ShopManager). Test: internal/handler/campaign_resource_list_test.go — *corregido 2026-11-22* |
| FS-136 | Calendario: vista mensual con marcadores de eventos | IMPLEMENTED | frontend/src/pages/EventsCalendar.tsx:68-87 |
| FS-137 | Evento: título, descripción, hora, NPCs/lugares relacionados | IMPLEMENTED | frontend/src/pages/EventsCalendar.tsx:92-101 |
| FS-138 | Calendario: "Añadir Evento" | IMPLEMENTED | frontend/src/pages/EventsCalendar.tsx:63,112-129 |
| FS-139 | Calendario solo GM | IMPLEMENTED | CampaignResourceHandler.List is GM-only (internal/handler/campaign_resource_handler.go:55). Every screen that lists notes, events, NPCs and maps is behind GMGuard (App.tsx:92-98) or isGM (Marketplace ShopManager). Test: internal/handler/campaign_resource_list_test.go — *corregido 2026-11-22* |
| FS-140 | Bot: interfaz de configuración + activar/desactivar | IMPLEMENTED | frontend/src/pages/BotManager.tsx:104-108; internal/handler/campaign_resource_handler.go:46-47 |
| FS-141 | Bot: editor del prompt de personalidad | IMPLEMENTED | frontend/src/pages/BotManager.tsx:110-116 |
| FS-142 | Bot: acciones auto-tiradas de NPC, reparto de botín, temporizadores | PARTIAL | frontend/src/pages/BotManager.tsx:11-16,120-129; internal/handler/bot_test_handler.go:25-27 (solo se guardan y se citan en la prueba; nada las ejecuta) |
| FS-143 | Bot: botón de prueba | IMPLEMENTED | frontend/src/pages/BotManager.tsx:31-66; internal/handler/campaign_resource_handler.go:48 |
| FS-144 | Lore: entradas ordenadas por capítulo | IMPLEMENTED | frontend/src/pages/LoreEditor.tsx:40-46,150 |
| FS-145 | Lore: editor título + contenido + visibilidad | IMPLEMENTED | frontend/src/pages/LoreEditor.tsx:183-218 |
| FS-146 | Lore: indicador de vectorización por entrada | IMPLEMENTED | frontend/src/pages/LoreEditor.tsx:155-157,179 |
| FS-147 | Lore: "Probar búsqueda" | IMPLEMENTED | frontend/src/pages/LoreEditor.tsx:87-113 |
| FS-148 | Lore: anotaciones del DM sobre trasfondos de personajes | IMPLEMENTED | frontend/src/pages/LoreEditor.tsx:14,201-211 |
| FS-149 | Encuentro del jugador en `/encounter`: ronda + indicador de su turno | IMPLEMENTED | frontend/src/App.tsx:100; frontend/src/components/content/CombatBoard.tsx:47; frontend/src/components/content/PlayerActions.tsx:39 |
| FS-150 | Encuentro: carrusel horizontal con turno activo resaltado y PV | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:36-58 |
| FS-151 | Encuentro: tarjeta de estado del personaje (avatar, PV/CA con barras, estado) | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:61,72 (tarjeta de estado: avatar, PV/CA con barra, chip Caído/Crítico/En pie) — *corregido 2026-11-22* |
| FS-152 | Encuentro: registro de combate con bordes de color | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:41-44,64 |
| FS-153 | Encuentro: pestañas Ataques/Hechizos/Objetos/Acciones | IMPLEMENTED | frontend/src/components/content/PlayerActions.tsx:9-10,40-45 |
| FS-154 | Flujo de pantallas: todas las rutas del resumen existen | IMPLEMENTED | frontend/src/App.tsx:66-104 |
| FS-155 | Responsive: navegación lateral (plegable) en escritorio, barra inferior en móvil | IMPLEMENTED | frontend/src/components/layout/Layout.tsx:17,34; SideNav.tsx:47; BottomNav.tsx:19 |
| FS-156 | Componente TopAppBar (título, conexión, avatar, ajustes) | IMPLEMENTED | frontend/src/components/layout/TopAppBar.tsx:24-54 |
| FS-157 | Componente BottomNav de 5 pestañas Sheet/Plot/Chat/Market/Inbox | SUPERSEDED | openspec/specs/design-system.md:21; frontend/src/components/layout/BottomNav.tsx:10-25 |
| FS-158 | Componente SideNav | IMPLEMENTED | frontend/src/components/layout/SideNav.tsx:44-88 |
| FS-159 | Componente CampaignCard (imagen, estado, nombre, descripción, DM/jugadores) | IMPLEMENTED | migration 030_campaign_cover.sql adds `campaigns.cover_url` (Up and Down tried on the test DB) Backend: create and update accept it, with ValidCoverURL (only "", /uploads/ or http(s)). internal/service/campaign_service.go:31; test internal/service/campaign_cover_test.go Campaign list shows the cover image. frontend/src/pages/CampaignList.tsx:82 Campaign creation takes a URL. frontend/src/pages/CreateCampaign.tsx:4… — *corregido 2026-11-22* |
| FS-160 | Componente CharacterAvatar (imagen o iniciales + insignia de nivel) | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:56-59; frontend/src/components/avatar/PixelAvatar.tsx |
| FS-161 | Componente HPBar con colores verde→ámbar→rojo | IMPLEMENTED | frontend/src/components/ui/HPBar.tsx:1-19 |
| FS-162 | Componente SpellSlotDots | IMPLEMENTED | frontend/src/pages/SpellsTab.tsx:48 |
| FS-163 | Componente ItemCard (nombre, tipo, rareza, precio, acción) | IMPLEMENTED | frontend/src/components/market/ShopView.tsx:128-146 |
| FS-164 | Componente ConversationRow (avatar, nombre, vista previa, hora, no leídos) | IMPLEMENTED | Initials avatars in conversations and bubbles; delivery or read state on own bubbles (Messages.tsx:77,96-99) — *corregido 2026-11-22* |
| FS-165 | Componente MessageBubble (avatar, contenido, hora, estado de entrega) | IMPLEMENTED | Initials avatars in conversations and bubbles; delivery or read state on own bubbles (Messages.tsx:77,96-99) — *corregido 2026-11-22* |
| FS-166 | Componente FilterChip | IMPLEMENTED | frontend/src/pages/Bestiary.tsx:108-139 |
| FS-167 | Componente ScopeSelector | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:79-86 |
| FS-168 | Componente InitiativeCard | IMPLEMENTED | frontend/src/components/content/CombatBoard.tsx:51-57 |
| FS-169 | Componente StatCard | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:67-80 |
| FS-170 | Componente AbilityScoreBadge (resaltado si es de lanzamiento) | IMPLEMENTED | frontend/src/pages/CharacterSheet.tsx:86-97 |
| FS-171 | Componente SkillRow (nombre, competencia, bono) | IMPLEMENTED | (racial part): 18-skill list, modifier = ability + racial proficiency, tap to roll. frontend/src/pages/CharacterSheet.tsx:102; frontend/src/lib/skills.ts. Class and background skill choices are not stored; that needs a product decision — *corregido 2026-11-22* |
| FS-172 | Componente FeatureCard (nivel, contador de usos) | PARTIAL | frontend/src/pages/FeaturesTab.tsx:63-71 |
| FS-173 | Componente D20FAB | IMPLEMENTED | frontend/src/components/layout/DiceRoller.tsx:39-42 |
| FS-174 | Componente Toast (success/error/info/trade/message) | IMPLEMENTED | global toasts for TRADE_* and MESSAGE_* events. The middleware payload now carries actor_id so a user is not notified of their own actions, and events replayed on reconnect do not pop up. frontend/src/components/layout/RealtimeToasts.tsx; frontend/src/components/layout/Layout.tsx:45; internal/realtime/middleware.go:54 — *corregido 2026-11-22* |
| FS-175 | Componente Modal | IMPLEMENTED | frontend/src/components/market/OfferDesk.tsx:54; frontend/src/components/content/CampaignResourcePanel.tsx:150 |
| FS-176 | Componente TradePanel (dos columnas, temporizador) | IMPLEMENTED | frontend/src/pages/Trade.tsx:36-44,86-102 |
| FS-177 | Componente RAGMessage | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:96-109 |
| FS-178 | Componente TypingIndicator | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:110 |
| FS-179 | Componente SuggestedPrompt | IMPLEMENTED | frontend/src/pages/LoreSearch.tsx:93 |
| FS-180 | Componente SourceEntry (icono de libro + título + tipo de fuente) | IMPLEMENTED | /lore/search returns source_details [{title,tier}] (lore_handler.go, domain.LoreSource). LoreSearch shows a book icon, the title and the tier label (LoreSearch.tsx:110) — *corregido 2026-11-22* |
| FS-181 | Toda vista no listada debe especificarse antes de implementarse | IMPLEMENTED | openspec/specs/frontend-screens.md:348 (secciones 21 Compendio y 22 Libro de conjuros del GM); frontend/src/pages/SRDSpellBrowser.tsx traducido al español — *corregido 2026-11-22* |

