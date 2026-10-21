/**
 * Soft background behind every page: a pre-blurred guitar photo (public/ambient.webp —
 * "brown acoustic guitar on brown wooden floor", Unsplash, free licence:
 * https://unsplash.com/photos/brown-acoustic-guitar-on-brown-wooden-floor-mRV23Xtq42A),
 * washed with cream so content stays readable, and green glows that tie into the dark
 * header strip and footer. Fixed, behind content, and ignores the pointer.
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
