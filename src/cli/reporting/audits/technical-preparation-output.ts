import type { ContentGapCampaigns } from "../../../catalog/diagnostics/coverage/content-gap-campaigns.js";
import type { GapPopulation } from "../../../catalog/diagnostics/coverage/content-gap-population.js";
import type { analyzePreparedSpecificationStage, compareSpecificationStages } from "../../../catalog/diagnostics/coverage/specification-stages.js";
import { printReportLine } from "../terminal.js";

type Stage = ReturnType<typeof analyzePreparedSpecificationStage>;

export const printTechnicalPreparation = (report: {
  readonly matched: Stage;
  readonly current: { readonly coverage: { readonly requested: number; readonly evaluated: number; readonly incompleteSource: number; readonly errors: number }; readonly report: Stage | null };
  readonly comparison?: ReturnType<typeof compareSpecificationStages>;
}): void => {
  const printStage = (label: string, stage: Stage): void => {
    const { population, technicalDensity, technicalSemantics, specificationImprovements, technicalOpportunities } = stage;
    printReportLine(`${label} | fichas ${population.products} | ready ${population.ready} | review ${population.review} | bajo objetivo ${technicalDensity.target.below} | faltantes al mínimo ${technicalDensity.target.missing}`);
    const richness = technicalDensity.richness.totals;
    printReportLine(`${label} | riqueza mediana ${richness.p50 ?? "n/d"} | alias acreditados ${richness.accreditedRedundancyProducts} fichas | posibles ${richness.possibleRedundancyProducts} | conflictos ${richness.conflictingAliasProducts} | no interpretables ${richness.unresolvedProducts} | cobertura esencial no observada ${richness.essentialUnobservedProducts} fichas | no evaluable ${richness.essentialNotEvaluableProducts}`);
    if (specificationImprovements && technicalSemantics && technicalOpportunities) {
      printReportLine(`${label} | avisos orientativos ${specificationImprovements.totals.totalPending} | cobertura ${specificationImprovements.totals.coveragePending} | diferenciación ${specificationImprovements.totals.differentiationPending} | señales semánticas ${technicalSemantics.totals.findings} | oportunidades con pista propia ${technicalOpportunities.totals.sourceEvidence}`);
      const value = technicalOpportunities.value;
      printReportLine(`${label} | oportunidades de valor: ${value.totals.productsWithSignals} fichas / ${value.totals.occurrences} señales | con seis o más ${value.totals.atOrAboveMinimumProducts} | ${value.totals.byEvidence.map((item) => `${item.evidence} ${item.occurrences}`).join(" | ")}`);
    }
  };
  printReportLine("DENSIDAD Y AVISOS | los bloques históricos corresponden a publicaciones; las vistas preparadas no heredan excepciones publicadas");
  printStage("PREPARACIÓN CONCILIADA", report.matched);
  const coverage = report.current.coverage;
  printReportLine(`PREPARACIÓN DE ORIGEN VIGENTE | proveedores ${coverage.evaluated}/${coverage.requested} | fuentes ausentes ${coverage.incompleteSource} | errores ${coverage.errors}`);
  if (report.current.report) printStage("PREPARACIÓN DE ORIGEN VIGENTE", report.current.report);
  if (report.comparison) {
    const totals = report.comparison.totals;
    printReportLine(`COMPARACIÓN DE AVISOS | persisten ${totals.persiste} | resueltos en preparación ${totals.resuelto_en_preparacion} | aparecidos en preparación ${totals.aparecido_en_preparacion} | no comparables ${totals.no_comparable} | detalle íntegro en --json`);
  }
};

export const printGapPopulation = (label: string, population: GapPopulation): void => {
  const { totals } = population;
  printReportLine(`${label} | proveedores ${population.processed.length}/${population.selected.length} | fichas evaluadas ${totals.evaluated} | elegibles ${totals.eligible ?? "no determinado"} | no evaluadas conocidas ${totals.knownNotEvaluated} | ${population.complete ? "alcance evaluado" : "alcance limitado"}`);
  for (const provider of population.providers) {
    if (provider.state !== "evaluado") printReportLine(`  ${provider.providerId.toUpperCase()} | ${provider.state} | ${provider.evaluated}/${provider.eligible ?? "?"}${"detail" in provider && provider.detail ? ` | ${provider.detail}` : ""}`);
  }
};

export const printContentGapCampaigns = (report: ContentGapCampaigns, limit: number, detailed: boolean): void => {
  const { totals } = report;
  printReportLine(`CAMPAÑAS | preparación vigente ${report.evaluated} fichas | análisis técnico de oportunidades ${report.technicalEvaluated ?? "no solicitado"} | cola de contraste ${totals.actionable.products} fichas / ${totals.actionable.occurrences} señales`);
  printReportLine(`CAMPAÑAS | ${totals.products} fichas únicas / ${totals.occurrences} señales | ${totals.byClassification.map((item) => `${item.classification} ${item.products}/${item.occurrences}`).join(" | ")}`);
  for (const group of report.groups.filter((item) => item.actionable).slice(0, limit)) {
    printReportLine(`  ${group.domain} | ${group.classification} | ${group.family ?? "familia no acreditada"} | ${group.field} | ${group.evidenceType} | ${group.products} fichas / ${group.occurrences} señales | ${group.providers.map((item) => `${item.providerId}:${item.products}`).join(" · ")}`);
    if (detailed) for (const item of group.cases.slice(0, limit)) printReportLine(`    ${item.identity} | ${item.reason}`);
  }
  printReportLine("CAMPAÑAS | grupos y ocurrencias íntegros en --json; señales no accionables y materialización separadas");
};
