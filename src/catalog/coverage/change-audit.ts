import { createHash } from "node:crypto";
import type { ProductRecord } from "../../contracts/catalog.js";

export type ChangedFieldCheck = {
  readonly field: "images" | "longDescription" | "shortDescription";
  readonly decision: "aceptado" | "rechazado" | null;
  readonly reason: string | null;
  readonly evidenceUrls: readonly string[];
};

export type ChangedProductAudit = {
  readonly otherFields: readonly {
    readonly field: string;
    readonly previousValue: unknown;
    readonly currentValue: unknown;
  }[];
  readonly images: {
    readonly previousCount: number;
    readonly currentCount: number;
    readonly primaryRetained: boolean;
    readonly removed: readonly string[];
    readonly added: readonly string[];
  } | null;
  readonly descriptions: readonly {
    readonly field: "longDescription" | "shortDescription";
    readonly previousLength: number;
    readonly currentLength: number;
    readonly previousSha256: string;
    readonly currentSha256: string;
  }[];
};

const sha = (value: string | null): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const changedFieldChecks = (fields: readonly string[]): readonly ChangedFieldCheck[] =>
  (["images", "longDescription", "shortDescription"] as const)
    .filter((field) => fields.includes(field))
    .map((field) => ({ field, decision: null, reason: null, evidenceUrls: [] }));

const fieldValue = (product: ProductRecord, field: string): unknown =>
  field.startsWith("specs.")
    ? product.specs?.[field.slice(6)] ?? null
    : Object.entries(product).find(([key]) => key === field)?.[1] ?? null;

export const auditChangedProduct = (
  previous: ProductRecord,
  current: ProductRecord,
  fields: readonly string[]
): ChangedProductAudit => {
  const previousImages = previous.images ?? [];
  const currentImages = current.images ?? [];
  const images = fields.includes("images") ? {
    previousCount: previousImages.length,
    currentCount: currentImages.length,
    primaryRetained: previous.image !== null && previous.image === current.image && currentImages.includes(previous.image),
    removed: previousImages.filter((url) => !currentImages.includes(url)),
    added: currentImages.filter((url) => !previousImages.includes(url))
  } : null;
  const descriptions = (["longDescription", "shortDescription"] as const)
    .filter((field) => fields.includes(field))
    .map((field) => ({
      field,
      previousLength: previous[field]?.length ?? 0,
      currentLength: current[field]?.length ?? 0,
      previousSha256: sha(previous[field]),
      currentSha256: sha(current[field])
    }));
  const otherFields = fields.filter((field) => !["images", "longDescription", "shortDescription"].includes(field))
    .map((field) => ({
      field, previousValue: fieldValue(previous, field), currentValue: fieldValue(current, field)
    }));
  return { images, descriptions, otherFields };
};
