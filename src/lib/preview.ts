import path from "path";
import { pathToFileURL } from "url";
import sharp from "sharp";

/** Share of the sheet shown clearly to visitors who haven't subscribed. */
export const PREVIEW_FRACTION = 1 / 3;

/**
 * Top third of the page as-is, the rest shrunk to a few pixels and blurred, so the hidden part
 * is destroyed on the server — not just covered with CSS that could be removed.
 */
export async function blurredPreview(image: Uint8Array): Promise<Buffer> {
  const { data, info } = await sharp(image)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1000, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const clearHeight = Math.max(1, Math.round(height * PREVIEW_FRACTION));

  const clear = await sharp(data).extract({ left: 0, top: 0, width, height: clearHeight }).toBuffer();
  const tiny = await sharp(data).resize({ width: Math.max(8, Math.round(width / 24)) }).toBuffer();
  const blurred = await sharp(tiny).resize({ width, height, fit: "fill" }).blur(8).toBuffer();
  return sharp(blurred)
    .composite([{ input: clear, top: 0, left: 0 }])
    .jpeg({ quality: 75 })
    .toBuffer();
}

const PDFJS_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist");
/** pdf.js wants data folders as paths ending in "/", even on Windows. */
const pdfjsFolder = (name: string) => path.join(PDFJS_DIR, name).split(path.sep).join("/") + "/";

/** First page of a PDF as a 1000px-wide PNG, drawn on the server with pdf.js. */
export async function renderPdfFirstPage(bytes: Uint8Array): Promise<Uint8Array> {
  const pdfjs = await import(
    /* turbopackIgnore: true */ /* webpackIgnore: true */ pathToFileURL(path.join(PDFJS_DIR, "legacy/build/pdf.mjs")).href
  );
  const task = pdfjs.getDocument({
    data: bytes,
    standardFontDataUrl: pdfjsFolder("standard_fonts"),
    cMapUrl: pdfjsFolder("cmaps"),
    cMapPacked: true,
    isEvalSupported: false,
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1000 / page.getViewport({ scale: 1 }).width });
    const { canvas } = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas, viewport }).promise;
    return canvas.toBuffer("image/png");
  } finally {
    await task.destroy();
  }
}

/** First third of the bars of a Guitar Pro / MusicXML / alphaTex file, re-exported as Guitar Pro 7. */
export async function trimmedNotation(bytes: Uint8Array): Promise<Uint8Array> {
  const alphaTab = await import("@coderline/alphatab");
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
  const keep = Math.max(2, Math.ceil(score.masterBars.length * PREVIEW_FRACTION));
  if (keep < score.masterBars.length) {
    score.masterBars.splice(keep);
    for (const track of score.tracks) for (const staff of track.staves) staff.bars.splice(keep);
    score.finish(settings);
  }
  return new alphaTab.exporter.Gp7Exporter().export(score, settings);
}

/** First third of the lines of a text tab. */
export function trimmedText(text: string): { lines: string[]; hiddenLines: number } {
  const all = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const keep = Math.max(3, Math.ceil(all.length * PREVIEW_FRACTION));
  return { lines: all.slice(0, keep), hiddenLines: Math.max(0, all.length - keep) };
}
