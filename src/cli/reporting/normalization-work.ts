import type { NormalizationStatistics } from "../../tools/gam/normalization/normalize-rows.js";

export const formatNormalizationWork = (statistics: NormalizationStatistics): readonly string[] => {
  const lines = [
    "EQUIPZILLA | TRABAJO REALIZADO | NORMALIZACIÓN CSV GAM",
    `  Filas procesadas: ${statistics.rowsProcessed}`,
    `  Filas transformadas: ${statistics.rowsTransformed}`
  ];
  if (statistics.renamedKeysTotal > 0) lines.push(`  Claves técnicas renombradas: ${statistics.renamedKeysTotal}`);
  if (statistics.technicalValuesTransformed > 0) lines.push(`  Valores técnicos transformados: ${statistics.technicalValuesTransformed}`);
  return lines;
};
