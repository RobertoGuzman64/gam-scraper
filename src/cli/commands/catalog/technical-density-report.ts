import type { TechnicalDensity } from "../../../catalog/diagnostics/technical-density.js";

export const formatTechnicalDensityReport = (density: TechnicalDensity, limit: number): readonly string[] => {
  const lines = [
    `DENSIDAD TÉCNICA | PRIORIDAD EDITORIAL | ${density.totals.sparse + density.totals.medium}/${density.totals.products} fichas con 0–${density.criteria.mediumMaximum} prestaciones estructuradas | ALTA 0–${density.criteria.sparseMaximum}: ${density.totals.sparse} | MEDIA ${density.criteria.mediumMaximum}: ${density.totals.medium}`,
    ...density.providers.map((item) => `DENSIDAD PROVEEDOR | ${item.providerId} | alta ${item.sparse} | media ${item.medium} | total ${item.sparse + item.medium}/${item.products} | mediana ${item.median} prestaciones`),
    `DENSIDAD MODELOS | TOP ${Math.min(limit, density.models.length)} de ${density.models.length} modelos con prioridad editorial`
  ];
  for (const item of density.models.slice(0, limit)) {
    lines.push(`  ${item.providerId} | ${item.brand} ${item.model} | alta ${item.sparse} | media ${item.medium} | total ${item.sparse + item.medium}/${item.products} | referencias ${item.examples.join(", ")}`);
  }
  lines.push(`DENSIDAD FICHAS | alta ${density.cases.length} | media ${density.mediumCases.length} referencias en --json, con prioridad, claves y URL`);
  lines.push(`DENSIDAD CRITERIO | ${density.note}`);
  return lines;
};
