import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Used on the server to build previews; keep them as plain Node packages.
  serverExternalPackages: ["sharp", "@coderline/alphatab", "pdfjs-dist", "@napi-rs/canvas"],
  // Local tabs (used when Google Drive isn't configured) are read from disk at runtime,
  // so ship them with the server functions.
  outputFileTracingIncludes: {
    "/*": ["./content/tabs/**/*"],
    "/**/*": ["./content/tabs/**/*"],
    // pdf.js is loaded from disk to draw PDF previews, along with its fonts.
    "/api/preview/*": [
      "./node_modules/pdfjs-dist/legacy/build/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
      "./node_modules/@napi-rs/**/*",
    ],
  },
};

export default nextConfig;
