import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createToolingTestWorkspace, runToolingNpm } from "./tooling-test-workspace.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

test("catalogo:preparar llega desde npm a la CLI con opciones normalizadas y ruta con espacios", () => {
  const { workspace, cleanup } = createToolingTestWorkspace("catalogo:preparar", "equipzilla tooling nuevo ");
  try {
    const empty = runToolingNpm(workspace, "catalogo:preparar");
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /ARGS \[\]/);
    const selected = runToolingNpm(workspace, "catalogo:preparar", "--proveedor", "gam", "--simular");
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
  } finally { cleanup(); }
});
