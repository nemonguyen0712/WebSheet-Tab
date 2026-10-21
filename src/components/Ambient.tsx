/**
 * Background behind every page: an olive grove landscape, colour-mapped to the site palette
 * (forest green → olive → cream) and only lightly blurred (public/ambient.webp —
 * "a grove of olive trees in a field with mountains in the background", Unsplash, free licence:
 * https://unsplash.com/photos/a-grove-of-olive-trees-in-a-field-with-mountains-in-the-background-M6jXE5-WLKA),
 * under a 20% cream wash, with green glows that tie into the dark
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
