import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { InterventionProvenance } from "../import/preparation/offline-document.js";
import type { OfflinePreparation } from "../import/preparation/offline-document.js";
import { gamNewForkliftIdentityIssues } from "./gam-new-forklift-identity.js";
import type { PublishableSelection } from "./select-publishable.js";

export type AccreditedSource = {
  readonly providerId: string;
  readonly catalogSha256: string;
  readonly preparationSha256: string;
  readonly productCount: number;
  readonly intervention?: InterventionProvenance & {
    readonly affectedReferences: readonly string[];
  };
};

type RequiredExclusion = {
  readonly providerId: string;
  readonly reference: string;
  readonly sourceUrl: string;
  readonly status: "review" | "identity" | "intervention";
  readonly issues: readonly string[];
};

type AccreditationDecision = RequiredExclusion & {
  readonly decision: "excluir" | "incluir" | null;
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

const getRequiredExclusions = (
  preparations: readonly OfflinePreparation[], sources: readonly AccreditedSource[]
): readonly RequiredExclusion[] => {
  const required: RequiredExclusion[] = [];
  for (const preparation of preparations) {
    const providerId = preparation.source.providerId;
    const touched = new Set(sources.find((source) => source.providerId === providerId)?.intervention?.affectedReferences ?? []);
    for (const entry of preparation.products) {
      const reference = entry.product.reference;
      if (!reference || entry.product.providerId !== providerId) {
        throw new Error("Acreditación editorial: identidad de producto inválida");
      }
      const issues = entry.status === "review" ? entry.issues : gamNewForkliftIdentityIssues(entry.product);
      if (issues.length > 0 || touched.has(reference)) required.push({
        providerId, reference, sourceUrl: entry.product.sourceUrl,
        status: entry.status === "review" ? "review" : issues.length ? "identity" : "intervention",
        issues: issues.length ? issues : ["Intervención manual acreditada; requiere aprobación editorial explícita"]
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
  exclusions: getRequiredExclusions(preparations, sources).map((required) => ({
    ...required, decision: null, reason: null, evidenceUrls: []
  }))
});

export type AccreditationIssue = {
  readonly providerId: string;
  readonly reference: string;
  readonly message: string;
};

export type AccreditationInspection = {
  readonly approved: boolean;
  readonly total: number;
  readonly completed: number;
  readonly issues: readonly AccreditationIssue[];
};

export const inspectAccreditationDraft = (
  preparations: readonly OfflinePreparation[], sources: readonly AccreditedSource[],
  runId: string, rawAccreditation: unknown
): AccreditationInspection => {
  const expected = createAccreditationDraft(preparations, sources, runId);
  if (!isRecord(rawAccreditation) || rawAccreditation.version !== 1 || rawAccreditation.runId !== runId ||
    typeof rawAccreditation.approved !== "boolean" ||
    (rawAccreditation.approvalReason !== null && typeof rawAccreditation.approvalReason !== "string") ||
    JSON.stringify(rawAccreditation.sources) !== JSON.stringify(sources) ||
    !Array.isArray(rawAccreditation.exclusions) || rawAccreditation.exclusions.length !== expected.exclusions.length) {
    throw new Error("Acreditación editorial: aprobación ausente, incompleta o vinculada a otra campaña");
  }
  const issues: AccreditationIssue[] = [];
  const indexed = new Map<string, Record<string, unknown>>();
  const suppliedExclusions: readonly unknown[] = rawAccreditation.exclusions;
  for (const item of suppliedExclusions) {
    if (!isRecord(item) || typeof item.providerId !== "string" || typeof item.reference !== "string") {
      throw new Error("Acreditación editorial: exclusión inválida");
    }
    const key = `${item.providerId}:${item.reference}`;
    const required = expected.exclusions.find((entry) =>
      entry.providerId === item.providerId && entry.reference === item.reference);
    if (!required || indexed.has(key) || item.sourceUrl !== required.sourceUrl || item.status !== required.status ||
      !isDeepStrictEqual(item.issues, required.issues)) {
      throw new Error(`Acreditación editorial: decisión ausente o caducada (${key})`);
    }
    indexed.set(key, item);
  }
  let completed = 0;
  for (const required of expected.exclusions) {
    const key = `${required.providerId}:${required.reference}`;
    const item = indexed.get(key);
    if (!item) throw new Error(`Acreditación editorial: decisión ausente o caducada (${key})`);
    const messages: string[] = [];
    if (item.decision === null) messages.push("decisión pendiente");
    else if (item.decision !== "excluir" && !(required.status === "intervention" && item.decision === "incluir")) {
      messages.push("decisión no permitida para esta ficha");
    }
    if (typeof item.reason !== "string" || item.reason.trim().length < 15) {
      messages.push("motivo requerido de al menos 15 caracteres");
    }
    if (!Array.isArray(item.evidenceUrls) || item.evidenceUrls.length === 0 ||
      !item.evidenceUrls.every(isSecureUrl) || !item.evidenceUrls.includes(required.sourceUrl)) {
      messages.push("evidencia HTTPS inválida o falta la URL original de la ficha");
    }
    if (messages.length) issues.push(...messages.map((message) => ({
      providerId: required.providerId, reference: required.reference, message
    })));
    else completed += 1;
  }
  if (rawAccreditation.approved &&
    (typeof rawAccreditation.approvalReason !== "string" || rawAccreditation.approvalReason.trim().length < 15)) {
    issues.push({ providerId: "", reference: "", message: "aprobación global sin motivo válido (mínimo 15 caracteres)" });
  }
  return { approved: rawAccreditation.approved, total: expected.exclusions.length, completed, issues };
};

export const selectAccreditedPublishable = (
  preparations: readonly OfflinePreparation[],
  sources: readonly AccreditedSource[],
  runId: string,
  rawAccreditation: unknown,
  approvalSha256: string
): PublishableSelection => {
  const inspection = inspectAccreditationDraft(preparations, sources, runId, rawAccreditation);
  if (!inspection.approved || inspection.issues.some((issue) => issue.providerId === "")) {
    throw new Error("Acreditación editorial: aprobación ausente, incompleta o vinculada a otra campaña");
  }
  const firstIssue = inspection.issues[0];
  if (firstIssue) {
    throw new Error(`Acreditación editorial: decisión ausente o caducada (${firstIssue.providerId}:${firstIssue.reference}): ${firstIssue.message}`);
  }
  if (!isRecord(rawAccreditation) || !Array.isArray(rawAccreditation.exclusions)) {
    throw new Error("Acreditación editorial: aprobación ausente o incompleta");
  }
  const expected = createAccreditationDraft(preparations, sources, runId);
  const decisions = new Map<string, AccreditationDecision>();
  const suppliedDecisions: readonly unknown[] = rawAccreditation.exclusions;
  for (const item of suppliedDecisions) {
    if (!isRecord(item) || typeof item.providerId !== "string" || typeof item.reference !== "string" ||
      typeof item.reason !== "string" || !Array.isArray(item.evidenceUrls)) {
      throw new Error("Acreditación editorial: exclusión inválida");
    }
    const required = expected.exclusions.find((entry) =>
      entry.providerId === item.providerId && entry.reference === item.reference);
    if (!required || (item.decision !== "incluir" && item.decision !== "excluir")) {
      throw new Error("Acreditación editorial: decisión inválida");
    }
    decisions.set(`${item.providerId}:${item.reference}`, {
      ...required, decision: item.decision, reason: item.reason, evidenceUrls: item.evidenceUrls.filter(isSecureUrl)
    });
  }
  const products: PublishableSelection["products"][number][] = [];
  const exclusions: PublishableSelection["exclusions"][number][] = [];
  const identified = new Set<string>();
  let ready = 0;
  let review = 0;
  for (const preparation of preparations) {
    const providerId = preparation.source.providerId;
    const accredited = sources.find((source) => source.providerId === providerId);
    if (preparation.source.productCount !== preparation.products.length ||
      preparation.totals.ready + preparation.totals.review !== preparation.products.length ||
      !accredited || accredited.productCount !== preparation.source.productCount ||
      (preparation.source.intervention === undefined ?
        accredited.intervention !== undefined || accredited.catalogSha256 !== preparation.source.catalogSha256 :
        !accredited.intervention ||
        !isDeepStrictEqual(preparation.source.intervention, {
          campaign: accredited.intervention.campaign,
          sourceCatalogSha256: accredited.intervention.sourceCatalogSha256,
          planSha256: accredited.intervention.planSha256,
          derivedCatalogSha256: accredited.intervention.derivedCatalogSha256
        }) || accredited.catalogSha256 !== accredited.intervention.sourceCatalogSha256)) {
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
      if (decision?.decision === "excluir") {
        exclusions.push({
          providerId, reference, sourceUrl: entry.product.sourceUrl,
          reason: decision.reason ?? "", evidenceUrls: decision.evidenceUrls, issues: decision.issues
        });
      } else {
        if (entry.status !== "ready" || gamNewForkliftIdentityIssues(entry.product).length ||
          (expected.exclusions.some((item) => item.providerId === providerId && item.reference === reference) &&
            decision?.decision !== "incluir")) {
          throw new Error(`Acreditación editorial: producto sin decisión (${key})`);
        }
        products.push(entry.product);
      }
    }
  }
  const original = preparations.reduce((sum, item) => sum + item.source.productCount, 0);
  if (original !== ready + review || original !== products.length + exclusions.length ||
    decisions.size !== expected.exclusions.length ||
    exclusions.length + products.filter((item) => decisions.get(`${item.providerId}:${item.reference}`)?.decision === "incluir").length !== decisions.size) {
    throw new Error("Acreditación editorial: referencias no reconciliadas");
  }
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
