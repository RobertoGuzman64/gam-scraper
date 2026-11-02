import type { InterventionWorkSummary } from "../../catalog/diagnostics/intervention-work.js";

export const formatInterventionWork = (summary: InterventionWorkSummary): readonly string[] => {
  const lines = [
    "EQUIPZILLA | TRABAJO REALIZADO | INTERVENCIÓN",
    `  Máquinas procesadas: ${summary.processedProducts}`,
    `  Máquinas transformadas: ${summary.transformedProducts}`
  ];
  const metrics: readonly [string, number][] = [
    ["Valores técnicos transformados", summary.technicalValuesTransformed],
    ["Descripciones generadas", summary.descriptionsGenerated],
    ["Descripciones transformadas", summary.descriptionsTransformed],
    ["Títulos transformados", summary.titlesTransformed],
    ["Otros campos transformados", summary.otherFieldsTransformed]
  ];
  for (const [label, count] of metrics) if (count > 0) lines.push(`  ${label}: ${count}`);
  return lines;
};
