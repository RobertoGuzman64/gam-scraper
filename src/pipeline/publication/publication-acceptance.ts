import type { ImportCandidate } from "../../catalog/legacy-export/contracts.js";
import type { PublicationDifference } from "./publication-contracts.js";
import { reconcileRemovedSpecifications } from "./specification-reconciliations.js";

export type PublicationAcceptance = {
  readonly accepted: boolean;
  readonly blockers: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isUnavailableGamHorometer = (value: string): boolean =>
  /^na(?:\s+[a-z]\d{8,20})?\s+horas$/iu.test(value.trim());

const isHttps = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
};

const isApprovedGamIndividual = (providerId: string, approval: unknown): approval is Record<string, unknown> => {
  if (providerId !== "gam" || !isRecord(approval) || approval.version !== 1 || approval.approved !== true ||
    typeof approval.runId !== "string" || !/^individual-gam-[a-f0-9]{32}$/.test(approval.runId) ||
    typeof approval.approvalReason !== "string" || approval.approvalReason.trim().length < 15 ||
    !Array.isArray(approval.sources) || approval.sources.length !== 1 ||
    !isRecord(approval.sources[0]) || approval.sources[0].providerId !== providerId ||
    typeof approval.sources[0].catalogSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(approval.sources[0].catalogSha256) ||
    typeof approval.sources[0].preparationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(approval.sources[0].preparationSha256) ||
    !Array.isArray(approval.exclusions)) return false;
  return true;
};

const approvedIndividualExclusions = (
  providerId: string, approval: unknown, previousProducts: readonly ImportCandidate[]
): ReadonlySet<string> => {
  if (!isApprovedGamIndividual(providerId, approval) || !Array.isArray(approval.exclusions)) return new Set();
  const originals = new Map<string, ImportCandidate>();
  for (const product of previousProducts) {
    const reference = product.reference?.trim().toLowerCase();
    if (reference) originals.set(reference, product);
  }
  const approved = new Set<string>();
  for (const candidate of approval.exclusions) {
    if (!isRecord(candidate) || candidate.providerId !== providerId ||
      typeof candidate.reference !== "string" || candidate.decision !== "excluir" ||
      (candidate.status !== "review" && candidate.status !== "identity") ||
      typeof candidate.reason !== "string" || candidate.reason.trim().length < 15 ||
      !isHttps(candidate.sourceUrl) || !Array.isArray(candidate.evidenceUrls) ||
      !candidate.evidenceUrls.every(isHttps) || !candidate.evidenceUrls.includes(candidate.sourceUrl) ||
      !Array.isArray(candidate.issues) || candidate.issues.length === 0 ||
      !candidate.issues.every((issue: unknown) => typeof issue === "string" && issue.trim().length > 0)) continue;
    const reference = candidate.reference.trim().toLowerCase();
    if (originals.get(reference)?.sourceUrl === candidate.sourceUrl) approved.add(`ref:${reference}`);
  }
  return approved;
};

export const evaluatePublicationDifference = (difference: PublicationDifference): PublicationAcceptance => {
  const blockers: string[] = [];
  if (difference.removed.length) blockers.push(`Fichas retiradas: ${difference.removed.join(", ")}`);
  if (difference.lostDescriptions.length) {
    blockers.push(`Descripciones vaciadas: ${difference.lostDescriptions.join(", ")}`);
  }
  if (difference.removedSpecifications.length) {
    blockers.push(`Especificaciones retiradas sin equivalencia acreditada: ${difference.removedSpecifications.join(", ")}`);
  }
  if (difference.lostSpecificationValues.length) {
    blockers.push(`Valores técnicos vaciados: ${difference.lostSpecificationValues.join(", ")}`);
  }
  if (difference.changedSources.length) {
    blockers.push(`Identidad de origen modificada: ${difference.changedSources.join(", ")}`);
  }
  return { accepted: blockers.length === 0, blockers };
};

export const evaluateIndividualPublicationDifference = (
  providerId: string,
  difference: PublicationDifference,
  previousProducts: readonly ImportCandidate[],
  nextProducts: readonly ImportCandidate[],
  approval: unknown
): PublicationAcceptance => {
  const exclusions = approvedIndividualExclusions(providerId, approval, previousProducts);
  const published = new Map<string, ImportCandidate>();
  const next = new Map<string, ImportCandidate>();
  for (const product of previousProducts) {
    const reference = product.reference?.trim().toLowerCase();
    if (reference) published.set(`ref:${reference}`, product);
  }
  for (const product of nextProducts) {
    const reference = product.reference?.trim().toLowerCase();
    if (reference) next.set(`ref:${reference}`, product);
  }
  const removed = difference.removed.filter((identity) => !exclusions.has(identity));
  const remainingSpecifications = reconcileRemovedSpecifications(providerId, difference, previousProducts, nextProducts).unresolved;
  const removedSpecifications = remainingSpecifications.filter((item) => {
    if (!isApprovedGamIndividual(providerId, approval)) return true;
    const separator = item.lastIndexOf(":");
    if (separator < 0 || item.slice(separator + 1) !== "Horómetro") return true;
    const identity = item.slice(0, separator);
    const original = published.get(identity);
    const prepared = next.get(identity);
    const reading = original?.spec["Horómetro"];
    return !original || !prepared || typeof reading !== "string" ||
      !isUnavailableGamHorometer(reading) || Object.hasOwn(prepared.spec, "Horómetro");
  });
  return evaluatePublicationDifference({ ...difference, removed, removedSpecifications });
};

export class PublicationAcceptanceError extends Error {
  constructor(readonly blockers: readonly string[]) {
    super(`Activación bloqueada: ${blockers.join("; ")}`);
    this.name = "PublicationAcceptanceError";
  }
}
