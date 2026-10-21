/**
 * Background behind every page: the Oliu "Tab & Sheet" brand image (public/ambient.webp —
 * olive branch, guitar and sheet music on dark stone), under a 20% cream wash, with green
 * glows that tie into the dark header strip and footer.
 * Fixed, behind content, and ignores the pointer.
 */
export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-photo absolute inset-0" />
      <div className="ambient-wash absolute inset-0" />
      <div className="ambient-glow absolute inset-0" />
    </div>
  );
}
