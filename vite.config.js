import { defineConfig } from "vite";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
const packageVersion = packageJson.version;

function syncManifestVersion() {
  return {
    name: "sync-manifest-version",
    closeBundle() {
      const manifestPath = resolve(rootDir, "dist", "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.version = packageVersion;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const codexMarkerPath = resolve(rootDir, "dist", ".codex");
      if (existsSync(codexMarkerPath)) {
        try {
          unlinkSync(codexMarkerPath);
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "EBUSY") {
            console.warn("Skipping locked dist/.codex cleanup");
          } else {
            throw error;
          }
        }
      }
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [syncManifestVersion()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
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
