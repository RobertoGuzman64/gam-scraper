import assert from "node:assert/strict";
import test from "node:test";
import type { DescriptionCoverage } from "../../../../catalog/diagnostics/description-coverage.js";
import type { DescriptionPriorities } from "../../../../catalog/diagnostics/description-priorities.js";
import type { SpecificationCoverage } from "../../../../catalog/diagnostics/specification-coverage.js";
import { cleanupBaseline, execute, executeBaseline } from "./catalog-content-gaps-fixtures.js";
import { hasCompleteCatalogAuditEvidence, hasUnresolvedCatalogAuditContracts } from "../../../../catalog/diagnostics/audit-closure.js";
import { formatCatalogAuditClosureReport } from "../catalog-audit-closure-report.js";

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
  for (const provider of report.coverage.providers) {
    const publication: ComparisonReport["provenance"]["publications"][number] | undefined =
      report.provenance.publications.find((item) => item.providerId === provider.providerId);
    assert.equal(provider.origin, publication?.origin);
  }
  assert.equal(report.editorial.providers.length, 3);
  assert.equal(report.editorialPrepared.providers.length, 3);
  assert.equal(report.priorities.totals.pendingByStage.P0, 0);
  assert.equal(report.priorities.totals.pending, report.priorities.pending.length);
  assert.equal(report.priorities.totals.resolved, report.priorities.resolved.length);
  assert.equal(report.priorities.totals.technical, report.priorities.technical.length);
  assert.equal(report.technicalDensity.totals.products, report.coverage.totals.products);
  assert.equal(report.technicalDensity.totals.sparse, report.technicalDensity.cases.length);
  assert.equal(report.technicalDensity.totals.medium, report.technicalDensity.mediumCases.length);
  assert.equal(report.technicalDensity.totals.sparse,
    report.technicalDensity.cases.filter((item) => item.priority === "alta").length);
  assert.equal(report.technicalDensity.totals.medium,
    report.technicalDensity.mediumCases.filter((item) => item.priority === "media").length);
  assert.equal(report.technicalDensity.totals.sparse,
    report.technicalDensity.providers.reduce((sum, provider) => sum + provider.sparse, 0));
  assert.equal(report.technicalDensity.totals.medium,
    report.technicalDensity.providers.reduce((sum, provider) => sum + provider.medium, 0));
  assert.ok(report.technicalDensity.providers.every((provider) => provider.sparse + provider.medium <= provider.products));
  assert.equal(report.technicalDensity.totals.sparse, 0);
  assert.equal(report.technicalDensity.totals.medium, 0);
  assert.equal(report.priorities.totals.appeared,
    report.priorities.pending.filter((item) => item.state === "aparecido").length);
  for (const stage of ["P0", "P1", "P2"] as const) {
    assert.equal(report.priorities.totals.pendingByStage[stage],
      report.priorities.pending.filter((item) => item.stage === stage).length);
  }
  const densityText = await executeBaseline(["--comparar", "--specs", "--top", "1"]);
  assert.match(densityText, /DENSIDAD TÉCNICA \| PRIORIDAD EDITORIAL/);
  assert.match(densityText, /ALTA 0–2: \d+ \| MEDIA 3: \d+/);
  assert.match(densityText, /DENSIDAD PROVEEDOR \| gam \| alta/);
  assert.match(densityText, /DENSIDAD PROVEEDOR \| gomariz \| alta/);
  assert.match(densityText, /DENSIDAD PROVEEDOR \| mercaeleva \| alta/);
  const text = await executeBaseline(["--comparar", "--top", "1"]);
  assert.match(text, /P0 COLA RESIDUAL \| 0 fichas, sin recorte por --top/);
  assert.match(text, /ORDEN DE TRABAJO \| P0 vacíos 0/);
  assert.match(text, /INCIDENCIAS TÉCNICAS/);
  assert.doesNotMatch(text, /CIERRE AUDITOR/);
  await assert.rejects(execute(["--comparar", "--finales"]), /no se combina/);
});

type ComparisonReport = {
  readonly provenance: {
    readonly source: string;
    readonly publications: readonly {
      readonly providerId: string;
      readonly origin: "original_canonico" | "reconstruccion_publicada";
      readonly publishedProducts: number;
    }[];
  };
  readonly editorial: { readonly providers: readonly unknown[] };
  readonly editorialPrepared: { readonly providers: readonly unknown[] };
  readonly priorities: DescriptionPriorities;
  readonly technicalDensity: {
    readonly totals: { readonly products: number; readonly sparse: number; readonly medium: number };
    readonly providers: readonly { readonly providerId: string; readonly products: number; readonly sparse: number; readonly medium: number; readonly median: number }[];
    readonly cases: readonly { readonly providerId: string; readonly reference: string | null; readonly technicalCount: number; readonly priority: "alta" | "media" }[];
    readonly mediumCases: readonly { readonly priority: "alta" | "media" }[];
  };
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
    "source" in value.provenance && "publications" in value.provenance && Array.isArray(value.provenance.publications) &&
    "providers" in value.editorial && "providers" in value.editorialPrepared &&
    "priorities" in value && typeof value.priorities === "object" && value.priorities !== null &&
    "totals" in value.priorities && "pending" in value.priorities && "resolved" in value.priorities &&
    "technical" in value.priorities && "technicalDensity" in value && typeof value.technicalDensity === "object" &&
    value.technicalDensity !== null && "totals" in value.technicalDensity && "providers" in value.technicalDensity &&
    "cases" in value.technicalDensity;
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
  assert.equal(comparison.technicalSpecs.totals.canonicalOriginals +
    comparison.technicalSpecs.totals.reconstructedSources, comparison.technicalSpecs.totals.products);
  assert.equal(comparison.technicalSpecs.totals.reconstructedSources,
    comparison.provenance.publications.filter((item) => item.origin === "reconstruccion_publicada")
      .reduce((total, item) => total + item.publishedProducts, 0));
  assert.equal(comparison.technicalSpecs.totals.pendingPublication,
    comparison.technicalSpecs.cases.filter((item) => item.stage === "pendiente_publicacion").length);
  assert.ok(comparison.technicalSpecs.totals.observationalMissing > 0);
  assert.equal(comparison.technicalSpecs.totals.accreditedReconciliations,
    comparison.technicalSpecs.cases.filter((item) => item.stage === "reconciliacion_acreditada").length);
  await assert.rejects(execute(["--finales", "--specs"]), /requiere --comparar/);
});


test("el cierre operativo exige evidencia, distingue trabajo real y no bloquea por observaciones", async () => {
  const comparison = await readBaselineComparison();
  assert.ok(isSpecificationComparisonReport(comparison));
  const { coverage, priorities, technicalSpecs } = comparison;
  assert.equal(hasCompleteCatalogAuditEvidence(coverage, technicalSpecs), false);
  assert.equal(hasUnresolvedCatalogAuditContracts(coverage, priorities, technicalSpecs),
    priorities.totals.technical > 0 || technicalSpecs.totals.sourceNotPreserved > 0 ||
    technicalSpecs.totals.lostAfterPublication > 0 || technicalSpecs.totals.ambiguousNormalization > 0 ||
    technicalSpecs.totals.pendingPublication > 0);

  const cleanPriorities = { ...priorities, totals: { ...priorities.totals, technical: 0 } };
  const completeSpecifications = {
    ...technicalSpecs, totals: {
      ...technicalSpecs.totals, canonicalOriginals: technicalSpecs.totals.products, reconstructedSources: 0,
      pendingPublication: 0, sourceNotPreserved: 0, lostAfterPublication: 0, ambiguousNormalization: 0
    }
  };
  assert.equal(hasUnresolvedCatalogAuditContracts(coverage, cleanPriorities, completeSpecifications), false);
  assert.equal(hasCompleteCatalogAuditEvidence(coverage, completeSpecifications), true);
  assert.ok(formatCatalogAuditClosureReport(coverage, cleanPriorities, completeSpecifications)
    .some((line) => line.includes("CONFORME EN ALCANCE COMPARADO")));

  const observations = {
    ...completeSpecifications, totals: {
      ...completeSpecifications.totals, observationalMissing: completeSpecifications.totals.observationalMissing + 100
    }
  };
  assert.equal(hasUnresolvedCatalogAuditContracts(coverage, cleanPriorities, observations), false);
  assert.ok(formatCatalogAuditClosureReport(coverage, cleanPriorities, observations)
    .some((line) => line.includes("CONFORME EN ALCANCE COMPARADO")));

  const regression = { ...completeSpecifications, totals: { ...completeSpecifications.totals, sourceNotPreserved: 1 } };
  assert.equal(hasUnresolvedCatalogAuditContracts(coverage, cleanPriorities, regression), true);
  assert.ok(formatCatalogAuditClosureReport(coverage, cleanPriorities, regression)
    .some((line) => line.includes("REQUIERE INTERVENCIÓN")));
  assert.equal(hasUnresolvedCatalogAuditContracts(coverage, cleanPriorities, completeSpecifications), false);

  const limitedSpecifications = {
    ...completeSpecifications, totals: {
      ...completeSpecifications.totals, canonicalOriginals: technicalSpecs.totals.canonicalOriginals,
      reconstructedSources: technicalSpecs.totals.reconstructedSources
    }
  };
  assert.equal(hasUnresolvedCatalogAuditContracts(coverage, cleanPriorities, limitedSpecifications), false);
  assert.equal(hasCompleteCatalogAuditEvidence(coverage, limitedSpecifications), false);
  assert.ok(formatCatalogAuditClosureReport(coverage, cleanPriorities, limitedSpecifications)
    .some((line) => line.includes("ALCANCE LIMITADO")));
  const missingDescription = {
    ...coverage, totals: {
      ...coverage.totals,
      pending: { ...coverage.totals.pending, description_general: 1 }
    }
  };
  assert.equal(hasUnresolvedCatalogAuditContracts(missingDescription, cleanPriorities, completeSpecifications), true);
  const technicalPreparation = { ...cleanPriorities, totals: { ...cleanPriorities.totals, technical: 1 } };
  assert.equal(hasUnresolvedCatalogAuditContracts(coverage, technicalPreparation, completeSpecifications), true);

  const text = await executeBaseline(["--comparar", "--specs", "--top", "1"]);
  const expected = hasUnresolvedCatalogAuditContracts(coverage, priorities, technicalSpecs) ?
    "REQUIERE INTERVENCIÓN" : hasCompleteCatalogAuditEvidence(coverage, technicalSpecs) ?
      "CONFORME EN ALCANCE COMPARADO" : "ALCANCE LIMITADO";
  assert.ok(text.includes(`CIERRE AUDITOR | ${expected}`));
});
