import type { PanelProviderEvidence } from "../evidence/types.js";
import type { AuditEntry, SpecAdditionAudit } from "../evidence/spec-addition-audit.js";
import type { PanelFieldDifference, PanelSpecAddition } from "./types.js";
export { loadSpecAdditionAudit } from "../evidence/spec-addition-audit.js";
export type { SpecAdditionAudit } from "../evidence/spec-addition-audit.js";

export const classifySpecAdditions = (
  changes: readonly PanelFieldDifference[], provider: PanelProviderEvidence,
  reference: string | null, sourceUrl: string, audit: SpecAdditionAudit | null
): readonly PanelSpecAddition[] => {
  const cut = audit?.cuts[provider.providerId];
  const validCut = cut !== undefined && provider.original.status === "verified" &&
    cut.originalSha256 === provider.original.artifact.sha256 &&
    cut.publicationSha256 === provider.publication.sha256;
  const found = new Map<string, AuditEntry>();
  if (validCut && audit) {
    for (const entry of audit.entries) {
      if (entry.providerId === provider.providerId && entry.reference === reference && entry.sourceUrl === sourceUrl) {
        found.set(entry.field, entry);
      }
    }
  }
  return changes.filter((difference) => difference.group === "technical" && difference.change === "added")
    .map((difference): PanelSpecAddition => {
      const entry = found.get(difference.field);
      return { field: difference.field, value: difference.after ?? "",
        kind: entry && entry.value === difference.after ? entry.kind : "pending" };
    });
};
