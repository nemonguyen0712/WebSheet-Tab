import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * OLIU_LITE=1: a build small enough for the Cloudflare Workers Free plan (3 MB compressed), to try the site
 * before paying for Workers Paid. alphaTab is left out, so Guitar Pro files are sent without the viewer's name
 * inside them (the on-screen watermark stays). Pictures and PDFs are stamped as usual.
 */
const lite = process.env.OLIU_LITE === "1";

const nextConfig: NextConfig = {
  env: { OLIU_LITE: lite ? "1" : "" },
  // Not bundled by Next: the Cloudflare build then packs Photon's Workers build with its .wasm as a module
  // (see src/lib/stamp-picture.ts), and alphaTab loads only when a Guitar Pro file is stamped.
  serverExternalPackages: lite ? ["@cf-wasm/photon"] : ["@coderline/alphatab", "@cf-wasm/photon"],
  ...(lite && { turbopack: { resolveAlias: { "@coderline/alphatab": "./src/lib/alphatab-lite.ts" } } }),
};

export default nextConfig;

// `next dev`: lets getCloudflareContext() work locally (bindings from wrangler.jsonc).
initOpenNextCloudflareForDev();
