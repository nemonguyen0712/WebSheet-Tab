export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-accent-soft">
      <div className="h-full w-full origin-left animate-pulse bg-accent" />
    </div>
  );
}
