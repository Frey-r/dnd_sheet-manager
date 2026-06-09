interface TopAppBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  campaignName?: string;
  connected?: boolean;
  children?: React.ReactNode;
}

export function TopAppBar({
  title = 'Campaign Master',
  showBack = false,
  onBack,
  rightElement,
  campaignName,
  connected = true,
  children,
}: TopAppBarProps) {
  return (
    <header className="flex justify-between items-center px-4 h-16 bg-surface border-b border-border-low-contrast sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl">swords</span>
          <div className="flex flex-col">
            <span className="font-headline-md text-primary font-bold tracking-tight hidden sm:block">
              {title}
            </span>
            {campaignName && (
              <span className="font-headline-md text-primary font-bold tracking-tight sm:hidden">
                {campaignName}
              </span>
            )}
          </div>
        </div>
        {children}
      </div>
      <div className="flex items-center gap-3">
        {connected && (
          <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full border border-border-low-contrast">
            <div className="w-2 h-2 rounded-full bg-success-active animate-pulse" />
            <span className="font-label-bold text-label-bold text-on-surface text-xs">Connected</span>
          </div>
        )}
        {rightElement || (
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-secondary-container">person</span>
          </div>
        )}
      </div>
    </header>
  );
}
