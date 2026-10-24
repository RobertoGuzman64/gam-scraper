import type { CanonicalCatalog } from "../canonical-catalog.js";
import { compareCanonicalCoverage } from "./compare.js";

export type CoverageReview = {
  readonly version: 1;
  readonly baselineSha256: string;
  readonly currentSha256: string;
  readonly missing: readonly {
    readonly reference: string;
    readonly url: string;
    readonly decision: "retirado" | null;
    readonly reason: string | null;
    readonly evidenceUrls: readonly string[];
  }[];
  readonly changed: readonly {
    readonly reference: string;
    readonly url: string;
    readonly fields: readonly string[];
    readonly decision: "aceptado" | null;
    readonly reason: string | null;
    readonly evidenceUrls: readonly string[];
  }[];
};

export const createCoverageReview = (
  baseline: CanonicalCatalog,
  current: CanonicalCatalog,
  baselineSha256: string,
  currentSha256: string
): CoverageReview => {
  const changes = compareCanonicalCoverage(baseline, current);
  const missing = changes.missing.map((product) => {
    if (!product.reference) throw new Error("Ausencia sin referencia para revisión editorial");
    return { reference: product.reference, url: product.url, decision: null, reason: null, evidenceUrls: [] };
  });
  const changed = changes.changedDetails.map((product) => {
    if (!product.reference) throw new Error("Cambio sin referencia para revisión editorial");
    return { reference: product.reference, url: product.url, fields: product.fields, decision: null, reason: null, evidenceUrls: [] };
  });
  return { version: 1, baselineSha256, currentSha256, missing, changed };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validEvidence = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length > 0 && value.every((url: unknown) => {
    if (typeof url !== "string") return false;
    try { return new URL(url).protocol === "https:"; } catch { return false; }
  });

const isReviewed = (value: unknown, kind: "missing" | "changed"): boolean =>
  isRecord(value) &&
  value.decision === (kind === "missing" ? "retirado" : "aceptado") &&
  typeof value.reason === "string" && value.reason.trim().length >= 15 &&
  validEvidence(value.evidenceUrls);

export const verifyCoverageReview = (
  value: unknown,
  expected: CoverageReview
): void => {
  if (!isRecord(value) || value.version !== 1 ||
    value.baselineSha256 !== expected.baselineSha256 ||
    value.currentSha256 !== expected.currentSha256 ||
    !Array.isArray(value.missing) || !Array.isArray(value.changed) ||
    value.missing.length !== expected.missing.length ||
    value.changed.length !== expected.changed.length) {
    throw new Error("Revisión de cobertura ausente, caducada o incompleta");
  }
  for (const [kind, required] of [
    ["missing", expected.missing], ["changed", expected.changed]
  ] as const) {
    const entries: unknown = value[kind];
    if (!Array.isArray(entries)) throw new Error("Bloque de cobertura inválido");
    const actual: readonly unknown[] = entries;
    const byReference = new Map<string, unknown>();
    for (const entry of actual) {
      if (!isRecord(entry) || typeof entry.reference !== "string" || byReference.has(entry.reference)) {
        throw new Error(`Revisión ${kind} con referencias inválidas o duplicadas`);
      }
      byReference.set(entry.reference, entry);
    }
    for (const item of required) {
      const entry = byReference.get(item.reference);
      if (!isRecord(entry) || entry.url !== item.url ||
        (kind === "changed" && (
          !Array.isArray(entry.fields) || JSON.stringify(entry.fields) !== JSON.stringify("fields" in item ? item.fields : [])
        )) || !isReviewed(entry, kind)) {
        throw new Error(`Revisión de cobertura pendiente o incoherente: ${kind}:${item.reference}`);
      }
    }
  }
};
