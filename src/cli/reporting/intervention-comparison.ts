import type { InterventionComparison } from "../../catalog/interventions/comparison.js";

const states = {
  pending: "PENDIENTE",
  corrected: "CORREGIDA EN ORIGEN",
  absent: "AUSENTE",
  partial: "PARCIAL",
  divergent: "DIVERGENTE"
} as const;

export const formatInterventionComparison = (comparison: InterventionComparison): string => {
  const lines = ["COMPARACIÓN DE INTERVENCIONES | Solo lectura"];
  for (const script of comparison.scripts) {
    lines.push(`  ${script.script} | ${states[script.status]}`);
    for (const { proposal, status, actual } of script.fields) {
      lines.push(`    ${proposal.identity} | ${proposal.field} | ${states[status]}`);
      if (status === "divergent") {
        lines.push(`      Actual: ${JSON.stringify(actual)} | Esperado: ${JSON.stringify(proposal.expected)} | Propuesto: ${JSON.stringify(proposal.next)}`);
      }
    }
  }
  lines.push(`  Campos pendientes aplicables: ${comparison.pending.length}`);
  if (comparison.blocked) lines.push("  BLOQUEADO | Revisar divergencias o correcciones parciales antes de aplicar");
  return lines.join("\n");
};
