import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { parseCommercialExportOptions } from "../commercial-export.js";

test("requiere destino nuevo fuera del repositorio y entorno explícito para IDs", () => {
  assert.throws(() => parseCommercialExportOptions([]), /--out/);
  assert.throws(() => parseCommercialExportOptions(["--out", "./catalogs/commercial"]), /fuera del repositorio/);
  assert.throws(() => parseCommercialExportOptions(["--out", "./data/commercial-reference"]), /fuera del repositorio/);
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
