import type { SpecificationImprovementAudit } from "../../../catalog/diagnostics/specification-improvement.js";

export const formatSpecificationImprovementReport = (
  audit: SpecificationImprovementAudit, limit: number, detailed: boolean
): readonly string[] => {
  const totals = audit.totals;
  const lines = [
    `AVISOS SPECS | pendientes ${totals.totalPending} | mínimo ${audit.criteria.minimumTechnicalSpecs}: ${totals.coveragePending} | diferenciación: ${totals.differentiationPending} | excepciones justificadas: ${totals.controlledExceptions} | excepciones caducadas: ${totals.staleExceptions}`,
    `PRIORIDAD SPECS | P1 construcción/elevación: ${totals.priorityP1} | P2 maquinaria industrial: ${totals.priorityP2} | P3 resto: ${totals.priorityP3} | familias prioritarias: ${totals.analyzedPriorityFamilies}/${totals.products} fichas`
  ];
  for (const family of audit.families) {
    lines.push(`FAMILIA SPECS | ${family.priority} | ${family.name} | pendientes ${family.pending} (mínimo 6: ${family.coverage}; diferenciación: ${family.differentiation}) | fichas ${family.products}`);
  }
  lines.push(`CAMPAÑAS SPECS | ${audit.campaigns.length} grupos accionables por subfamilia, proveedor y prestación`);
  for (const campaign of audit.campaigns.slice(0, detailed ? audit.campaigns.length : limit)) {
    lines.push(`  ${campaign.priority} | ${campaign.providerId} | ${campaign.family} | ${campaign.kind} | ${campaign.field} | ${campaign.pending} avisos`);
    if (detailed) lines.push(`    Referencias: ${campaign.references.join(", ")}`);
  }
  lines.push(totals.totalPending === 0 && totals.staleExceptions === 0 ?
    "CIERRE DE MEJORA SPECS | CONFORME: cero avisos pendientes y cero excepciones caducadas" :
    `CIERRE DE MEJORA SPECS | ABIERTO: ${totals.totalPending} avisos pendientes y ${totals.staleExceptions} excepciones caducadas`);
  if (detailed) {
    const pending = audit.cases.filter((item) => item.status === "pendiente");
    lines.push(`COLA AVISOS SPECS | TOP ${Math.min(limit, pending.length)} de ${pending.length} pendientes; cola íntegra en --json`);
    for (const item of pending.slice(0, limit)) {
      lines.push(`  ${item.priority} | ${item.kind} | ${item.providerId} ${item.reference ?? "sin referencia"} | ${item.family ?? "cobertura general"} | ${item.field} | ${item.technicalCount}/${audit.criteria.minimumTechnicalSpecs}`);
      lines.push(`    ${item.url} | id ${item.id} | huella ${item.fingerprint}${item.evidence ? ` | evidencia ${item.evidence.kind} ${item.evidence.observed}/${item.evidence.comparable}` : ""}`);
    }
    for (const item of audit.staleExceptions) lines.push(`EXCEPCIÓN CADUCADA | ${item.id}`);
    lines.push(`AVISOS SPECS CRITERIO | ${audit.note}`);
  } else lines.push("AVISOS SPECS | Consultar --detalle o --json para todos los casos y sus evidencias");
  return lines;
};
