import { GlobalFonts, createCanvas } from "@napi-rs/canvas";
import path from "path";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import sharp from "sharp";

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

let fontReady = false;
function ensureFont() {
  if (fontReady) return;
  // Ships with pdf.js (SIL Open Font License); servers often have no system fonts at all.
  GlobalFonts.registerFromPath(
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts", "LiberationSans-Regular.ttf"),
    "StampSans",
  );
  fontReady = true;
}

/** Large photos are scaled down to this width: sharp enough for reading, small enough to send quickly. */
const MAX_IMAGE_WIDTH = 2400;

// The server has 512 MB: no pixel cache, one libvips thread per image.
sharp.cache(false);
sharp.concurrency(1);

/**
 * One copy of the slanted name on a transparent square, repeated over the image by sharp. Only this small
 * tile goes through canvas; the image itself stays in libvips, which works in strips instead of holding
 * whole decoded copies (a long 2400 px sheet used to cost ~300 MB here).
 */
function stampTile(text: string, size: number): Buffer {
  ensureFont();
  const measure = createCanvas(1, 1).getContext("2d");
  measure.font = `${size}px StampSans`;
  const textWidth = measure.measureText(text).width;
  const rad = (ANGLE * Math.PI) / 180;
  const w = Math.ceil(Math.abs(textWidth * Math.cos(rad)) + Math.abs(size * Math.sin(rad)) + size * 5);
  const h = Math.ceil(Math.abs(textWidth * Math.sin(rad)) + Math.abs(size * Math.cos(rad)) + size * 4);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.font = `${size}px StampSans`;
  ctx.fillStyle = `rgba(110, 110, 110, ${OPACITY + 0.04})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.fillText(text, 0, 0);
  return canvas.toBuffer("image/png");
}

export async function stampImage(bytes: Uint8Array, stamp: Stamp): Promise<{ data: Uint8Array; type: string }> {
  // Width of the picture actually sent (after EXIF rotation and shrinking), to size the name for it.
  const meta = await sharp(bytes).metadata();
  const sideways = (meta.orientation ?? 1) >= 5;
  const width = Math.min(MAX_IMAGE_WIDTH, (sideways ? meta.height : meta.width) ?? MAX_IMAGE_WIDTH);
  const size = Math.max(14, Math.round(width / 40));

  // One pipeline, so no decoded copy of the whole image is ever kept around; composite runs last.
  const data = await sharp(bytes)
    .rotate()
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // transparent PNGs get a white page
    .composite([{ input: stampTile(stamp.text, size), tile: true, blend: "over" }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return { data, type: "image/jpeg" };
}

/** Guitar Pro / MusicXML / alphaTex: name in the score's copyright line (drawn on the sheet), re-exported as Guitar Pro 7. */
export async function stampNotation(bytes: Uint8Array, stamp: Stamp): Promise<Uint8Array> {
  const alphaTab = await import("@coderline/alphatab");
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
  score.copyright = `Bản cấp cho ${stamp.text}`;
  score.notices = [score.notices, `uid:${stamp.userId}`].filter(Boolean).join("\n");
  return new alphaTab.exporter.Gp7Exporter().export(score, settings);
}
