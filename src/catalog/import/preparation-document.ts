import type { ImportCandidate, PreparedProduct } from "./prepare.js";

export type PreparationDocument = {
  readonly quality: "complete";
  readonly published: true;
  readonly products: readonly PreparedProduct[];
};

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const validText = (input: unknown): input is string => typeof input === "string" && input.trim().length > 0;

const isAttributeValue = (input: unknown): input is string | number | boolean =>
  typeof input === "string" || typeof input === "boolean" || (typeof input === "number" && Number.isFinite(input));

const isCandidate = (input: unknown): input is ImportCandidate => {
  if (!isRecord(input)) return false;
  return validText(input.providerId) && validText(input.sourceUrl) &&
    (input.reference === null || typeof input.reference === "string") &&
    (input.title === null || typeof input.title === "string") &&
    (input.categorySellID === null || Number.isSafeInteger(input.categorySellID)) &&
    (input.category === null || typeof input.category === "string") &&
    (input.condition === "Nuevo" || input.condition === "Segunda_Mano" || input.condition === null) &&
    (input.price === null || (typeof input.price === "number" && Number.isFinite(input.price))) &&
    (input.description_title === null || typeof input.description_title === "string") &&
    (input.description === null || typeof input.description === "string") &&
    (input.description_general === null || typeof input.description_general === "string") &&
    Array.isArray(input.images) && input.images.every((image: unknown) => typeof image === "string") &&
    Array.isArray(input.attributes) && input.attributes.every((attribute: unknown) =>
      isRecord(attribute) && Number.isSafeInteger(attribute.attributeID) && isAttributeValue(attribute.value));
};

export const parsePreparation = (input: unknown, providerId: string): PreparationDocument => {
  if (!isRecord(input) || input.quality !== "complete" || input.published !== true || !Array.isArray(input.products)) {
    throw new Error("Se requiere un informe de preparación completo y publicado; no usar partial-preparation");
  }
  for (const entry of input.products) {
    if (!isRecord(entry) || !["ready", "review"].includes(String(entry.status)) ||
      !Array.isArray(entry.issues) || !entry.issues.every((issue: unknown) => typeof issue === "string") ||
      !isCandidate(entry.product) || entry.product.providerId !== providerId) {
      throw new Error("El informe de preparación no coincide con el proveedor o contiene productos inválidos");
    }
  }
  return { quality: "complete", published: true, products: input.products as PreparedProduct[] };
};

