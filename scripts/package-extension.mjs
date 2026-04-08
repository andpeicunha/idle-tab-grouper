import { mkdtempSync, cpSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const distDir = resolve(rootDir, "dist");
const outputZip = resolve(rootDir, "idle-tab-grouper.zip");

if (!existsSync(distDir)) {
  console.error("dist/ não existe. Rode `npm run build` antes de empacotar.");
  process.exit(1);
}

const stagingDir = mkdtempSync(join(tmpdir(), "idle-tab-grouper-package-"));
const extensionDir = join(stagingDir, "idle-tab-grouper");

try {
  cpSync(distDir, extensionDir, {
    recursive: true
  });

  rmSync(join(extensionDir, ".codex"), {
    force: true
  });

  rmSync(outputZip, {
    force: true
  });

  execFileSync("zip", ["-rq", outputZip, "."], {
    cwd: extensionDir,
    stdio: "inherit"
  });

  console.log(`Pacote gerado em ${outputZip}`);
} finally {
  rmSync(stagingDir, {
    recursive: true,
    force: true
  });
}
