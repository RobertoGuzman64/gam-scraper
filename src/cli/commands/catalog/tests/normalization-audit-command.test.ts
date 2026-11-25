import assert from "node:assert/strict";
import { readdir, rm } from "node:fs/promises";
import test from "node:test";
import { CAMPAIGN_PROVIDERS } from "../../../../contracts/campaign-providers.js";
import { parseNormalizationAuditOptions, runNormalizationAudit } from "../normalization-audit.js";
import { buildNormalizationAudit } from "../../../../infrastructure/filesystem/preparation/normalization-audit.js";
import { formatNormalizationAudit } from "../../../reporting/normalization-audit.js";
import { createTemporaryTestWorkspace } from "../../../../testing/builders/reusable-workspace-fixture.js";

test("el comando distingue resumen, detalle y JSON completo", () => {
  assert.deepEqual(parseNormalizationAuditOptions([]), { limit: 20, detailed: false, json: false });
  assert.deepEqual(parseNormalizationAuditOptions(["--top", "3", "--detalle"]), { limit: 3, detailed: true, json: false });
  assert.deepEqual(parseNormalizationAuditOptions(["--top=2"]), { limit: 2, detailed: false, json: false });
  assert.deepEqual(parseNormalizationAuditOptions(["--json"]), { limit: 20, detailed: false, json: true });
  for (const args of [["--top"], ["--top", "0"], ["--top", "1.5"], ["--top", "9007199254740992"],
    ["--json", "--detalle"], ["--json", "--top=2"], ["--detalle", "--detalle"], ["--top=2", "--top", "3"],
    ["--aplicar"], ["--salida", "archivo"], ["--proveedor", "gam"]]) {
    assert.throws(() => parseNormalizationAuditOptions(args));
  }
});

test("un workspace vacío conserva la población esperada, informa incompletitud y no escribe", async () => {
  const workspace = await createTemporaryTestWorkspace("eqz-normalizacion-vacio-");
  try {
    const report = await buildNormalizationAudit(workspace);
    assert.equal(report.complete, false);
    assert.deepEqual(report.provenance.population.expected, CAMPAIGN_PROVIDERS);
    assert.deepEqual(report.provenance.population.selected, CAMPAIGN_PROVIDERS);
    assert.deepEqual(report.provenance.population.processed, []);
    assert.deepEqual(report.provenance.population.unavailable, CAMPAIGN_PROVIDERS);
    assert.deepEqual(report.provenance.population.incomplete, []);
    assert.equal(report.auditCoverage.failures.length, CAMPAIGN_PROVIDERS.length);
    assert.equal(report.potential.uniqueProducts, 0);
    assert.match(formatNormalizationAudit(report, { limit: 2, detailed: false }).join("\n"), /COBERTURA PARCIAL/u);
    assert.deepEqual(await readdir(workspace), []);
    const previousExit = process.exitCode;
    const previousLog = console.log;
    const previousError = console.error;
    const messages: string[] = [];
    const errors: string[] = [];
    try {
      console.log = (...parts: unknown[]) => { messages.push(parts.map(String).join(" ")); };
      console.error = (...parts: unknown[]) => { errors.push(parts.map(String).join(" ")); };
      await runNormalizationAudit(["--json"], workspace);
      assert.equal(process.exitCode, 1);
      assert.equal(messages.length, 1);
      assert.equal(JSON.parse(messages[0] ?? "").complete, false);
      assert.equal(errors.length, CAMPAIGN_PROVIDERS.length);
    } finally {
      console.log = previousLog;
      console.error = previousError;
      process.exitCode = previousExit;
    }
    assert.deepEqual(await readdir(workspace), []);
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
