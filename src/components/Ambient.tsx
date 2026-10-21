/**
 * Background behind every page: the Oliu "Tab & Sheet" brand image (public/ambient.webp —
 * olive branch, guitar and sheet music on dark stone), shown as-is, without any wash or blur.
 * Fixed, behind content, and ignores the pointer.
 */
export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-photo absolute inset-0" />
    </div>
  );
}
