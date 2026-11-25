import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { parseCommercialExportOptions, shouldRefreshLocalPanel } from "../commercial/commercial-export.js";

test("predetermina un ZIP y conserva directorio fuera del repositorio y entorno explícito", () => {
  assert.throws(() => parseCommercialExportOptions([]), /requiere --entorno/);
  assert.deepEqual(parseCommercialExportOptions(["--entorno", "production"]), {
    out: null, environment: "production", dryRun: false
  });
  assert.throws(() => parseCommercialExportOptions(["--out", "./catalogs/commercial", "--entorno", "develop"]), /fuera del repositorio/);
  assert.throws(() => parseCommercialExportOptions(["--out", "./data/commercial-reference", "--entorno", "develop"]), /fuera del repositorio/);
  assert.throws(() => parseCommercialExportOptions(["--out", "/tmp/commercial", "--environment", "staging"]), /develop o production/);
  assert.deepEqual(parseCommercialExportOptions(["--out", join("/tmp", "new-commercial"), "--environment", "production"]), {
    out: join("/tmp", "new-commercial"), environment: "production", dryRun: false
  });
  assert.deepEqual(parseCommercialExportOptions(["--dry-run"]), { out: null, environment: null, dryRun: true });
  assert.deepEqual(parseCommercialExportOptions(["--salida", join("/tmp", "new-commercial"), "--entorno", "production"]), {
    out: join("/tmp", "new-commercial"), environment: "production", dryRun: false
  });
  assert.deepEqual(parseCommercialExportOptions(["--simular"]), { out: null, environment: null, dryRun: true });
  assert.throws(() => parseCommercialExportOptions(["--dry-run", "--simular"]), /inválida/);
  assert.throws(() => parseCommercialExportOptions(["--out", "/tmp/commercial", "--salida", "/tmp/duplicate"]), /inválida/);
  assert.throws(() => parseCommercialExportOptions(["--dry-run", "--dry-run"]), /inválida/);
  assert.equal(parseCommercialExportOptions(["--help"]), "help");
});

test("regenera el panel solo después de una entrega normal de develop", () => {
  const develop = parseCommercialExportOptions(["--entorno", "develop"]);
  const production = parseCommercialExportOptions(["--entorno", "production"]);
  const simulated = parseCommercialExportOptions(["--entorno", "develop", "--simular"]);
  const files = parseCommercialExportOptions(["--entorno", "develop", "--salida", join("/tmp", "outside-panel")]);
  for (const options of [develop, production, simulated, files]) assert.notEqual(options, "help");
  if (develop === "help" || production === "help" || simulated === "help" || files === "help") return;
  assert.equal(shouldRefreshLocalPanel(develop), true);
  assert.equal(shouldRefreshLocalPanel(production), false);
  assert.equal(shouldRefreshLocalPanel(simulated), false);
  assert.equal(shouldRefreshLocalPanel(files), false);
});


test("el detalle comercial es opcional y compatible con la simulación", () => {
  assert.deepEqual(parseCommercialExportOptions(["--entorno", "develop", "--detalle"]), {
    out: null, environment: "develop", dryRun: false, detailed: true
  });
  assert.deepEqual(parseCommercialExportOptions(["--detalle", "--simular"]), {
    out: null, environment: null, dryRun: true, detailed: true
  });
  assert.throws(() => parseCommercialExportOptions(["--simular", "--detalle", "--detalle"]), /inválida/);
});
