import type { PreparedProduct } from "../../catalog/import/prepare.js";

const MAX_EXAMPLES = 3;

export const formatReviewDiagnostics = (products: readonly PreparedProduct[]): readonly string[] => {
  const groups = new Map<string, { count: number; only: number; references: string[] }>();
  let reviewed = 0;
  let single = 0;
  let multiple = 0;
  let withoutReasons = 0;
  let incidences = 0;

  for (const entry of products) {
    if (entry.status !== "review") continue;
    reviewed += 1;
    const reasons = [...new Set(entry.issues)];
    incidences += reasons.length;
    if (reasons.length === 0) withoutReasons += 1;
    else if (reasons.length === 1) single += 1;
    else multiple += 1;

    for (const reason of reasons) {
      const group = groups.get(reason) ?? { count: 0, only: 0, references: [] };
      group.count += 1;
      if (reasons.length === 1) group.only += 1;
      if (group.references.length < MAX_EXAMPLES) {
        group.references.push(entry.product.reference?.trim() || entry.product.sourceUrl);
      }
      groups.set(reason, group);
    }
  }

  if (reviewed === 0) return [];

  const lines = [
    `  Diagnóstico review: ${reviewed} fichas | 1 motivo: ${single} | 2+ motivos: ${multiple} | sin motivo: ${withoutReasons} | incidencias: ${incidences}`,
    "  Motivos (fichas únicas por motivo; solo = único bloqueo; con otros = bloqueo simultáneo):"
  ];
  const sorted = [...groups].sort(([leftReason, left], [rightReason, right]) =>
    right.count - left.count || leftReason.localeCompare(rightReason, "es"));
  for (const [reason, group] of sorted) {
    lines.push(`    ${reason || "(motivo sin texto)"} | ${group.count} ${group.count === 1 ? "ficha" : "fichas"} | solo: ${group.only} | con otros: ${group.count - group.only} | refs: ${group.references.join(", ")}`);
  }
  lines.push("  Causa de los bloqueos: no determinada por estos motivos; contrastar origen, CSV y contrato antes de corregir.");
  return lines;
};
