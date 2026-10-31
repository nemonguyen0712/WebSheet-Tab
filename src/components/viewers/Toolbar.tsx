export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-border/70 bg-bg/80 px-4 py-2 text-sm backdrop-blur-md">
      {children}
    </div>
  );
}

export function ToolGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
      {label && <span className="px-1.5 text-muted">{label}</span>}
      {children}
    </div>
  );
}

export function ToolButton({
  onClick,
  children,
  label,
  active,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-2 cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-accent text-accent-fg font-medium" : "hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
