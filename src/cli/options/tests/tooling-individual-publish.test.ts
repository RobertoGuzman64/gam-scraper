import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const command = (workspace: string, ...args: readonly string[]) => spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "catalogo:publicar", "--", ...args], {
    cwd: workspace, encoding: "utf8", windowsHide: true, shell: process.platform === "win32"
  }
);

test("FINISH via npm y Node conserva opciones, ayuda, espacios y selección sin PowerShell auxiliar", () => {
  const workspace = mkdtempSync(join(tmpdir(), "equipzilla tooling publicar espacios "));
  try {
    mkdirSync(join(workspace, "scripts"));
    mkdirSync(join(workspace, "dist", "cli", "commands", "catalog"), { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({
      name: "equipzilla-test", type: "module",
      scripts: { "catalogo:publicar": "node scripts/tooling.mjs catalogo:publicar" }
    }));
    for (const name of ["tooling.mjs", "terminal.mjs", "build-cache.mjs"]) {
      copyFileSync(join(root, "scripts", name), join(workspace, "scripts", name));
    }
    writeFileSync(join(workspace, "scripts", "run-build.mjs"), "process.exitCode = 0;\n");
    writeFileSync(join(workspace, "dist", "cli", "commands", "catalog", "publish-individual.js"),
      "console.log('ARGS ' + JSON.stringify(process.argv.slice(2)));\n");
    const base = command(workspace);
    assert.equal(base.status, 0, base.stderr);
    assert.match(base.stdout, /ARGS \[\]/);
    const selected = command(workspace, "--proveedor", "gam", "--simular");
    assert.equal(selected.status, 0, selected.stderr);
    assert.match(selected.stdout, /ARGS \["--proveedor","gam","--dry-run"\]/);
    const direct = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "catalogo:publicar", "--proveedor", "mercaeleva"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(direct.status, 0, direct.stderr);
    assert.match(direct.stdout, /ARGS \["--proveedor","mercaeleva"\]/);
    const help = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "ayuda", "catalogo:publicar"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Paso 3\/3/);
    const json: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.ok(typeof json === "object" && json !== null && "scripts" in json);
    assert.ok(typeof json.scripts === "object" && json.scripts !== null && "catalogo:publicar" in json.scripts);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
