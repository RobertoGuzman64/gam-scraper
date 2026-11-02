import type { PreparationWorkSummary } from "../../catalog/diagnostics/preparation-work.js";

export const formatPreparationWork = (summary: PreparationWorkSummary, simulated: boolean): readonly string[] => {
  const lines = [
    `EQUIPZILLA | TRABAJO ${simulated ? "SIMULADO" : "REALIZADO"}`,
    `  Máquinas procesadas: ${summary.processedProducts}`,
    `  Máquinas transformadas: ${summary.transformedProducts}`
  ];
  const metrics: readonly [string, number][] = [
    ["Especificaciones incorporadas", summary.specificationsAdded],
    ["Claves técnicas renombradas", summary.specificationsRenamed],
    ["Valores técnicos formateados", summary.specificationValuesFormatted],
    ["Valores técnicos transformados", summary.specificationValuesChanged],
    ["Descripciones generadas", summary.descriptionsGenerated],
    ["Descripciones transformadas", summary.descriptionsTransformed],
    ["Títulos transformados", summary.titlesTransformed]
  ];
  for (const [label, count] of metrics) if (count > 0) lines.push(`  ${label}: ${count}`);
  if (summary.specificationsAdded > 0) lines.push("  Incorporadas = altas observadas; recuperación de evidencia no acreditada");
  return lines;
};
