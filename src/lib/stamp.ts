import { GlobalFonts, createCanvas, loadImage } from "@napi-rs/canvas";
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

export async function stampImage(bytes: Uint8Array, stamp: Stamp): Promise<{ data: Uint8Array; type: string }> {
  ensureFont();
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white page
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(await loadImage(data), 0, 0);

  const size = Math.max(14, Math.round(width / 40));
  ctx.font = `${size}px StampSans`;
  ctx.fillStyle = `rgba(110, 110, 110, ${OPACITY + 0.04})`;
  const textWidth = ctx.measureText(stamp.text).width;
  ctx.translate(width / 2, height / 2);
  ctx.rotate((ANGLE * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);
  tile(width, height, textWidth, size, (x, y) => ctx.fillText(stamp.text, x, y));

  return { data: await canvas.encode("jpeg", 88), type: "image/jpeg" };
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
