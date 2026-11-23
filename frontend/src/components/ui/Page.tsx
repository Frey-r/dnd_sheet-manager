export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6"><div><h1 className="font-headline-lg text-on-surface">{title}</h1>{description && <p className="mt-1 text-on-surface-variant">{description}</p>}</div>{actions && <div className="flex gap-2">{actions}</div>}</div>;
}
export function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return <section className={`bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 ${className}`}>{title && <h2 className="font-headline-md text-on-surface mb-4">{title}</h2>}{children}</section>;
}
