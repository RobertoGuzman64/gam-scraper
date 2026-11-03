import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const script = join(root, "scripts/tooling.mjs");

const npmRun = (workspace: string, ...args: readonly string[]) => {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(command, ["run", "catalogo:preparar", "--", ...args], {
    cwd: workspace, encoding: "utf8", windowsHide: true, shell: process.platform === "win32"
  });
};

test("catalogo:preparar llega desde npm a la CLI con opciones normalizadas y ruta con espacios", () => {
  const workspace = mkdtempSync(join(tmpdir(), "equipzilla tooling nuevo "));
  try {
    mkdirSync(join(workspace, "scripts"));
    mkdirSync(join(workspace, "dist", "cli", "commands", "catalog"), { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({
      name: "equipzilla-test", type: "module",
      scripts: { "catalogo:preparar": "node scripts/tooling.mjs catalogo:preparar" }
    }));
    copyFileSync(script, join(workspace, "scripts", "tooling.mjs"));
    copyFileSync(join(root, "scripts", "terminal.mjs"), join(workspace, "scripts", "terminal.mjs"));
    copyFileSync(join(root, "scripts", "build-cache.mjs"), join(workspace, "scripts", "build-cache.mjs"));
    writeFileSync(join(workspace, "scripts", "run-build.mjs"), "process.exitCode = 0;\n");
    writeFileSync(join(workspace, "dist", "cli", "commands", "catalog", "prepare-individual.js"),
      "console.log('ARGS ' + JSON.stringify(process.argv.slice(2)));\n");
    const empty = npmRun(workspace);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /ARGS \[\]/);
    const selected = npmRun(workspace, "--proveedor", "gam", "--simular");
    assert.equal(selected.status, 0, selected.stderr);
    assert.match(selected.stdout, /ARGS \["--proveedor","gam","--dry-run"\]/);
    const help = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "ayuda", "catalogo:preparar"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Paso 1\/2/);
    const direct = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "catalogo:preparar", "--proveedor", "mercaeleva"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(direct.status, 0, direct.stderr);
    assert.match(direct.stdout, /ARGS \["--proveedor","mercaeleva"\]/);
    const packageFile: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.ok(typeof packageFile === "object" && packageFile !== null && "scripts" in packageFile);
    assert.ok(typeof packageFile.scripts === "object" && packageFile.scripts !== null && "catalogo:preparar" in packageFile.scripts);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});
