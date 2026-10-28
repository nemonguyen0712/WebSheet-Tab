import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { MAX_PICTURE_WIDTH, stampPicture } from "./stamp-picture";

/**
 * Puts the viewer's name inside the file itself (not just on screen), so a sheet saved from
 * the browser and passed around still shows who it was issued to.
 */
export interface Stamp {
  /** Shown on the sheet, e.g. "nam.guitar · 0901 234 567". */
  text: string;
  /** Hidden in the file's metadata. */
  userId: string;
}

const ANGLE = -30;
const OPACITY = 0.14;

/** Repeats the text diagonally across a width × height area; `draw` places one copy. */
function tile(width: number, height: number, textWidth: number, size: number, draw: (x: number, y: number) => void) {
  const stepX = textWidth + size * 5;
  const stepY = size * 7;
  for (let y = -height * 0.5; y < height * 1.5; y += stepY) {
    for (let x = -width * 0.5; x < width * 1.5; x += stepX) draw(x, y);
  }
}

export async function stampPdf(bytes: Uint8Array, stamp: Stamp): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(9, width / 45);
    tile(width, height, font.widthOfTextAtSize(stamp.text, size), size, (x, y) =>
      page.drawText(stamp.text, { x, y, size, font, color: rgb(0.45, 0.45, 0.45), opacity: OPACITY, rotate: degrees(-ANGLE) }),
    );
  }
  doc.setSubject(`Cấp cho ${stamp.text}`);
  doc.setKeywords([`uid:${stamp.userId}`]);
  return doc.save();
}

/** The parts of Cloudflare's Images binding used here (see wrangler.jsonc, "images"). */
interface ImagesBinding {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; fit: "scale-down" }): {
      output(options: { format: "image/png" }): Promise<{ response(): Response }>;
    };
  };
}

/** Cloudflare's Images binding when running on Workers; null on Node (local dev). */
async function imagesBinding(): Promise<ImagesBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return (getCloudflareContext().env as { IMAGES?: ImagesBinding }).IMAGES ?? null;
  } catch {
    return null;
  }
}

/**
 * Sheet pictures are scanned at 600 dpi (4960 × 7015 px): ~140 MB once decoded, more than a Worker's
 * 128 MB. On Cloudflare, the Images service scales them down to MAX_PICTURE_WIDTH outside the Worker,
 * and the result is kept in the data centre's cache, so each picture is scaled once (per file version),
 * not per view. On Node the picture is decoded whole, which is fine there.
 */
async function pictureToStamp(bytes: Uint8Array, key: string): Promise<Uint8Array> {
  const images = await imagesBinding();
  if (!images) return bytes;
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = `https://picture-cache.oliu/${encodeURIComponent(key)}/${MAX_PICTURE_WIDTH}`;
  const hit = await cache?.match(cacheKey);
  if (hit) return new Uint8Array(await hit.arrayBuffer());

  const stream = new Response(new Uint8Array(bytes)).body!;
  const result = await images.input(stream).transform({ width: MAX_PICTURE_WIDTH, fit: "scale-down" }).output({ format: "image/png" });
  const smaller = new Uint8Array(await result.response().arrayBuffer());
  await cache?.put(
    cacheKey,
    new Response(smaller, { headers: { "content-type": "image/png", "cache-control": "public, max-age=2592000" } }),
  );
  return smaller;
}

/** `key` names this version of the picture (file id + modified time) for the scaled-down cache. */
export async function stampImage(bytes: Uint8Array, stamp: Stamp, key: string): Promise<{ data: Uint8Array; type: string }> {
  const picture = await pictureToStamp(bytes, key);
  return { data: await stampPicture(picture, stamp.text), type: "image/jpeg" };
}

/** Guitar Pro / MusicXML / alphaTex: name in the score's copyright line (drawn on the sheet), re-exported as Guitar Pro 7. */
export async function stampNotation(bytes: Uint8Array, stamp: Stamp): Promise<Uint8Array> {
  // Lite build (Workers Free plan): sent as uploaded, see next.config.ts.
  if (process.env.OLIU_LITE === "1") return bytes;
  const alphaTab = await import("@coderline/alphatab");
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
  score.copyright = `Bản cấp cho ${stamp.text}`;
  score.notices = [score.notices, `uid:${stamp.userId}`].filter(Boolean).join("\n");
  return new alphaTab.exporter.Gp7Exporter().export(score, settings);
}
