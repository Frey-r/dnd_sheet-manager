export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return <div role="status" className="p-8 text-center text-on-surface-variant">{label}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="p-4 rounded-lg bg-error-container text-on-error-container flex items-center justify-between gap-4"><span>{message}</span>{onRetry && <button type="button" onClick={onRetry} className="font-label-bold underline">Reintentar</button>}</div>;
}
export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="p-8 text-center border border-dashed border-border-low-contrast rounded-lg"><p className="text-on-surface-variant">{title}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
