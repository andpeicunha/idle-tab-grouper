import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, "public", "icons");
const sourceSvg = resolve(rootDir, "assets", "tab-grouper.svg");

mkdirSync(outputDir, { recursive: true });
copyFileSync(sourceSvg, resolve(outputDir, "icon.svg"));

const tempDir = mkdtempSync(join(tmpdir(), "idle-tab-grouper-icons-"));

try {
  for (const size of [16, 48, 128]) {
    const htmlPath = resolve(tempDir, `icon-${size}.html`);
    const pngPath = resolve(outputDir, `icon-${size}.png`);

    writeFileSync(htmlPath, createPreviewHtml(size, sourceSvg));

    execFileSync(
      "/usr/bin/google-chrome",
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        `--window-size=${size},${size}`,
        `--screenshot=${pngPath}`,
        `file://${htmlPath}`,
      ],
      { stdio: "pipe" },
    );
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function createPreviewHtml(size, svgPath) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: ${size}px;
        height: ${size}px;
        overflow: hidden;
        background: transparent;
      }

      img {
        display: block;
        width: ${size}px;
        height: ${size}px;
      }
    </style>
  </head>
  <body>
    <img src="file://${svgPath}" alt="Idle Tab Grouper icon" />
  </body>
</html>`;
}
