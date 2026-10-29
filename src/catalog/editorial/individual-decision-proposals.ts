import type { CampaignAccreditation } from "./campaign-accreditation.js";

const isSourceUrlUsable = (sourceUrl: string): boolean => {
  try { return new URL(sourceUrl).protocol === "https:"; }
  catch { return false; }
};

const isSerialConflict = (issue: string): boolean =>
  issue.startsWith("Número de serie ") && issue.includes(" compartido por referencias ") &&
  issue.endsWith("; revisar identidad de origen");

const isIdentityIssue = (issue: string): boolean =>
  isSerialConflict(issue) || issue.startsWith("Stock GAM diferenciado: ");

const isIdentityExclusion = (entry: CampaignAccreditation["exclusions"][number]): boolean =>
  entry.status === "identity" || (entry.status === "review" &&
    entry.issues.some(isSerialConflict) && entry.issues.every(isIdentityIssue));

export const proposeIndividualExclusions = (draft: CampaignAccreditation): CampaignAccreditation => ({
  ...draft,
  exclusions: draft.exclusions.map((item) => {
    if (!isIdentityExclusion(item) || item.decision !== null || item.reason !== null ||
      item.evidenceUrls.length > 0 || item.issues.length === 0 || !isSourceUrlUsable(item.sourceUrl)) {
      return item;
    }
    return {
      ...item,
      decision: "excluir",
      reason: `Exclusión propuesta por incidencias documentadas en la preparación: ${item.issues.join("; ")}`,
      evidenceUrls: [item.sourceUrl]
    };
  })
});
