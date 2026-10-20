/**
 * Faint repeated email over a sheet, so screenshots that get passed around show who shared them.
 */
export function Watermark({ text }: { text: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><text x="160" y="100" text-anchor="middle" transform="rotate(-24 160 100)" font-family="sans-serif" font-size="15" fill="rgba(120,120,120,0.16)">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</text></svg>`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] select-none"
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` }}
    />
  );
}

/** Light deterrents against saving a sheet: no right-click menu, no dragging images out. */
export const noSaveProps = {
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  onDragStart: (e: React.DragEvent) => e.preventDefault(),
};
