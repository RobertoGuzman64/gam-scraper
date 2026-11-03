import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

type CatalogCommand = "catalogo:preparar" | "catalogo:acreditar" | "catalogo:publicar";

export const createToolingTestWorkspace = (command: CatalogCommand, prefix: string) => {
  const workspace = mkdtempSync(join(tmpdir(), prefix));
  try {
    mkdirSync(join(workspace, "scripts"));
    mkdirSync(join(workspace, "dist", "cli", "commands", "catalog"), { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({
      name: "equipzilla-test", type: "module",
      scripts: { [command]: `node scripts/tooling.mjs ${command}` }
    }));
    for (const name of ["tooling.mjs", "terminal.mjs", "build-cache.mjs"]) {
      copyFileSync(join(root, "scripts", name), join(workspace, "scripts", name));
    }
    writeFileSync(join(workspace, "scripts", "run-build.mjs"), "process.exitCode = 0;\n");
    const entry = command === "catalogo:preparar" ? "prepare-individual.js" :
      command === "catalogo:acreditar" ? "accredit-individual.js" : "publish-individual.js";
    writeFileSync(join(workspace, "dist", "cli", "commands", "catalog", entry),
      "console.log('ARGS ' + JSON.stringify(process.argv.slice(2)));\n");
    return { workspace, cleanup: () => rmSync(workspace, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
};

export const runToolingNpm = (workspace: string, command: CatalogCommand, ...args: readonly string[]) => {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(npm, ["run", command, "--", ...args], {
    cwd: workspace, encoding: "utf8", windowsHide: true, shell: process.platform === "win32"
  });
};
