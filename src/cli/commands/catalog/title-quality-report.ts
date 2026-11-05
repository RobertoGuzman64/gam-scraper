import type { TitleQuality } from "../../../catalog/diagnostics/title-quality.js";

export const formatTitleQualityReport = (report: TitleQuality, limit: number): readonly string[] => {
  const { totals } = report;
  const lines = [
    `TÍTULOS | fichas ${totals.products} | señaladas ${totals.affected} | pendientes ${totals.pending} | resueltas por preparación ${totals.resolved} | aparecidas ${totals.appeared}`,
    report.note
  ];
  for (const provider of report.providers) {
    lines.push(`TÍTULOS PROVEEDOR | ${provider.providerId} | ${provider.affected}/${provider.products} fichas | pendientes ${provider.pending} | resueltas ${provider.resolved} | aparecidas ${provider.appeared}`);
  }
  lines.push(`TÍTULOS CASOS | TOP ${Math.min(limit, report.cases.length)} de ${report.cases.length} fichas | detalle íntegro en --json`);
  for (const item of report.cases.slice(0, limit)) {
    lines.push(`${item.providerId} | ${item.reference ?? item.identity} | ${item.findings.map((finding) => `${finding.priority}:${finding.code}:${finding.stage}`).join(", ")}`);
    lines.push(`  Original: ${item.originalTitle ?? "(sin título)"}`);
    lines.push(`  Publicado: ${item.publishedTitle ?? "(sin título)"}`);
    lines.push(`  Preparado: ${item.preparedTitle ?? "(sin título)"}`);
    for (const finding of item.findings) lines.push(`  Evidencia ${finding.code}: ${finding.evidence}`);
    lines.push(`  Fuente: ${item.origin} | ${item.url}`);
  }
  return lines;
};
