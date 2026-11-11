import type { SpecificationOpportunities } from "../../../catalog/diagnostics/specification-opportunities.js";

export const formatSpecificationOpportunitiesReport = (
  opportunities: SpecificationOpportunities, limit: number, detailed = false
): readonly string[] => {
  const totals = opportunities.totals;
  const lines = [
    `OPORTUNIDADES SPECS | objetivo ${opportunities.criteria.minimumTechnicalSpecs} | ${totals.belowTarget} fichas por debajo | déficit orientativo ${totals.missingToTarget} prestaciones`,
    `PISTAS SPECS | preparada ${totals.preparedEvidence} | origen ${totals.sourceEvidence} | mismo modelo ${totals.sameModelEvidence} | patrón familiar ${totals.familyObservations} | sin pistas ${totals.withoutClues}`
  ];
  if (detailed) {
    lines.push(`COLA SPECS | TOP ${Math.min(limit, opportunities.cases.length)} de ${opportunities.cases.length} fichas; evidencias ordenadas, no especificaciones obligatorias`);
    for (const item of opportunities.cases.slice(0, limit)) {
      lines.push(`  ${item.evidence} | ${item.providerId} | ${item.reference ?? item.identity} | ${item.family} | ${item.technicalCount}/${opportunities.criteria.minimumTechnicalSpecs} | faltan ${item.missingToTarget}`);
      lines.push(`    Preparación: ${item.preparedKeys.join(", ") || "-"} | Origen: ${item.sourceKeys.join(", ") || "-"} | Modelo: ${item.sameModelKeys.join(", ") || "-"} | Familia: ${item.familyKeys.join(", ") || "-"}`);
      lines.push(`    ${item.title ?? "Sin título"} | ${item.url}`);
    }
    lines.push(`OPORTUNIDADES CRITERIO | ${opportunities.note}`);
  } else lines.push("OPORTUNIDADES SPECS | Consultar --detalle para la cola priorizada o --json para todas las pistas y referencias");
  return lines;
};
