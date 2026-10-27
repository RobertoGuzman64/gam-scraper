import assert from "node:assert/strict";
import test from "node:test";
import { formatBatchSummary } from "../batch-summary.js";
import type { BatchReport, ProviderRun } from "../../../pipeline/batch/report.js";

const provider = (providerId: string, status: ProviderRun["status"]): ProviderRun => ({
  providerId, status, startedAt: "2026-10-20T10:00:00.000Z", endedAt: "2026-10-20T10:00:30.000Z",
  durationMs: 30_000, outputDir: "storage/scraped", outputPrefix: `scrape-${providerId}`,
  logFile: `storage/runs/${providerId}.log`, summaryFile: `storage/scraped/${providerId}-summary.json`,
  changesFile: `storage/scraped/${providerId}-changes.json`,
  ...(status === "complete" ? { products: 12, failures: 0, added: 4, updated: 3 } : { error: "falló" })
});

test("muestra el total sin sumar resultados fallidos y conserva rutas de diagnóstico", () => {
  const report: BatchReport = {
    version: 1, runId: "demo", startedAt: "2026-10-20T10:00:00.000Z", endedAt: "2026-10-20T10:01:00.000Z",
    status: "partial", requestedProviders: ["gam", "gomariz"],
    providers: [provider("gam", "complete"), provider("gomariz", "failed")]
  };
  const lines = formatBatchSummary(report, "storage/runs/demo/run.json");
  assert.match(lines.join("\n"), /1\/2 proveedores/);
  assert.match(lines.join("\n"), /12/);
  assert.match(lines.join("\n"), /gomariz\.log/);
  assert.match(lines.join("\n"), /run\.json/);
  assert.match(lines.join("\n"), /WARN \| LOTE \| PARCIAL/);
  assert.match(lines.join("\n"), /PASS \| GAM/);
  assert.match(lines.join("\n"), /FAIL \| GOMARIZ/);
  assert.doesNotMatch(lines.join("\n"), /\u001b/);
});
