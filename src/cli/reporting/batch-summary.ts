import type { BatchReport } from "../../pipeline/batch/report.js";
import { formatStatus } from "./terminal.js";
import type { TerminalStatus } from "./terminal.js";

const duration = (ms: number): string => `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;

export const formatBatchSummary = (report: BatchReport, reportFile: string): readonly string[] => {
  const successful = report.providers.filter((provider) => provider.status === "complete");
  const total = successful.reduce((count, provider) => count + (provider.products ?? 0), 0);
  const statuses: Readonly<Record<BatchReport["status"], { readonly label: string; readonly status: TerminalStatus }>> = {
    running: { label: "EN CURSO", status: "RUN" },
    complete: { label: "COMPLETO", status: "PASS" },
    partial: { label: "PARCIAL", status: "WARN" },
    failed: { label: "ERROR", status: "FAIL" }
  };
  const lines = [
    `\n${formatStatus(statuses[report.status].status, `LOTE | ${statuses[report.status].label} | ${successful.length}/${report.requestedProviders.length} proveedores`)}`,
    `  Productos únicos por proveedor (suma): ${total}`
  ];
  for (const provider of report.providers) {
    if (provider.status === "complete") {
      lines.push(`  ${formatStatus("PASS", `${provider.providerId.toUpperCase()} | ${provider.products ?? 0} productos | +${provider.added ?? 0} nuevos | ${provider.updated ?? 0} cambios | ${duration(provider.durationMs)}`)}`);
    } else {
      lines.push(`  ${formatStatus("FAIL", `${provider.providerId.toUpperCase()} | ${duration(provider.durationMs)} | consultar diagnóstico y log`)}`);
      lines.push(`    Log: ${provider.logFile}`);
    }
  }
  lines.push(`  Informe: ${reportFile}`);
  return lines;
};
