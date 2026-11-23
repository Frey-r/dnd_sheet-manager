/**
 * Notice for Foundry-mode campaigns: inventory is a read-only mirror of Foundry, so market and
 * trade changes made here are bookkeeping only (foundry-integration.md, unidirectional sync).
 */
export function FoundryAuthorityNotice({ isFoundry }: { isFoundry: boolean }) {
  if (!isFoundry) return null;
  return (
    <p role="note" className="flex items-start gap-2 rounded-lg border border-info/40 bg-info-soft px-4 py-3 text-sm text-info">
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">sync_lock</span>
      <span>Campaña Foundry: el inventario oficial vive en Foundry. Los cambios hechos aquí (compras, ventas o intercambios) son solo un registro de la app y la próxima sincronización los sobrescribe.</span>
    </p>
  );
}
