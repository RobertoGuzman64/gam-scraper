import assert from "node:assert/strict";
import { readdir, rm } from "node:fs/promises";
import test, { mock } from "node:test";
import { CAMPAIGN_PROVIDERS } from "../../../../contracts/campaign-providers.js";
import { parseNormalizationAuditOptions, runNormalizationAudit } from "../audits/normalization-audit.js";
import { buildNormalizationAudit } from "../../../../infrastructure/filesystem/preparation/normalization-audit.js";
import { formatNormalizationAudit, writeNormalizationAuditJson } from "../../../reporting/audits/normalization-audit.js";
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
    assert.deepEqual(report.diagnostics.checks.map(({ check }) => check), ["idempotencia-original", "idempotencia-preparacion", "idempotencia-publicacion",
      "coherencia-dimensional-original", "coherencia-dimensional-preparacion", "coherencia-dimensional-publicacion", "coherencia-presentacion-original",
      "precedencias-alias-original", "precedencias-alias-preparacion", "precedencias-alias-publicacion",
      "conservacion-semantica-original", "conservacion-semantica-preparacion", "conservacion-semantica-publicacion",
      "precedencias-reconciliacion-presentacion", "precedencias-reconciliacion-origen", "procedencia-preparacion", "procedencia-publicacion",
      "equivalencias-original-preparacion", "equivalencias-original-publicacion", "equivalencias-preparacion-publicacion", "aprovechamiento-atributos-comerciales",
      "csv-specjson", "csv-columnas-tecnicas", "seed-directo", "seed-via-csv-normalizado"]);
    assert.ok(report.diagnostics.checks.every(({ population, missingProviders }) => population === 0 && missingProviders.length === CAMPAIGN_PROVIDERS.length));
    assert.deepEqual(report.diagnostics.occurrences, []);
    assert.match(formatNormalizationAudit(report, { limit: 2, detailed: false }).join("\n"), /COMPROBACIONES TRANSVERSALES \| 25 activas/u);
    const missing = await buildNormalizationAudit(workspace, [{ id: "sintetica", evaluate: () => assert.fail("No hay fuentes") }]);
    assert.deepEqual(missing.diagnostics.checks[0]?.missingProviders, CAMPAIGN_PROVIDERS);
    assert.equal(missing.diagnostics.checks[0]?.population, 0);
    assert.equal(missing.complete, false);
    assert.match(formatNormalizationAudit(report, { limit: 2, detailed: false }).join("\n"), /COBERTURA PARCIAL/u);
    assert.deepEqual(await readdir(workspace), []);
    const previousExit = process.exitCode;
    const previousError = console.error;
    const messages: string[] = [];
    const errors: string[] = [];
    const stdout = mock.method(process.stdout, "write", (chunk: string | Uint8Array, callback?: (error?: Error | null) => void) => {
      messages.push(String(chunk));
      callback?.();
      return true;
    });
    try {
      console.error = (...parts: unknown[]) => { errors.push(parts.map(String).join(" ")); };
      await runNormalizationAudit(["--json"], workspace);
      assert.equal(process.exitCode, 1);
      const json = messages.join("");
      assert.equal(json, `${JSON.stringify(report)}\n`);
      assert.equal(JSON.parse(json).complete, false);
      assert.equal(errors.length, CAMPAIGN_PROVIDERS.length);
    } finally {
      stdout.mock.restore();
      console.error = previousError;
      process.exitCode = previousExit;
    }
    assert.deepEqual(await readdir(workspace), []);
  } finally { await rm(workspace, { recursive: true, force: true }); }
});


test("la escritura JSON por bloques conserva exactamente el contrato y espera al consumidor", async () => {
  const workspace = await createTemporaryTestWorkspace("eqz-normalizacion-json-");
  try {
    const report = await buildNormalizationAudit(workspace, []);
    const expanded = { ...report, provenance: { ...report.provenance, preparation: "á😀\n".repeat(100_000) } };
    const chunks: string[] = [];
    let writing = false;
    await writeNormalizationAuditJson(expanded, async (chunk) => {
      assert.equal(writing, false);
      writing = true;
      await Promise.resolve();
      chunks.push(chunk);
      writing = false;
    });
    assert.ok(chunks.length > 1);
    assert.equal(chunks.join(""), `${JSON.stringify(expanded)}\n`);
    await assert.rejects(writeNormalizationAuditJson(expanded, async () => { throw new Error("Salida interrumpida"); }), /Salida interrumpida/u);
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
