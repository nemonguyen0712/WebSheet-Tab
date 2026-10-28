import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Left as plain packages for the Cloudflare build to resolve with its "workerd" conditions: Photon then loads
  // its WebAssembly as a module (Workers don't compile WebAssembly from bytes at runtime).
  serverExternalPackages: ["@coderline/alphatab", "@cf-wasm/photon"],
};

export default nextConfig;

// `next dev`: lets getCloudflareContext() work locally (bindings from wrangler.jsonc).
initOpenNextCloudflareForDev();
