/**
 * Soft background behind every page: a pre-blurred olive grove landscape (public/ambient.webp —
 * "a grove of olive trees in a field with mountains in the background", Unsplash, free licence:
 * https://unsplash.com/photos/a-grove-of-olive-trees-in-a-field-with-mountains-in-the-background-M6jXE5-WLKA),
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
