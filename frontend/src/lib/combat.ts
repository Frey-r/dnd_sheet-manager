/** Índice del combatiente activo; el turno del servidor puede exceder la longitud de la lista. */
export function activeCombatantIndex(turn: number | undefined, length: number): number {
  return length > 0 ? ((turn ?? 0) % length + length) % length : -1;
}
