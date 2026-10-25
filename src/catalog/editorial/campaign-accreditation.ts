import { createHash } from "node:crypto";
import type { OfflinePreparation } from "../import/preparation/offline-document.js";
import { gamNewForkliftIdentityIssues } from "./gam-new-forklift-identity.js";
import type { PublishableSelection } from "./select-publishable.js";

export type AccreditedSource = {
  readonly providerId: string;
  readonly catalogSha256: string;
  readonly preparationSha256: string;
  readonly productCount: number;
};

type RequiredExclusion = {
  readonly providerId: string;
  readonly reference: string;
  readonly sourceUrl: string;
  readonly status: "review" | "identity";
  readonly issues: readonly string[];
};

type AccreditationDecision = RequiredExclusion & {
  readonly decision: "excluir" | null;
  readonly reason: string | null;
  readonly evidenceUrls: readonly string[];
};

export type CampaignAccreditation = {
  readonly version: 1;
  readonly runId: string;
  readonly approved: boolean;
  readonly approvalReason: string | null;
  readonly sources: readonly AccreditedSource[];
  readonly exclusions: readonly AccreditationDecision[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isSecureUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

const getRequiredExclusions = (preparations: readonly OfflinePreparation[]): readonly RequiredExclusion[] => {
  const required: RequiredExclusion[] = [];
  for (const preparation of preparations) {
    const providerId = preparation.source.providerId;
    for (const entry of preparation.products) {
      const reference = entry.product.reference;
      if (!reference || entry.product.providerId !== providerId) {
        throw new Error("Acreditación editorial: identidad de producto inválida");
      }
      const issues = entry.status === "review" ? entry.issues : gamNewForkliftIdentityIssues(entry.product);
      if (issues.length > 0) required.push({
        providerId, reference, sourceUrl: entry.product.sourceUrl,
        status: entry.status === "review" ? "review" : "identity", issues
      });
    }
  }
  return required;
};

export const createAccreditationDraft = (
  preparations: readonly OfflinePreparation[],
  sources: readonly AccreditedSource[],
  runId: string
): CampaignAccreditation => ({
  version: 1, runId, approved: false, approvalReason: null, sources,
  exclusions: getRequiredExclusions(preparations).map((required) => ({
    ...required, decision: null, reason: null, evidenceUrls: []
  }))
});

export const selectAccreditedPublishable = (
  preparations: readonly OfflinePreparation[],
  sources: readonly AccreditedSource[],
  runId: string,
  rawAccreditation: unknown,
  approvalSha256: string
): PublishableSelection => {
  const expected = createAccreditationDraft(preparations, sources, runId);
  if (!isRecord(rawAccreditation) || rawAccreditation.version !== 1 || rawAccreditation.runId !== runId ||
    rawAccreditation.approved !== true || typeof rawAccreditation.approvalReason !== "string" ||
    rawAccreditation.approvalReason.trim().length < 15 ||
    JSON.stringify(rawAccreditation.sources) !== JSON.stringify(sources) ||
    !Array.isArray(rawAccreditation.exclusions) || rawAccreditation.exclusions.length !== expected.exclusions.length) {
    throw new Error("Acreditación editorial: aprobación ausente, incompleta o vinculada a otra campaña");
  }
  const decisions = new Map<string, AccreditationDecision>();
  const suppliedExclusions: readonly unknown[] = rawAccreditation.exclusions;
  for (const item of suppliedExclusions) {
    if (!isRecord(item) || typeof item.providerId !== "string" || typeof item.reference !== "string") {
      throw new Error("Acreditación editorial: exclusión inválida");
    }
    const key = `${item.providerId}:${item.reference}`;
    const expectedEntry = expected.exclusions.find((entry) =>
      entry.providerId === item.providerId && entry.reference === item.reference);
    if (!expectedEntry || decisions.has(key) || item.decision !== "excluir" ||
      item.status !== expectedEntry.status || item.sourceUrl !== expectedEntry.sourceUrl ||
      JSON.stringify(item.issues) !== JSON.stringify(expectedEntry.issues) ||
      typeof item.reason !== "string" || item.reason.trim().length < 15 ||
      !Array.isArray(item.evidenceUrls) || item.evidenceUrls.length === 0 ||
      !item.evidenceUrls.every(isSecureUrl) || !item.evidenceUrls.includes(expectedEntry.sourceUrl)) {
      throw new Error(`Acreditación editorial: decisión ausente o caducada (${key})`);
    }
    decisions.set(key, {
      ...expectedEntry, decision: "excluir", reason: item.reason, evidenceUrls: item.evidenceUrls
    });
  }
  const products: PublishableSelection["products"][number][] = [];
  const exclusions: PublishableSelection["exclusions"][number][] = [];
  const identified = new Set<string>();
  let ready = 0;
  let review = 0;
  for (const preparation of preparations) {
    const providerId = preparation.source.providerId;
    if (preparation.source.productCount !== preparation.products.length ||
      preparation.totals.ready + preparation.totals.review !== preparation.products.length ||
      preparation.source.intervention !== undefined) {
      throw new Error(`Acreditación editorial: preparación no admitida (${providerId})`);
    }
    for (const entry of preparation.products) {
      const reference = entry.product.reference;
      const key = `${providerId}:${reference ?? ""}`;
      if (!reference || identified.has(key) || entry.product.providerId !== providerId) {
        throw new Error(`Acreditación editorial: referencia inválida o duplicada (${key})`);
      }
      identified.add(key);
      if (entry.status === "ready") {
        ready += 1;
        if (entry.issues.length) throw new Error(`Acreditación editorial: ready incoherente (${key})`);
      } else {
        review += 1;
        if (!entry.issues.length) throw new Error(`Acreditación editorial: review sin motivo (${key})`);
      }
      const decision = decisions.get(key);
      if (decision) {
        exclusions.push({
          providerId, reference, sourceUrl: entry.product.sourceUrl,
          reason: decision.reason ?? "", evidenceUrls: decision.evidenceUrls, issues: decision.issues
        });
      } else {
        if (entry.status !== "ready" || gamNewForkliftIdentityIssues(entry.product).length) {
          throw new Error(`Acreditación editorial: producto sin decisión (${key})`);
        }
        products.push(entry.product);
      }
    }
  }
  const original = preparations.reduce((sum, item) => sum + item.source.productCount, 0);
  if (original !== ready + review || original !== products.length + exclusions.length ||
    exclusions.length !== decisions.size) throw new Error("Acreditación editorial: referencias no reconciliadas");
  return {
    accreditation: {
      runId,
      approvalSha256,
      preparationSources: sources.map(({ providerId, preparationSha256 }) => ({ providerId, preparationSha256 }))
    },
    source: preparations.map((item) => item.source),
    totals: { original, ready, review, publishable: products.length, excluded: exclusions.length },
    products, exclusions
  };
};
