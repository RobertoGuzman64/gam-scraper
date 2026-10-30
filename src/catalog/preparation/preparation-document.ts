import type { ImportCandidate } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";

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

const isImportIssues = (input: unknown): boolean =>
  isRecord(input) && Array.isArray(input.excel) && input.excel.every((item: unknown) => typeof item === "string") &&
  Array.isArray(input.createMany) && input.createMany.every((item: unknown) => typeof item === "string");

export const candidateValidationIssue = (input: unknown): string | null => {
  if (!isRecord(input)) return "producto: se esperaba un objeto";
  if (!validText(input.providerId)) return "providerId: se requiere texto no vacío";
  if (!validText(input.sourceUrl)) return "sourceUrl: se requiere texto no vacío";
  if (input.reference !== null && typeof input.reference !== "string") return "reference: debe ser texto o null";
  if (input.externalReference !== undefined && input.externalReference !== null && typeof input.externalReference !== "string") {
    return "externalReference: debe ser texto o null";
  }
  if (input.title !== null && typeof input.title !== "string") return "title: debe ser texto o null";
  if (input.categorySellID !== null && !Number.isSafeInteger(input.categorySellID)) {
    return "categorySellID: debe ser entero seguro o null";
  }
  if (input.category !== null && typeof input.category !== "string") return "category: debe ser texto o null";
  if (input.condition !== "Nuevo" && input.condition !== "Segunda_Mano" && input.condition !== null) {
    return "condition: valor ajeno al contrato";
  }
  if (input.price !== null && (typeof input.price !== "number" || !Number.isFinite(input.price))) {
    return "price: debe ser número finito o null";
  }
  for (const field of ["description_title", "description", "description_general"] as const) {
    if (input[field] !== null && typeof input[field] !== "string") return `${field}: debe ser texto o null`;
  }
  if (!Array.isArray(input.images) || input.images.some((image: unknown) => typeof image !== "string")) {
    return "images: debe ser una lista de textos";
  }
  if (!Array.isArray(input.attributes)) return "attributes: debe ser una lista";
  for (const [index, attribute] of input.attributes.entries()) {
    if (!isRecord(attribute) || !Number.isSafeInteger(attribute.attributeID) || !isAttributeValue(attribute.value)) {
      return `attributes[${index}]: attributeID o value inválido`;
    }
  }
  return null;
};

export const isCandidate = (input: unknown): input is ImportCandidate => candidateValidationIssue(input) === null;

export const parsePreparation = (input: unknown, providerId: string): PreparationDocument => {
  if (!isRecord(input) || input.quality !== "complete" || input.published !== true || !Array.isArray(input.products)) {
    throw new Error("Se requiere un informe de preparación completo y publicado; no usar partial-preparation");
  }
  for (const entry of input.products) {
    if (!isRecord(entry) || !["ready", "review"].includes(String(entry.status)) ||
      !Array.isArray(entry.issues) || !entry.issues.every((issue: unknown) => typeof issue === "string") ||
      (entry.importIssues !== undefined && !isImportIssues(entry.importIssues)) ||
      !isCandidate(entry.product) || entry.product.providerId !== providerId) {
      throw new Error("El informe de preparación no coincide con el proveedor o contiene productos inválidos");
    }
  }
  return { quality: "complete", published: true, products: input.products as PreparedProduct[] };
};

