import type { PublishedTechnicalQuality } from "../../../catalog/diagnostics/published-technical-quality.js";

export const formatPublishedTechnicalQualityReport = (
  report: PublishedTechnicalQuality, limit: number, detailed = false
): readonly string[] => {
  const lines = [
    `VALORES TÉCNICOS | fichas ${report.totals.products} | afectadas ${report.totals.affectedProducts} | señales ${report.totals.findings} | patrones ${report.patterns.length}`,
    "VALORES TÉCNICOS | Señales para investigar, no correcciones automáticas ni bloqueos de publicación"
  ];
  if (report.patterns.length === 0) {
    lines.push("VALORES TÉCNICOS | Sin anomalías reconocidas por las reglas actuales");
    return lines;
  }
  for (const pattern of report.patterns.slice(0, limit)) {
    lines.push(`  REVISAR | prioridad ${pattern.priority} | ${pattern.providerId} | ${pattern.code} | máquinas ${pattern.products} | señales ${pattern.cases}`);
    lines.push(`    Revisar: ${pattern.responsible}`);
    lines.push(`    Acción: ${pattern.action}`);
    if (detailed) lines.push(`    Ejemplos: ${pattern.examples.join(", ")}`);
  }
  if (detailed) for (const item of report.cases.slice(0, limit)) {
    lines.push(`  CASO | ${item.providerId} | ${item.reference ?? item.url} | ${item.code} | ${item.key ?? "-"} | ${item.detail} | ${item.url}`);
  }
  if (report.patterns.length > limit || detailed && report.cases.length > limit) {
    lines.push("VALORES TÉCNICOS | Más casos disponibles en --json");
  }
  return lines;
};
