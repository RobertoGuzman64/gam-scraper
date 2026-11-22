import { isDeepStrictEqual } from "node:util";
import { buildProductIdentity } from "../catalog/identity.js";
import { isCampaignProvider, type CAMPAIGN_PROVIDERS } from "../contracts/campaign-providers.js";
import { candidateValidationIssue } from "../preparation/preparation-document.js";
import type { PreparedProduct } from "../preparation/contracts.js";

export type TechnicalProvider = typeof CAMPAIGN_PROVIDERS[number];

export type TechnicalSource = {
  readonly kind: "canonical";
  readonly catalogSha256: string;
  readonly preparationSha256: string;
  readonly rulesSha256: string;
  readonly productCount: number;
} | {
  readonly kind: "manain-record";
  readonly recordSha256: string;
  readonly sourceCsvSha256: string;
  readonly rulesSha256: string;
  readonly discoveredProductUrls: number;
  readonly discardedUrls: readonly string[];
};

export type TechnicalSnapshot = {
  readonly version: 1;
  readonly providerId: TechnicalProvider;
  readonly quality: "complete" | "partial";
  readonly source: TechnicalSource;
  readonly totals: { readonly ready: number; readonly review: number };
  readonly identities: readonly string[];
  readonly products: readonly PreparedProduct[];
};

export type TechnicalDifference = {
  readonly previous: string | null;
  readonly candidate: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
  readonly changedStatus: readonly string[];
  readonly changedIssues: readonly string[];
  readonly lostSpecifications: readonly string[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export const parseTechnicalSnapshot = (value: unknown, providerId: string): TechnicalSnapshot => {
  if (!isCampaignProvider(providerId) || !record(value) || Object.keys(value).length !== 7 ||
    value.version !== 1 || value.providerId !== providerId ||
    (value.quality !== "complete" && value.quality !== "partial") ||
    !record(value.source) || !record(value.totals) || !Array.isArray(value.identities) ||
    !Array.isArray(value.products) || value.products.length === 0 ||
    !Number.isSafeInteger(value.totals.ready) || !Number.isSafeInteger(value.totals.review)) {
    throw new Error("Corte técnico inválido: estructura, proveedor o totales");
  }
  const source = value.source;
  if (value.quality === "complete") {
    if (source.kind !== "canonical" || Object.keys(source).length !== 5 ||
      !sha(source.catalogSha256) || !sha(source.preparationSha256) || !sha(source.rulesSha256) ||
      source.productCount !== value.products.length) throw new Error("Procedencia técnica completa inválida");
  } else if (providerId !== "manain" || source.kind !== "manain-record" ||
    Object.keys(source).length !== 6 || !sha(source.recordSha256) || !sha(source.sourceCsvSha256) || !sha(source.rulesSha256) ||
    !Number.isSafeInteger(source.discoveredProductUrls) || !Array.isArray(source.discardedUrls) ||
    !source.discardedUrls.every((url: unknown) => typeof url === "string" && url.startsWith("https://")) ||
    source.discoveredProductUrls !== value.products.length + source.discardedUrls.length ||
    new Set(source.discardedUrls).size !== source.discardedUrls.length) {
    throw new Error("Procedencia técnica parcial inválida");
  }
  const identities = value.identities;
  if (identities.length !== value.products.length ||
    !identities.every((identity: unknown) => typeof identity === "string" &&
      identity.startsWith(`${providerId}:`) && identity.length > providerId.length + 1) ||
    new Set(identities).size !== identities.length) throw new Error("Identidades técnicas incoherentes");
  let ready = 0;
  let review = 0;
  for (const [index, entry] of value.products.entries()) {
    if (!record(entry) || (entry.status !== "ready" && entry.status !== "review") ||
      !Array.isArray(entry.issues) || !entry.issues.every((issue: unknown) => typeof issue === "string" && issue.trim().length > 0) ||
      (entry.status === "ready" ? entry.issues.length !== 0 : entry.issues.length === 0) ||
      (entry.importIssues !== undefined && (!record(entry.importIssues) ||
        !Array.isArray(entry.importIssues.excel) || !entry.importIssues.excel.every((issue: unknown) => typeof issue === "string") ||
        !Array.isArray(entry.importIssues.createMany) || !entry.importIssues.createMany.every((issue: unknown) => typeof issue === "string"))) ||
      candidateValidationIssue(entry.product) !== null || !record(entry.product) ||
      entry.product.providerId !== providerId) {
      throw new Error(`Producto del corte técnico inválido: ${index}`);
    }
    const identity = identities[index];
    if (typeof entry.product.reference === "string" && entry.product.reference.trim()) {
      const expected = buildProductIdentity({ providerId, reference: entry.product.reference,
        serialNumber: null, url: String(entry.product.sourceUrl) }).key;
      if (identity !== expected) throw new Error(`Referencia técnica e identidad discordantes: ${identity}`);
    }
    if (entry.status === "ready") ready += 1;
    else review += 1;
  }
  if (ready !== value.totals.ready || review !== value.totals.review) {
    throw new Error("Totales de estados técnicos incoherentes");
  }
  return value as TechnicalSnapshot;
};

export const compareTechnicalSnapshots = (
  candidate: TechnicalSnapshot, candidateSha: string,
  previous: TechnicalSnapshot | null, previousSha: string | null
): TechnicalDifference => {
  const old = new Map((previous?.identities ?? []).map((identity, index) => [identity, previous?.products[index]]));
  const current = new Set(candidate.identities);
  const added: string[] = [];
  const changed: string[] = [];
  const changedStatus: string[] = [];
  const changedIssues: string[] = [];
  const lostSpecifications: string[] = [];
  candidate.identities.forEach((identity, index) => {
    const next = candidate.products[index];
    const prior = old.get(identity);
    if (!prior) { added.push(identity); return; }
    if (!next) throw new Error(`Producto técnico sin identidad: ${identity}`);
    if (!isDeepStrictEqual(prior, next)) changed.push(identity);
    if (prior.status !== next.status) changedStatus.push(identity);
    if (!isDeepStrictEqual(prior.issues, next.issues)) changedIssues.push(identity);
    for (const field of Object.keys(prior.product.spec ?? {})) {
      if (!Object.hasOwn(next.product.spec ?? {}, field)) lostSpecifications.push(`${identity}:${field}`);
    }
  });
  return {
    previous: previousSha, candidate: candidateSha, added, changed, changedStatus, changedIssues,
    removed: [...old.keys()].filter((identity) => !current.has(identity)), lostSpecifications
  };
};
