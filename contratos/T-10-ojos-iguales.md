# T-10 · Ojos iguales (diseño del ojo derecho)

- **Origen:** E-0016 (pedido del usuario). **Decisión:** D-0033. **Spec:** `character-appearance.md` § Face.
- **Célula:** `sprite`. **Bloqueada por:** T-9.

## Alcance

`frontend/src/lib/avatar/sprites/body.ts` (`drawFace` y ojos de cabezas no humanas) y, si alguna parte dibuja ojos,
`sprites/features.ts`. Cambio de arte: el golden se regenera con `UPDATE_GOLDEN=1` **después** de la aprobación visual del
revisor (D-0026); esa regeneración se registra como decisión.

## Criterios de aceptación (`frontend/src/lib/avatar/__tests__/sprite-eyes.test.ts`, entorno node)

1. **E1 Mismo tamaño:** en humanos (complexiones 0 y 1, tallas S, D, M, L) y en toda familia con dos ojos visibles,
   `eyes[0].w === eyes[1].w` y `eyes[0].h === eyes[1].h`.
2. **E2 Mismo diseño:** el patrón de colores de los dos ojos es idéntico píxel a píxel en coordenadas relativas a su caja
   (pestaña, iris, brillo), con cualquier color de ojos de `EYES`.
3. **E3 Diseño del ojo derecho:** el patrón común es el del ojo derecho anterior: 2 × 3 con la fila superior en el tono
   más oscuro, el iris en la rampa del color de ojos y exactamente un píxel de brillo (el más claro del ojo).
4. **E4 Invariantes:** C4 de T-1 (ojos 1–2 × 2–3, separación 2–4, mitad inferior de la cabeza) y H4 de T-2 (el pelo no
   tapa los ojos) siguen en verde.
