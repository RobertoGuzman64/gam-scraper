import type { AccreditationIssue } from "../../../catalog/editorial/campaign-accreditation.js";

export const formatAccreditationIssues = (issues: readonly AccreditationIssue[], detailed: boolean): readonly string[] => {
  if (detailed) return issues.map((issue) =>
    `  PENDIENTE | ${issue.providerId ? `${issue.providerId}:` : ""}${issue.reference || "global"} | ${issue.message}`);
  const grouped = new Map<string, { providerId: string; reference: string; messages: string[] }>();
  for (const issue of issues) {
    const key = `${issue.providerId}:${issue.reference}`;
    const existing = grouped.get(key);
    if (existing) existing.messages.push(issue.message);
    else grouped.set(key, { providerId: issue.providerId, reference: issue.reference, messages: [issue.message] });
  }
  return Array.from(grouped.values(), ({ providerId, reference, messages }) => {
    const id = providerId ? `${providerId}:${reference}` : "global";
    return `  PENDIENTE | ${id} | ${messages.length === 1 ? messages[0] : `${messages.length} requisitos sin completar (usar --detalle)`}`;
  });
};
