import type { PreparedProduct } from "./contracts.js";
import { parsePreparation } from "./preparation-document.js";

export type InterventionProvenance = {
  readonly campaign: string;
  readonly sourceCatalogSha256: string;
  readonly planSha256: string;
  readonly derivedCatalogSha256: string;
};

export type PreparationSource = {
  readonly providerId: string;
  readonly prefix: string;
  readonly scope: string;
  readonly catalogSha256: string;
  readonly productCount: number;
  readonly intervention?: InterventionProvenance;
};

export type PreparationFingerprints = {
  readonly rulesVersion: 1;
  readonly rulesSha256: string;
  readonly categorySnapshotSha256: string;
  readonly attributeSnapshotSha256: string;
};

export type OfflinePreparation = {
  readonly version: 1;
  readonly quality: "complete";
  readonly published: true;
  readonly preparedAt: string;
  readonly source: PreparationSource;
  readonly fingerprints: PreparationFingerprints;
  readonly totals: { readonly ready: number; readonly review: number };
  readonly identities: readonly string[];
  readonly products: readonly PreparedProduct[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isSha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

const parseInterventionProvenance = (value: unknown, catalogSha256: string): InterventionProvenance => {
  if (!isRecord(value) || Object.keys(value).length !== 4 ||
    typeof value.campaign !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value.campaign) ||
    !isSha(value.sourceCatalogSha256) || !isSha(value.planSha256) ||
    !isSha(value.derivedCatalogSha256) || value.derivedCatalogSha256 !== catalogSha256) {
    throw new Error("Procedencia de intervención de preparación inválida");
  }
  return {
    campaign: value.campaign,
    sourceCatalogSha256: value.sourceCatalogSha256,
    planSha256: value.planSha256,
    derivedCatalogSha256: value.derivedCatalogSha256
  };
};

export const parseOfflinePreparation = (value: unknown, providerId: string): OfflinePreparation => {
  const parsed = parsePreparation(value, providerId);
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.source) || !isRecord(value.fingerprints) ||
    typeof value.preparedAt !== "string" || !Number.isFinite(Date.parse(value.preparedAt)) ||
    value.source.providerId !== providerId || typeof value.source.prefix !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(value.source.prefix) || typeof value.source.scope !== "string" ||
    !/^[a-f0-9]{16}$/.test(value.source.scope) || !isSha(value.source.catalogSha256) ||
    typeof value.source.productCount !== "number" || !Number.isSafeInteger(value.source.productCount) ||
    value.source.productCount !== parsed.products.length || parsed.products.length === 0 ||
    value.fingerprints.rulesVersion !== 1 || !isSha(value.fingerprints.rulesSha256) ||
    !isSha(value.fingerprints.categorySnapshotSha256) || !isSha(value.fingerprints.attributeSnapshotSha256) ||
    !isRecord(value.totals) || typeof value.totals.ready !== "number" ||
    typeof value.totals.review !== "number" ||
    value.totals.ready !== parsed.products.filter((entry) => entry.status === "ready").length ||
    value.totals.review !== parsed.products.filter((entry) => entry.status === "review").length ||
    !Array.isArray(value.identities) || value.identities.length !== parsed.products.length ||
    !value.identities.every((identity: unknown) => typeof identity === "string" && identity.startsWith(`${providerId}:`) && identity.length > providerId.length + 1) ||
    new Set(value.identities).size !== parsed.products.length ||
    parsed.products.some((entry) => entry.status === "ready" ? entry.issues.length !== 0 : entry.issues.length === 0)) {
    throw new Error("Preparación offline inválida, incompleta o con metadatos incoherentes");
  }
  const intervention = value.source.intervention === undefined
    ? undefined : parseInterventionProvenance(value.source.intervention, value.source.catalogSha256);
  return {
    version: 1, quality: "complete", published: true, preparedAt: value.preparedAt,
    source: {
      providerId, prefix: value.source.prefix, scope: value.source.scope,
      catalogSha256: value.source.catalogSha256, productCount: value.source.productCount,
      ...(intervention === undefined ? {} : { intervention })
    },
    fingerprints: {
      rulesVersion: 1, rulesSha256: value.fingerprints.rulesSha256,
      categorySnapshotSha256: value.fingerprints.categorySnapshotSha256,
      attributeSnapshotSha256: value.fingerprints.attributeSnapshotSha256
    },
    totals: { ready: value.totals.ready, review: value.totals.review },
    identities: value.identities, products: parsed.products
  };
};
