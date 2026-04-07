import { defineConfig } from "vite";
import { resolve } from "node:path";

const rootDir = process.cwd();

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(rootDir, "popup.html"),
        background: resolve(rootDir, "src/background.ts")
      },
      output: {
        entryFileNames(chunk) {
          return chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js";
        }
      }
    }
  }
});
