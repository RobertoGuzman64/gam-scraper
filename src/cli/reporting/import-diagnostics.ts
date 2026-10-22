import type { PreparedProduct } from "../../catalog/import/preparation/contracts.js";
import { buildImportDiagnostics } from "../../catalog/import/preparation/import-diagnostics.js";

export const formatImportDiagnostics = (products: readonly PreparedProduct[]): readonly string[] => {
  if (products.some((entry) => entry.importIssues === undefined)) {
    return ["  Elegibilidad Excel/create-many: no registrada en este informe histórico; generar preparación actual para evaluarla"];
  }
  const diagnostics = buildImportDiagnostics(products);
  const lines: string[] = [];
  for (const receiver of ["excel", "createMany"] as const) {
    const result = diagnostics[receiver];
    lines.push(`  Importación ${receiver === "excel" ? "Excel" : "create/many"}: ${result.eligible} elegibles | ${result.blocked} bloqueados (${result.blockedByQuality} por calidad; ${result.blockedByContractOnly} solo por contrato)`);
    for (const issue of result.issues.slice(0, 12)) {
      lines.push(`    [${issue.code}] ${issue.classification} | ${issue.affected} fichas | solo en receptor: ${issue.only} | refs: ${issue.examples.join(", ")}`);
    }
    if (result.issues.length > 12) lines.push(`    ${result.issues.length - 12} motivos adicionales disponibles en el JSON de diagnósticos`);
  }
  return lines;
};
