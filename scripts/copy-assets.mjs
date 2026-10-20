// Copies runtime assets for pdf.js and alphaTab from node_modules into public/,
// so they're served as plain static files (workers, fonts, soundfont). Runs on `npm install`.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (p) => join(root, "node_modules", p);
const pub = (p) => join(root, "public", p);

function copy(from, to, filter) {
  if (!existsSync(from)) {
    console.warn(`[copy-assets] missing ${from}`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, filter });
}

rmSync(pub("pdfjs"), { recursive: true, force: true });
copy(nm("pdfjs-dist/build/pdf.worker.min.mjs"), pub("pdfjs/pdf.worker.min.mjs"));
copy(nm("pdfjs-dist/cmaps"), pub("pdfjs/cmaps"));
copy(nm("pdfjs-dist/standard_fonts"), pub("pdfjs/standard_fonts"));
copy(nm("pdfjs-dist/wasm"), pub("pdfjs/wasm"), (src) => !/LICENSE/.test(src));
copy(nm("pdfjs-dist/iccs"), pub("pdfjs/iccs"), (src) => !/LICENSE/.test(src));

rmSync(pub("alphatab"), { recursive: true, force: true });
copy(nm("@coderline/alphatab/dist/alphaTab.min.js"), pub("alphatab/alphaTab.min.js"));
copy(nm("@coderline/alphatab/dist/font"), pub("alphatab/font"), (src) => !/\.(svg|eot)$/.test(src));
copy(nm("@coderline/alphatab/dist/soundfont/sonivox.sf2"), pub("alphatab/soundfont/sonivox.sf2"));

console.log("[copy-assets] pdf.js + alphaTab assets copied to public/");
