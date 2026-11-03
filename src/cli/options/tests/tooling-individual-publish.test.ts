import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createToolingTestWorkspace, runToolingNpm } from "./tooling-test-workspace.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

test("FINISH via npm y Node conserva opciones, ayuda, espacios y selección sin PowerShell auxiliar", () => {
  const { workspace, cleanup } = createToolingTestWorkspace("catalogo:publicar", "equipzilla tooling publicar espacios ");
  try {
    const base = runToolingNpm(workspace, "catalogo:publicar");
    assert.equal(base.status, 0, base.stderr);
    assert.match(base.stdout, /ARGS \[\]/);
    const selected = runToolingNpm(workspace, "catalogo:publicar", "--proveedor", "gam", "--simular");
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
    assert.match(help.stdout, /Paso 2\/2/);
    const json: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.ok(typeof json === "object" && json !== null && "scripts" in json);
    assert.ok(typeof json.scripts === "object" && json.scripts !== null && "catalogo:publicar" in json.scripts);
  } finally { cleanup(); }
});
