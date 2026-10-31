// Copies runtime assets for pdf.js and alphaTab from node_modules into public/,
// so they're served as plain static files (workers, fonts, soundfont). Runs on `npm install`.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// Polyfill Promise.withResolvers for Safari < 17.4 and older WebKit engines
const WITH_RESOLVERS_POLYFILL =
  "if(!Promise.withResolvers){Promise.withResolvers=function(){var a,b,c=new Promise(function(d,e){a=d;b=e});return{promise:c,resolve:a,reject:b}}};\n";

function copyWithPolyfill(from, to) {
  if (!existsSync(from)) {
    console.warn(`[copy-assets] missing ${from}`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  const content = readFileSync(from, "utf8");
  writeFileSync(to, WITH_RESOLVERS_POLYFILL + content, "utf8");
}

rmSync(pub("pdfjs"), { recursive: true, force: true });
// Use legacy build for maximum Safari / iOS WebKit compatibility (no module worker restrictions)
copyWithPolyfill(nm("pdfjs-dist/legacy/build/pdf.min.mjs"), pub("pdfjs/pdf.min.mjs"));
copyWithPolyfill(nm("pdfjs-dist/legacy/build/pdf.worker.min.mjs"), pub("pdfjs/pdf.worker.min.mjs"));
copy(nm("pdfjs-dist/cmaps"), pub("pdfjs/cmaps"));
copy(nm("pdfjs-dist/standard_fonts"), pub("pdfjs/standard_fonts"));
copy(nm("pdfjs-dist/wasm"), pub("pdfjs/wasm"), (src) => !/LICENSE/.test(src));
copy(nm("pdfjs-dist/iccs"), pub("pdfjs/iccs"), (src) => !/LICENSE/.test(src));

rmSync(pub("alphatab"), { recursive: true, force: true });
copy(nm("@coderline/alphatab/dist/alphaTab.min.js"), pub("alphatab/alphaTab.min.js"));
copy(nm("@coderline/alphatab/dist/font"), pub("alphatab/font"), (src) => !/\.(svg|eot)$/.test(src));
copy(nm("@coderline/alphatab/dist/soundfont/sonivox.sf2"), pub("alphatab/soundfont/sonivox.sf2"));

console.log("[copy-assets] pdf.js + alphaTab assets copied to public/");
