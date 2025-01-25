import path from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  root: path.join(__dirname),
  build: {
    outDir: path.join(__dirname, "./static/"),
    manifest: "manifest.json",
    rollupOptions: {
      input: [
        "src/js/app.js",
        "src/css/app.css",
        "src/fonts/shine_bubble.ttf",
      ],
      output: {
        entryFileNames: `dist/[name].js`,
        chunkFileNames: `dist/[name].js`,
        assetFileNames: `dist/[name].[ext]`
      }
    },
    emptyOutDir: false,
    copyPublicDir: false,
  },
});