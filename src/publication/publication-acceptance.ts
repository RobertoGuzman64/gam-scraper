import type { ImportCandidate } from "../commercial/legacy-export/contracts.js";
import type { ProductRecord } from "../contracts/catalog.js";
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

const verifiedGomarizHistoricalAbsences: Readonly<Record<string, string>> = {
  "ref:mt1579": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/manipulador-telescopico/genie-gth-2506-5/",
  "ref:te61": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/haulotte-compact-8-elevador-tijera-articulated-scissor-lift-20/",
  "ref:ba1347": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/skyjack-sj63aj-brazo-articulado-articulated-boom-lift-2/",
  "ref:5051bdx": "https://www.gomarizrent.com/venta/camion/camion-porta-maquinaria/scania-p220-camion-truck-porta-maquinaria/",
  "ref:1011jfb": "https://www.gomarizrent.com/venta/camion/camion-porta-maquinaria/renault-premium-320-26-camion-portamaquinaria/",
  "ref:gr1113": "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/himoinsa-hfw-605t-generador-generator/",
  "ref:ba1262": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/skyjack-brazo-articulado-articulated-boom-lift-sj63aj-3/",
  "ref:cae1054": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-retractil/toyota-8fbre16-carretilla-retractil-sistema-de-elevacion-gomariz/",
  "ref:ro1197": "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/rodillo-bombag-bw80ad-movimiento-de-tierras-demolicion-compactacion/",
  "ref:ro457": "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/dynapac-cc142-2/",
  "ref:te1606": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0607eii-22-tijera-electrica-scissor-lift/"
};

const reconcileHistoricalGomarizAbsences = (
  removed: readonly string[],
  previous: ReadonlyMap<string, ImportCandidate>,
  originals: readonly ProductRecord[] | undefined
): readonly string[] => {
  if (!originals || originals.length < previous.size ||
    originals.some((product) => product.providerId !== "gomariz")) return removed;
  const references = new Set(originals.flatMap((product) =>
    product.reference?.trim() ? [product.reference.trim().toLowerCase()] : []));
  const sourceUrls = new Set(originals.map((product) => product.url));
  return removed.filter((identity) => {
    const sourceUrl = verifiedGomarizHistoricalAbsences[identity];
    if (!sourceUrl || previous.get(identity)?.sourceUrl !== sourceUrl) return true;
    const reference = identity.slice("ref:".length);
    return references.has(reference) || sourceUrls.has(sourceUrl);
  });
};

export const evaluateIndividualPublicationDifference = (
  providerId: string,
  difference: PublicationDifference,
  previousProducts: readonly ImportCandidate[],
  nextProducts: readonly ImportCandidate[],
  approval: unknown,
  originalProducts?: readonly ProductRecord[]
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
  const excluded = difference.removed.filter((identity) => !exclusions.has(identity));
  const removed = providerId === "gomariz"
    ? reconcileHistoricalGomarizAbsences(excluded, published, originalProducts) : excluded;
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
