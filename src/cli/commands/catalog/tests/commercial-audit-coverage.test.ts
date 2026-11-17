import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { auditCommercialCatalogWithCoverage } from "../../../../commercial/export/commercial-audit.js";
import { cleanupBaseline, readCommercialBaselineRoot } from "./catalog-content-gaps-fixtures.js";

test("la auditoría comercial conserva los bloqueos reales y distingue fuentes ausentes o corruptas", async () => {
  const root = await readCommercialBaselineRoot();
  try {
    const complete = await auditCommercialCatalogWithCoverage(root, false);
    assert.deepEqual(complete.report.providers.map((provider) => provider.baseline.providerId), ["gam", "gomariz", "mercaeleva"]);
    assert.deepEqual(complete.auditCoverage?.failures, []);
    const gomarizOriginal = join(root, "catalogs", "providers", "gomariz", "original");
    await rm(gomarizOriginal, { recursive: true, force: true });
    await cp(join(process.cwd(), "catalogs", "providers", "gomariz", "original"), gomarizOriginal, { recursive: true });
    const gamManifest = join(root, "catalogs", "providers", "gam", "original", "scrape-gam-catalog.manifest.json");
    await writeFile(gamManifest, "{" );
    const damaged = await auditCommercialCatalogWithCoverage(root, false);
    assert.equal(damaged.auditCoverage?.incompleteSource, 1);
    assert.equal(damaged.auditCoverage?.errors, 1);
    assert.equal(damaged.report.providers.length, 1);
    assert.equal(damaged.auditCoverage?.failures.find((failure) => failure.providerId === "gomariz")?.category, "INCOMPLETE_SOURCE");
    assert.equal(damaged.auditCoverage?.failures.find((failure) => failure.providerId === "gam")?.category, "ERROR");
    assert.equal(damaged.report.providers[0]?.baseline.providerId, "mercaeleva");
  } finally {
    await cleanupBaseline();
  }
});

test("el reporte de acreditación parcial no puede imprimir PASS con cero infracciones observadas", () => {
  const expression = `import { printCommercialAuditReport } from "./dist/cli/reporting/commercial-audit.js";
    printCommercialAuditReport({ version: 2, providers: [] }, "--acreditacion", undefined, undefined, undefined, true);`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", expression], {
    cwd: process.cwd(), encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /FAIL \| AUDITORÍA INCOMPLETA/u);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /PASS \|/u);
});
