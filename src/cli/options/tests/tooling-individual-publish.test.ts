import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createToolingTestWorkspace, runToolingNpm } from "./tooling-test-workspace.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

test("FINISH via npm y Node conserva opciones, ayuda, espacios y selección sin PowerShell auxiliar", () => {
  const { workspace, cleanup } = createToolingTestWorkspace("publicar", "equipzilla tooling publicar espacios ");
  try {
    const base = runToolingNpm(workspace, "publicar");
    assert.equal(base.status, 0, base.stderr);
    assert.match(base.stdout, /ARGS \[\]/);
    const selected = runToolingNpm(workspace, "publicar", "--proveedor", "gam", "--simular");
    assert.equal(selected.status, 0, selected.stderr);
    assert.match(selected.stdout, /ARGS \["--proveedor","gam","--dry-run"\]/);
    const direct = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "publicar", "--proveedor", "mercaeleva"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(direct.status, 0, direct.stderr);
    assert.match(direct.stdout, /ARGS \["--proveedor","mercaeleva"\]/);
    const help = spawnSync(process.execPath, [join(workspace, "scripts", "tooling.mjs"), "ayuda", "publicar"], {
      cwd: workspace, encoding: "utf8", windowsHide: true
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Paso 2\/2/);
    const json: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.ok(typeof json === "object" && json !== null && "scripts" in json);
    assert.ok(typeof json.scripts === "object" && json.scripts !== null && "publicar" in json.scripts);
  } finally { cleanup(); }
});


test("el diagnóstico de FINISH usa la selección ordinaria de cuatro proveedores y permite Manain individual", () => {
  const { workspace, cleanup } = createToolingTestWorkspace("publicar", "equipzilla diagnosticar finish ");
  try {
    for (const path of ["scripts/inspection/finish-preflight.mjs", "dist/cli/options/individual-catalog.js", "dist/contracts/campaign-providers.js"]) {
      mkdirSync(dirname(join(workspace, path)), { recursive: true });
      copyFileSync(join(root, path), join(workspace, path));
    }
    const inspector = join(workspace, "dist/publication/individual/finish-preflight.js");
    mkdirSync(dirname(inspector), { recursive: true });
    writeFileSync(inspector, "export const inspectIndividualFinishPreflight = (_root, ids) => ({ complete: false, providers: ids.map(providerId => ({ providerId, evaluable: false, absences: [], blockers: [] })) });\n");
    for (const [args, ids] of [[[], ["gam", "gomariz", "mercaeleva", "manain"]], [["--proveedor", "manain"], ["manain"]]] as const) {
      const result = spawnSync(process.execPath, [join(workspace, "scripts/inspection/finish-preflight.mjs"), ...args], {
        cwd: workspace, encoding: "utf8", windowsHide: true
      });
      assert.equal(result.status, 1, result.stderr);
      const report: unknown = JSON.parse(result.stdout);
      assert.deepEqual(report, { complete: false, providers: ids.map(providerId => ({ providerId, evaluable: false, absences: [], blockers: [] })) });
    }
  } finally { cleanup(); }
});
