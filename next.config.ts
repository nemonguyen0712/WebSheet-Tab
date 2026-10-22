import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Used on the server to stamp the viewer's name into files; keep them as plain Node packages.
  serverExternalPackages: ["sharp", "@coderline/alphatab", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    // The stamp font (borrowed from pdf.js) and the canvas binary, both read from disk.
    "/api/file/*": ["./node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf", "./node_modules/@napi-rs/**/*"],
  },
};

export default nextConfig;
