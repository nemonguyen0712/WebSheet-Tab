export function ViewerError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-muted">{children}</div>
  );
}
