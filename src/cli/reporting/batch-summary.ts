import type { BatchReport } from "../../pipeline/batch/report.js";

const duration = (ms: number): string => `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;

export const formatBatchSummary = (report: BatchReport, reportFile: string): readonly string[] => {
  const successful = report.providers.filter((provider) => provider.status === "complete");
  const total = successful.reduce((count, provider) => count + (provider.products ?? 0), 0);
  const statuses: Readonly<Record<BatchReport["status"], string>> = { running: "EN CURSO", complete: "COMPLETO", partial: "PARCIAL", failed: "ERROR" };
  const lines = [
    `\nLOTE | ${statuses[report.status]} | ${successful.length}/${report.requestedProviders.length} proveedores`,
    `  Productos únicos por proveedor (suma): ${total}`
  ];
  for (const provider of report.providers) {
    if (provider.status === "complete") {
      lines.push(`  ${provider.providerId}: OK | ${provider.products ?? 0} productos | +${provider.added ?? 0} nuevos | ${provider.updated ?? 0} cambios | ${duration(provider.durationMs)}`);
    } else {
      lines.push(`  ${provider.providerId}: ERROR | ${duration(provider.durationMs)} | ${provider.error ?? "Consultar log"}`);
      lines.push(`    Log: ${provider.logFile}`);
    }
  }
  lines.push(`  Informe: ${reportFile}`);
  return lines;
};
