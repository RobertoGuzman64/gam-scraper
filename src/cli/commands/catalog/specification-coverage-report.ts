import { classifySpecificationWork, type SpecificationCoverage, type SpecificationCase } from "../../../catalog/diagnostics/specification-coverage.js";

const formatCase = (item: SpecificationCase, label: string): string =>
  `  ${label} | ${item.stage} | ${item.providerId} | ${item.family} | ${item.reference ?? item.identity} | ${item.key} | ${item.origin}`;

export const formatSpecificationCoverageReport = (coverage: SpecificationCoverage, limit: number, detailed = false): readonly string[] => {
  const totals = coverage.totals;
  const { requiresReview, pendingActivation } = classifySpecificationWork(coverage);
  const unusableSources = coverage.cases.filter((item) => item.stage === "reconciliacion_acreditada" &&
    item.reconciliation?.classification === "origen_no_utilizable").length;
  const verifiedTransformations = totals.accreditedReconciliations - unusableSources;
  const lines = [
    `SPECS | revisar ${requiresReview.length} | pendientes de activar ${pendingActivation.length} | reconciliaciones acreditadas ${totals.accreditedReconciliations} (origen no utilizable ${unusableSources}, transformación acreditada ${verifiedTransformations}) | hipótesis familiares solo en --detalle o --json`,
    `SPECS | originales canónicos ${totals.canonicalOriginals} | fuentes reconstruidas ${totals.reconstructedSources} | diferencias origen/preparación ${totals.sourceNotPreserved} | pérdidas frente al final ${totals.lostAfterPublication} | normalizaciones ambiguas ${totals.ambiguousNormalization}`
  ];
  if (requiresReview.length === 0 && pendingActivation.length === 0) {
    lines.push("SPECS | SIN INCIDENCIAS TÉCNICAS PENDIENTES DE REVISIÓN NI ACTIVACIÓN en esta comparación");
  } else if (detailed) {
    for (const item of requiresReview.slice(0, limit)) lines.push(formatCase(item, "REVISAR"));
    for (const item of pendingActivation.slice(0, Math.max(0, limit - requiresReview.length))) {
      lines.push(formatCase(item, "ACTIVACIÓN"));
    }
  }
  if (detailed) lines.push(`SPECS | ${totals.observationalMissing} observaciones familiares no obligatorias | ${coverage.patterns.length} patrones comparativos no vinculantes | ${coverage.cases.length} casos en JSON, incluidos los ${totals.observationalMissing} sin evidencia directa`);
  if (detailed) lines.push("SPECS | Una ausencia inferida de otras máquinas no obliga a completar la ficha; sin evidencia de la misma máquina no se abre una tarea.");
  if (!detailed && (requiresReview.length > 0 || pendingActivation.length > 0)) lines.push("SPECS | Diferencias y activaciones pendientes: consultar --detalle o --json");
  return lines;
};
