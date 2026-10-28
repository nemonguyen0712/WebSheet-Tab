type Photon = typeof import("@cf-wasm/photon/node");
type PhotonImage = InstanceType<Photon["PhotonImage"]>;

/**
 * Photon has a build per runtime, so each runtime imports its own by name. The package's bare import would
 * give Workers the Node build, which compiles WebAssembly at runtime, and Workers forbid that; their build
 * ships the .wasm as a module. The Node build embeds 2 MB of WebAssembly that would only push the Worker past
 * its size limit, so Next leaves its import alone and, with the .catch, the Cloudflare bundler skips it too.
 */
let photon: Promise<Photon> | undefined;
function loadPhoton(): Promise<Photon> {
  const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
  return (photon ??= onWorkers
    ? import("@cf-wasm/photon/workerd")
    : import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@cf-wasm/photon/node").catch((err) => {
        throw err;
      }));
}

/**
 * The viewer's name stamped into a sheet picture, in WebAssembly (Photon), so it runs the same on Node and on
 * Cloudflare Workers. Pictures are capped at this width first: sharp enough to read a sheet, and a decoded
 * A4 page then takes ~15 MB instead of ~140 MB at the 600 dpi it's scanned at.
 */
export const MAX_PICTURE_WIDTH = 1600;

const ANGLE = -30;
const OPACITY = 0.18;

const GREY = 110;

/**
 * One slanted copy of the name on a transparent tile; it gets repeated over the picture. The text is drawn
 * solid, then its coverage is rotated here (bilinear, tight bounds; Photon's own rotate hollows the glyphs
 * out) and faded to OPACITY.
 */
function nameTile(p: Photon, text: string, size: number): { tile: PhotonImage; textWidth: number } {
  const textWidth = Math.ceil(text.length * size * 0.56);
  const w = textWidth + size;
  const h = Math.ceil(size * 1.5);
  const flat = new p.PhotonImage(new Uint8Array(w * h * 4), w, h);
  p.draw_text_with_color(flat, text, Math.round(size / 2), Math.round(size * 0.2), size, new p.Rgba(GREY, GREY, GREY, 255));
  const src = flat.get_raw_pixels();
  flat.free();

  const rad = (ANGLE * Math.PI) / 180;
  const [cos, sin] = [Math.cos(rad), Math.sin(rad)];
  const W = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin));
  const H = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos));
  const alphaAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Back from the tile pixel to the flat text (inverse rotation about both centres).
      const dx = x - W / 2;
      const dy = y - H / 2;
      const sx = dx * cos + dy * sin + w / 2;
      const sy = -dx * sin + dy * cos + h / 2;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const a =
        alphaAt(x0, y0) * (1 - fx) * (1 - fy) +
        alphaAt(x0 + 1, y0) * fx * (1 - fy) +
        alphaAt(x0, y0 + 1) * (1 - fx) * fy +
        alphaAt(x0 + 1, y0 + 1) * fx * fy;
      if (a <= 0) continue;
      const i = (y * W + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = GREY;
      out[i + 3] = Math.round(a * OPACITY);
    }
  }
  return { tile: new p.PhotonImage(out, W, H), textWidth };
}

/** Transparent parts of a PNG would turn black in the JPEG: lay the picture on white paper. */
function onWhite(p: Photon, img: PhotonImage): PhotonImage {
  const px = img.get_raw_pixels();
  let changed = false;
  for (let i = 3; i < px.length; i += 4) {
    const a = px[i];
    if (a === 255) continue;
    changed = true;
    const k = a / 255;
    px[i - 3] = Math.round(px[i - 3] * k + 255 * (1 - k));
    px[i - 2] = Math.round(px[i - 2] * k + 255 * (1 - k));
    px[i - 1] = Math.round(px[i - 1] * k + 255 * (1 - k));
    px[i] = 255;
  }
  if (!changed) return img;
  const opaque = new p.PhotonImage(px, img.get_width(), img.get_height());
  img.free();
  return opaque;
}

/** Decodes, shrinks to MAX_PICTURE_WIDTH if wider, tiles the name diagonally over it and returns a JPEG. */
export async function stampPicture(picture: Uint8Array, text: string): Promise<Uint8Array> {
  const p = await loadPhoton();
  let img = p.PhotonImage.new_from_byteslice(picture);
  if (img.get_width() > MAX_PICTURE_WIDTH) {
    const height = Math.round((img.get_height() * MAX_PICTURE_WIDTH) / img.get_width());
    const smaller = p.resize(img, MAX_PICTURE_WIDTH, height, p.SamplingFilter.Triangle);
    img.free();
    img = smaller;
  }
  img = onWhite(p, img);

  const width = img.get_width();
  const height = img.get_height();
  const size = Math.max(14, Math.round(width / 40));
  const { tile, textWidth } = nameTile(p, text, size);
  // A lattice along the slant, spaced like the PDF stamp: name + 5 em along the line, 7 em between lines.
  const rad = (ANGLE * Math.PI) / 180;
  const along = [Math.cos(rad) * (textWidth + size * 5), Math.sin(rad) * (textWidth + size * 5)];
  const across = [-Math.sin(rad) * size * 7, Math.cos(rad) * size * 7];
  const reach = Math.ceil(Math.hypot(width, height) / Math.min(textWidth + size * 5, size * 7)) + 1;
  const [tw, th] = [tile.get_width(), tile.get_height()];
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) {
      const cx = width / 2 + i * along[0] + j * across[0];
      const cy = height / 2 + i * along[1] + j * across[1];
      if (cx < -tw / 2 || cy < -th / 2 || cx > width + tw / 2 || cy > height + th / 2) continue;
      p.watermark(img, tile, BigInt(Math.round(cx - tw / 2)), BigInt(Math.round(cy - th / 2)));
    }
  }
  tile.free();

  const jpeg = img.get_bytes_jpeg(85);
  img.free();
  return jpeg;
}
