import { gamNewForkliftIdentityIssues } from "./gam-new-forklift-identity.js";
import { curateGamGallery } from "./gam-verified-gallery.js";
import { curateGamDescription } from "./gam-verified-description.js";
import type { ImportCandidate } from "../import/preparation/contracts.js";
import type { OfflinePreparation, PreparationSource } from "../import/preparation/offline-document.js";
import { cohorts } from "./cohorts.js";
import { exclusions, identityHolds } from "./decisions.js";
import type { EditorialExclusion, EditorialHold } from "./decisions.js";
export { isNewEditorialCohort } from "./cohorts.js";
import { isNewEditorialCohort } from "./cohorts.js";

export type PublishableSelection = {
  readonly accreditation?: {
    readonly runId: string;
    readonly approvalSha256: string;
    readonly preparationSources: readonly {
      readonly providerId: string;
      readonly preparationSha256: string;
    }[];
  };
  readonly source: readonly PreparationSource[];
  readonly totals: {
    readonly original: number;
    readonly ready: number;
    readonly review: number;
    readonly publishable: number;
    readonly excluded: number;
  };
  readonly products: readonly ImportCandidate[];
  readonly exclusions: readonly {
    readonly providerId: string;
    readonly reference: string;
    readonly sourceUrl: string;
    readonly reason: string;
    readonly evidenceUrls: readonly string[];
    readonly issues: readonly string[];
  }[];
};

export const selectPublishableCatalog = (preparations: readonly OfflinePreparation[]): PublishableSelection => {
  if (preparations.length < 3) throw new Error("Selección editorial: faltan proveedores");
  if (preparations.some((preparation) => preparation.source.intervention !== undefined)) {
    throw new Error("Selección editorial: los catálogos intervenidos requieren una autorización editorial específica; no son publicables por defecto");
  }
  const snapshots = cohorts.find((cohort) => preparations.length === Object.keys(cohort).length &&
    preparations.every((item) => cohort[item.source.providerId]?.sha256 === item.source.catalogSha256 &&
      cohort[item.source.providerId]?.count === item.source.productCount));
  if (!snapshots) throw new Error("Selección editorial: cohorte desconocida o mezclada");
  const newCohort = isNewEditorialCohort(preparations);
  const sources = new Set<string>();
  const identified = new Set<string>();
  const exclusionByKey = new Map<string, EditorialExclusion>(exclusions.map((item) => [`${item.providerId}:${item.reference}`, item]));
  const holdByKey = new Map<string, EditorialHold>(identityHolds.map((item) => [`${item.providerId}:${item.reference}`, item]));
  const foundExclusions = new Set<string>();
  const foundHolds = new Set<string>();
  const publishable: ImportCandidate[] = [];
  const excluded: PublishableSelection["exclusions"][number][] = [];
  let ready = 0;
  let review = 0;

  for (const preparation of preparations) {
    const providerId = preparation.source.providerId;
    const expected = snapshots[providerId];
    if (!expected || sources.has(providerId) || preparation.source.catalogSha256 !== expected.sha256 ||
      preparation.source.productCount !== expected.count || preparation.products.length !== expected.count ||
      preparation.totals.ready + preparation.totals.review !== expected.count) {
      throw new Error(`Selección editorial: cohorte desconocida o incompleta (${providerId})`);
    }
    sources.add(providerId);
    for (const entry of preparation.products) {
      const reference = entry.product.reference;
      const key = `${providerId}:${reference ?? ""}`;
      if (!reference || identified.has(key) || entry.product.providerId !== providerId) {
        throw new Error(`Selección editorial: referencia inválida o repetida (${key})`);
      }
      identified.add(key);
      const decision = exclusionByKey.get(key);
      const hold = holdByKey.get(key);
      const identityIssues = gamNewForkliftIdentityIssues(entry.product);
      if (entry.status === "ready") {
        ready += 1;
        if (entry.issues.length || decision) throw new Error(`Selección editorial: decisión caducada (${key})`);
        if (hold) {
          const holdUrl = newCohort ? hold.currentSourceUrl : hold.sourceUrl;
          if (entry.product.sourceUrl !== holdUrl ||
            !hold.requiredIssues.every((issue) => identityIssues.some((found) => found.includes(issue)))) {
            throw new Error(`Selección editorial: exclusión de identidad caducada (${key})`);
          }
          foundHolds.add(key);
          excluded.push({
            providerId, reference, sourceUrl: entry.product.sourceUrl,
            reason: hold.reason, evidenceUrls: newCohort ? [holdUrl] : hold.evidenceUrls, issues: identityIssues
          });
        } else {
          if (identityIssues.length) throw new Error(`Selección editorial: identidad GAM sin decisión acreditada (${key})`);
          publishable.push(newCohort
            ? curateGamDescription(curateGamGallery(entry.product))
            : entry.product);
        }
      } else {
        review += 1;
        if (hold) throw new Error(`Selección editorial: exclusión de identidad caducada (${key})`);
        if (!decision || entry.product.sourceUrl !== decision.sourceUrl ||
          !decision.requiredIssues.every((required) => entry.issues.some((issue) => issue.includes(required)))) {
          throw new Error(`Selección editorial: review sin exclusión acreditada (${key})`);
        }
        foundExclusions.add(key);
        excluded.push({
          providerId, reference, sourceUrl: entry.product.sourceUrl,
          reason: decision.reason, evidenceUrls: decision.evidenceUrls, issues: entry.issues
        });
      }
    }
  }
  if (sources.size !== Object.keys(snapshots).length ||
    exclusions.some((decision) => !foundExclusions.has(`${decision.providerId}:${decision.reference}`)) ||
    identityHolds.some((decision) => !foundHolds.has(`${decision.providerId}:${decision.reference}`))) {
    throw new Error("Selección editorial: faltan proveedores o exclusiones justificadas");
  }
  const original = preparations.reduce((count, preparation) => count + preparation.source.productCount, 0);
  if (original !== ready + review || publishable.length + excluded.length !== original ||
    publishable.length !== ready - foundHolds.size || excluded.length !== review + foundHolds.size) {
    throw new Error("Selección editorial: referencias no reconciliadas");
  }
  return {
    source: preparations.map((preparation) => preparation.source),
    totals: { original, ready, review, publishable: publishable.length, excluded: excluded.length },
    products: publishable,
    exclusions: excluded
  };
};
