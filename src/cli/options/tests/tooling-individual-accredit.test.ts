import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createToolingTestWorkspace, runToolingNpm } from "./tooling-test-workspace.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

test("catalogo:acreditar se invoca desde npm y Node con --proveedor, --simular y ruta con espacios", () => {
  const { workspace, cleanup } = createToolingTestWorkspace("catalogo:acreditar", "equipzilla tooling acreditar ");
  try {
    const base = runToolingNpm(workspace, "catalogo:acreditar");
    assert.equal(base.status, 0, base.stderr);
    assert.match(base.stdout, /ARGS \[\]/);
    const selected = runToolingNpm(workspace, "catalogo:acreditar", "--proveedor", "gam", "--simular");
    assert.equal(selected.status, 0, selected.stderr);
    assert.match(selected.stdout, /ARGS \["--proveedor","gam","--dry-run"\]/);
    const direct = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "catalogo:acreditar", "--proveedor", "mercaeleva"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(direct.status, 0, direct.stderr);
    assert.match(direct.stdout, /ARGS \["--proveedor","mercaeleva"\]/);
    const help = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "ayuda", "catalogo:acreditar"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Comando opcional/);
    const json: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.ok(typeof json === "object" && json !== null && "scripts" in json);
    assert.ok(typeof json.scripts === "object" && json.scripts !== null && "catalogo:acreditar" in json.scripts);
  } finally { cleanup(); }
});
