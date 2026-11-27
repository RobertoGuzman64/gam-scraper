import type { TechnicalDensity } from "../../../../catalog/diagnostics/technical/technical-density.js";

export const formatTechnicalDensityReport = (density: TechnicalDensity, limit: number, detailed = false): readonly string[] => {
  const lines = [
    `DENSIDAD TÉCNICA | PRIORIDAD EDITORIAL | ${density.totals.sparse + density.totals.medium}/${density.totals.products} fichas con 0–${density.criteria.mediumMaximum} prestaciones estructuradas | ALTA 0–${density.criteria.sparseMaximum}: ${density.totals.sparse} | MEDIA ${density.criteria.mediumMaximum}: ${density.totals.medium}`,
    ...(detailed ? density.providers.map((item) => `DENSIDAD PROVEEDOR | ${item.providerId} | alta ${item.sparse} | media ${item.medium} | total ${item.sparse + item.medium}/${item.products} | mediana ${item.median} prestaciones`) : []),
    ...(detailed ? [`DENSIDAD MODELOS | TOP ${Math.min(limit, density.models.length)} de ${density.models.length} modelos con prioridad editorial`] : [])
  ];
  lines.push(`OBJETIVO SPECS | mínimo exploratorio ${density.target.minimum} prestaciones técnicas | ${density.target.below}/${density.totals.products} fichas por debajo | ${density.target.missing} prestaciones adicionales para alcanzar el objetivo, no acreditadas`);
  if (detailed) for (const provider of density.target.providers) {
    lines.push(`OBJETIVO PROVEEDOR | ${provider.providerId} | ${provider.below} fichas | déficit orientativo ${provider.missing}`);
  }
  if (detailed) for (const item of density.models.slice(0, limit)) {
    lines.push(`  ${item.providerId} | ${item.brand} ${item.model} | alta ${item.sparse} | media ${item.medium} | total ${item.sparse + item.medium}/${item.products} | referencias ${item.examples.join(", ")}`);
  }
  lines.push(`DENSIDAD FICHAS | alta ${density.cases.length} | media ${density.mediumCases.length} referencias en --json, con prioridad, claves y URL`);
  const richness = density.richness;
  lines.push(`RIQUEZA TÉCNICA | conceptos interpretables | P25 ${richness.totals.p25 ?? "n/d"} | mediana ${richness.totals.p50 ?? "n/d"} | P75 ${richness.totals.p75 ?? "n/d"} | baja ${richness.totals.low} | media ${richness.totals.medium} | alta ${richness.totals.high}`);
  lines.push(`REDUNDANCIA | fichas con alias acreditados ${richness.totals.accreditedRedundancyProducts} | posibles ${richness.totals.possibleRedundancyProducts} | conflictos ${richness.totals.conflictingAliasProducts} | no interpretables ${richness.totals.unresolvedProducts} | familias sin criterio ${richness.totals.withoutFamilyCriteria} | desconocidas ${richness.totals.unknownFamily} | contradictorias ${richness.totals.conflictingFamily}`);
  if (detailed) for (const family of richness.families) {
    lines.push(`RIQUEZA FAMILIA | ${family.name} | fichas ${family.products} | P25 ${family.p25 ?? "n/d"} | mediana ${family.p50 ?? "n/d"} | P75 ${family.p75 ?? "n/d"} | baja ${family.low} | media ${family.medium} | alta ${family.high}`);
  }
  lines.push(`COBERTURA ESENCIAL | ${richness.totals.essentialUnobservedProducts} fichas con declaraciones no observadas | ${richness.totals.essentialNotEvaluableProducts} con declaraciones no evaluables | orientación por familia, no carencias acreditadas`);
  if (detailed) for (const field of richness.essentialPriorities.slice(0, limit)) {
    lines.push(`  ${field.priority} | ${field.family} | ${field.label} | no observada ${field.notObserved} | observada ${field.observed} | no evaluable ${field.notEvaluable}`);
  }
  if (detailed) lines.push(`RIQUEZA CRITERIO | ${richness.note}`);
  if (detailed) lines.push(`DENSIDAD CRITERIO | ${density.note} El objetivo de 6 no es un requisito de publicación ni prueba de carencia.`);
  return lines;
};
