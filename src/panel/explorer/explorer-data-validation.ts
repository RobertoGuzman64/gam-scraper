import type { SpecValue } from "../../contracts/catalog.js";
import type { CommercialDeliveryPlan, CommercialDeliveryProduct, CommercialDeliverySource } from "../../commercial/export/commercial-export.js";
import { isRecord } from "../evidence/evidence-files.js";

const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isWebUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
};
const isSpec = (value: unknown): value is Readonly<Record<string, SpecValue>> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === "string" ||
    typeof item === "boolean" || typeof item === "number" && Number.isFinite(item) ||
    Array.isArray(item) && item.every((part: unknown) => typeof part === "string" ||
      typeof part === "boolean" || typeof part === "number" && Number.isFinite(part)));
const isCommercialProduct = (value: unknown): value is CommercialDeliveryProduct =>
  isRecord(value) && nullableString(value.reference) && nullableString(value.title) &&
  nullableString(value.category) && (value.categorySellID === null || Number.isSafeInteger(value.categorySellID)) &&
  (value.price === null || typeof value.price === "number" && Number.isFinite(value.price)) &&
  nullableString(value.description) && nullableString(value.description_general) && nullableString(value.image) &&
  Array.isArray(value.images) && value.images.every(isWebUrl) && isSpec(value.spec) &&
  Array.isArray(value.attributes) && value.attributes.every((attribute: unknown) => isRecord(attribute) &&
    Number.isSafeInteger(attribute.attributeID) && (typeof attribute.value === "string" ||
      typeof attribute.value === "boolean" || typeof attribute.value === "number" && Number.isFinite(attribute.value)));
const isCommercialSource = (value: unknown): value is CommercialDeliverySource =>
  isRecord(value) && typeof value.identity === "string" && nullableString(value.reference) && isWebUrl(value.sourceUrl);
export const isDelivery = (value: unknown): value is CommercialDeliveryPlan =>
  isRecord(value) && value.version === 2 && typeof value.providerId === "string" &&
  Array.isArray(value.products) && value.products.every(isCommercialProduct) &&
  Array.isArray(value.sources) && value.sources.every(isCommercialSource) &&
  Array.isArray(value.excluded) && value.excluded.every((item: unknown) => isRecord(item) &&
    typeof item.identity === "string" && nullableString(item.reference) && isWebUrl(item.sourceUrl) && typeof item.reason === "string");

export type EditorialExclusion = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly decision: string;
  readonly reason: string;
  readonly issues: readonly string[];
  readonly evidenceUrls: readonly string[];
};
export const isEditorialExclusion = (value: unknown): value is EditorialExclusion =>
  isRecord(value) && typeof value.providerId === "string" && nullableString(value.reference) &&
  isWebUrl(value.sourceUrl) && value.decision === "excluir" && typeof value.reason === "string" && value.reason.length > 0 &&
  Array.isArray(value.issues) && value.issues.every((item: unknown) => typeof item === "string") &&
  Array.isArray(value.evidenceUrls) && value.evidenceUrls.every(isWebUrl);
