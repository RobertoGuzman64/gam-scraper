import assert from "node:assert/strict";
import test from "node:test";
import type { DescriptionCoverage } from "../../../../catalog/diagnostics/description-coverage.js";
import type { DescriptionPriorities } from "../../../../catalog/diagnostics/description-priorities.js";
import type { SpecificationCoverage } from "../../../../catalog/diagnostics/specification-coverage.js";
import { cleanupBaseline, execute, executeBaseline } from "./catalog-content-gaps-fixtures.js";

test.after(cleanupBaseline);

let baselineComparison: Promise<unknown> | undefined;
const readBaselineComparison = (): Promise<unknown> => {
  baselineComparison ??= executeBaseline(["--comparar", "--specs", "--json", "--top", "1"]).then((raw): unknown => JSON.parse(raw));
  return baselineComparison;
};

test("huecos compara las publicaciones activas y acredita la cobertura de descripciones", async () => {
  const report = await readBaselineComparison();
  assert.ok(isComparisonReport(report));
  assert.equal(report.provenance.source, "comparacion_publicaciones_y_preparacion");
  assert.ok(report.coverage.totals.products > 0);
  assert.deepEqual(report.coverage.totals.publishedMissing, { description: 0, description_general: 0 });
  assert.deepEqual(report.coverage.totals.recovered, { description: 0, description_general: 0 });
  assert.deepEqual(report.coverage.totals.pending, { description: 0, description_general: 0 });
  assert.deepEqual(report.coverage.totals.lost, { description: 0, description_general: 0 });
  assert.equal(report.coverage.totals.incompleteProducts, 0);
  assert.equal(report.coverage.totals.bothPending, 0);
  assert.equal(report.coverage.pendingCases.length, 0);
  assert.equal(report.coverage.providers.find((item) => item.providerId === "mercaeleva")?.origin, "reconstruccion_publicada");
  assert.equal(report.editorial.providers.length, 3);
  assert.equal(report.editorialPrepared.providers.length, 3);
  assert.equal(report.priorities.totals.pendingByStage.P0, 0);
  assert.equal(report.priorities.totals.pending, report.priorities.pending.length);
  assert.equal(report.priorities.totals.resolved, report.priorities.resolved.length);
  assert.equal(report.priorities.totals.technical, report.priorities.technical.length);
  assert.equal(report.priorities.totals.appeared,
    report.priorities.pending.filter((item) => item.state === "aparecido").length);
  for (const stage of ["P0", "P1", "P2"] as const) {
    assert.equal(report.priorities.totals.pendingByStage[stage],
      report.priorities.pending.filter((item) => item.stage === stage).length);
  }
  const text = await executeBaseline(["--comparar", "--top", "1"]);
  assert.match(text, /P0 COLA RESIDUAL \| 0 fichas, sin recorte por --top/);
  assert.match(text, /ORDEN DE TRABAJO \| P0 vacíos 0/);
  assert.match(text, /INCIDENCIAS TÉCNICAS/);
  await assert.rejects(execute(["--comparar", "--finales"]), /no se combina/);
});

type ComparisonReport = {
  readonly provenance: { readonly source: string };
  readonly editorial: { readonly providers: readonly unknown[] };
  readonly editorialPrepared: { readonly providers: readonly unknown[] };
  readonly priorities: DescriptionPriorities;
  readonly coverage: DescriptionCoverage;
};
const isComparisonReport = (value: unknown): value is ComparisonReport => {
  if (typeof value !== "object" || value === null || !("coverage" in value) || !("editorial" in value) ||
    !("editorialPrepared" in value) || !("provenance" in value) ||
    typeof value.coverage !== "object" || value.coverage === null ||
    typeof value.provenance !== "object" || value.provenance === null ||
    typeof value.editorial !== "object" || value.editorial === null ||
    typeof value.editorialPrepared !== "object" || value.editorialPrepared === null) return false;
  return "totals" in value.coverage && "pendingCases" in value.coverage && "providers" in value.coverage &&
    "source" in value.provenance && "providers" in value.editorial && "providers" in value.editorialPrepared &&
    "priorities" in value && typeof value.priorities === "object" && value.priorities !== null &&
    "totals" in value.priorities && "pending" in value.priorities && "resolved" in value.priorities &&
    "technical" in value.priorities;
};

type SpecificationComparisonReport = ComparisonReport & {
  readonly technicalSpecs: SpecificationCoverage;
};
const isSpecificationComparisonReport = (value: unknown): value is SpecificationComparisonReport =>
  isComparisonReport(value) && "technicalSpecs" in value && typeof value.technicalSpecs === "object" &&
  value.technicalSpecs !== null && "totals" in value.technicalSpecs && "cases" in value.technicalSpecs &&
  Array.isArray(value.technicalSpecs.cases);

test("huecos --comparar --specs diferencia cobertura técnica sin alterar el informe editorial", async () => {
  const comparison = await readBaselineComparison();
  assert.ok(isSpecificationComparisonReport(comparison));
  assert.equal(comparison.coverage.totals.products, comparison.technicalSpecs.totals.products);
  assert.deepEqual(comparison.coverage.totals.pending, { description: 0, description_general: 0 });
  assert.equal(comparison.priorities.totals.pending, comparison.priorities.pending.length);
  assert.equal(comparison.priorities.totals.pendingByStage.P0, 0);
  assert.ok(comparison.technicalSpecs.totals.products > 0);
  assert.ok(comparison.technicalSpecs.totals.canonicalOriginals > 0);
  assert.ok(comparison.technicalSpecs.totals.reconstructedSources > 0);
  assert.equal(comparison.technicalSpecs.totals.pendingPublication,
    comparison.technicalSpecs.cases.filter((item) => item.stage === "pendiente_publicacion").length);
  assert.ok(comparison.technicalSpecs.totals.observationalMissing > 0);
  assert.ok(comparison.technicalSpecs.cases.some((item) => item.providerId === "gam" &&
    item.reference === "6807" && item.stage === "reconciliacion_acreditada"));
  await assert.rejects(execute(["--finales", "--specs"]), /requiere --comparar/);
});
