import type { HistoricalReferenceMismatch } from "../../../infrastructure/filesystem/legacy-export/reference-integrity.js";

export const renderHistoricalReferenceMismatches = (
  mismatches: readonly HistoricalReferenceMismatch[], detailed: boolean
): readonly string[] => {
  if (!mismatches.length) return ["REFERENCIAS HISTÓRICAS | 0 discrepancias de huella"];
  const summary = `WARN | REFERENCIAS HISTÓRICAS | ${mismatches.length} ${mismatches.length === 1 ? "discrepancia" : "discrepancias"} de huella; archivos no modificados`;
  return detailed ? [summary, ...mismatches.map((item) =>
    `  ${item.path} | esperada ${item.expectedSha256} | actual ${item.actualSha256 ?? "archivo ausente o no regular"}`)]
    : [summary, "  Usa --detalle para consultar rutas y huellas"];
};
