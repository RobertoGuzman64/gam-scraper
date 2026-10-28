import type { ProductRecord } from "../../contracts/catalog.js";
import type { CanonicalCatalog } from "../canonical-catalog.js";
import { buildProductIdentity } from "../identity.js";
import { classifyQualityIssue } from "../preparation/offline-diagnostics.js";
import type { IssueCategory } from "../preparation/offline-diagnostics.js";
import type { OfflinePreparation } from "../preparation/offline-document.js";
import type { PreparedProduct } from "../preparation/contracts.js";
import { sourceSignalForIssue } from "./source-triage.js";
import type { SourceSignal } from "./source-triage.js";

export type ReviewCensusIssue = {
  readonly message: string;
  readonly code: string;
  readonly classification: IssueCategory;
  readonly signal: SourceSignal;
};

export type ReviewCensusEntry = {
  readonly identity: string;
  readonly source: ProductRecord;
  readonly prepared: PreparedProduct;
  readonly issues: readonly ReviewCensusIssue[];
};

export const buildReviewCensus = (
  catalog: CanonicalCatalog,
  preparation: OfflinePreparation
): readonly ReviewCensusEntry[] => {
  if (catalog.providerId !== preparation.source.providerId || catalog.prefix !== preparation.source.prefix ||
    catalog.scope !== preparation.source.scope || catalog.productCount !== preparation.source.productCount ||
    catalog.products.length !== preparation.products.length || catalog.products.length !== preparation.identities.length ||
    preparation.totals.ready + preparation.totals.review !== catalog.productCount) {
    throw new Error("Censo: catálogo y preparación no pertenecen al mismo universo");
  }
  const census: ReviewCensusEntry[] = [];
  const identities = new Set<string>();
  for (const [index, source] of catalog.products.entries()) {
    const prepared = preparation.products[index];
    const identity = buildProductIdentity(source).key;
    if (!prepared || preparation.identities[index] !== identity || identities.has(identity) ||
      prepared.product.providerId !== source.providerId || prepared.product.sourceUrl !== source.url ||
      prepared.product.reference !== (source.reference?.trim() || null)) {
      throw new Error(`Censo: identidad u origen incoherente en posición ${index}`);
    }
    identities.add(identity);
    if (prepared.status === "ready") {
      if (prepared.issues.length) throw new Error(`Censo: ready con incidencias en ${identity}`);
      continue;
    }
    if (!prepared.issues.length) throw new Error(`Censo: review sin motivos en ${identity}`);
    const issues = [...new Set(prepared.issues)].map((message) => {
      const { code, classification } = classifyQualityIssue(message);
      if (!classification || classification === "no_determinado") {
        throw new Error(`Censo: motivo sin clasificación en ${identity}: ${message}`);
      }
      return { message, code, classification, signal: sourceSignalForIssue(message, source) };
    });
    census.push({ identity, source, prepared, issues });
  }
  if (identities.size !== catalog.productCount || census.length !== preparation.totals.review ||
    catalog.productCount - census.length !== preparation.totals.ready) {
    throw new Error("Censo: pérdida de máquinas o contadores incoherentes");
  }
  return census;
};
