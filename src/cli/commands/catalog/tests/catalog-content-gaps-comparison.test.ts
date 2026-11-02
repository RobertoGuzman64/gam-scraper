import assert from "node:assert/strict";
import test from "node:test";
import { cleanupBaseline, execute, executeBaseline, gam } from "./catalog-content-gaps-fixtures.js";

test.after(cleanupBaseline);

let baselineComparison: Promise<unknown> | undefined;
const readBaselineComparison = (): Promise<unknown> => {
  baselineComparison ??= executeBaseline(["--comparar", "--specs", "--json", "--top", "1"]).then((raw) => JSON.parse(raw) as unknown);
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
  assert.ok(report.priorities.pending.some((item) => item.signal === "general_muy_breve"));
  assert.ok(report.priorities.pending.some((item) => item.stage === "P2" && item.familySamples >= 5));
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
  readonly priorities: {
    readonly totals: { readonly pendingByStage: { readonly P0: number } };
    readonly pending: readonly { readonly reference: string | null; readonly signal: string;
      readonly stage: string; readonly preparedWords: number; readonly familySamples: number }[];
    readonly resolved: readonly { readonly stage: string; readonly reference: string | null; readonly signal: string }[];
    readonly technical: readonly { readonly contradictions: readonly string[] }[];
  };
  readonly coverage: {
    readonly totals: {
      readonly products: number;
      readonly publishedMissing: { readonly description: number; readonly description_general: number };
      readonly recovered: { readonly description: number; readonly description_general: number };
      readonly pending: { readonly description: number; readonly description_general: number };
      readonly lost: { readonly description: number; readonly description_general: number };
      readonly incompleteProducts: number;
      readonly bothPending: number;
    };
    readonly pendingCases: readonly { readonly reference: string | null; readonly missing: readonly string[] }[];
    readonly providers: readonly { readonly providerId: string; readonly origin: string }[];
  };
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
  readonly priorities: ComparisonReport["priorities"] & { readonly totals: { readonly pending: number } };
  readonly technicalSpecs: {
    readonly totals: { readonly products: number; readonly canonicalOriginals: number; readonly reconstructedSources: number;
      readonly pendingPublication: number; readonly observationalMissing: number };
    readonly cases: readonly { readonly providerId: string; readonly reference: string | null; readonly stage: string }[];
  };
};
const isSpecificationComparisonReport = (value: unknown): value is SpecificationComparisonReport =>
  isComparisonReport(value) && "technicalSpecs" in value && typeof value.technicalSpecs === "object" &&
  value.technicalSpecs !== null && "totals" in value.technicalSpecs && "cases" in value.technicalSpecs &&
  Array.isArray(value.technicalSpecs.cases) && "pending" in value.priorities.totals;

test("huecos --comparar --specs diferencia cobertura técnica sin alterar el informe editorial", async () => {
  const comparison = await readBaselineComparison();
  assert.ok(isSpecificationComparisonReport(comparison));
  assert.equal(comparison.coverage.totals.products, comparison.technicalSpecs.totals.products);
  assert.deepEqual(comparison.coverage.totals.pending, { description: 0, description_general: 0 });
  assert.ok(comparison.priorities.totals.pending > 0);
  assert.ok(comparison.technicalSpecs.totals.products > 0);
  assert.ok(comparison.technicalSpecs.totals.canonicalOriginals > 0);
  assert.ok(comparison.technicalSpecs.totals.reconstructedSources > 0);
  assert.equal(comparison.technicalSpecs.totals.pendingPublication,
    comparison.technicalSpecs.cases.filter((item) => item.stage === "pendiente_publicacion").length);
  assert.ok(comparison.technicalSpecs.totals.observationalMissing > 0);
  assert.ok(comparison.technicalSpecs.cases.some((item) => item.providerId === "gam" &&
    item.reference === "6807" && item.stage === "diferencia_origen_preparacion"));
  await assert.rejects(execute(["--finales", "--specs"]), /requiere --comparar/);
});
