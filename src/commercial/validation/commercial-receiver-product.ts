import { isPresentableSpecifications } from "./technical-specifications.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNullableString = (value: unknown): boolean => value === null || typeof value === "string";
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isWebUrl = (value: unknown): boolean => {
  if (typeof value !== "string" || !value.trim()) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
};

const tokenList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item: unknown) =>
    typeof item === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item)) &&
  new Set(value).size === value.length;

const allowedKeys = new Set([
  "reference", "title", "categorySellID", "category",
  "condition", "price", "description_title", "description", "description_general", "image", "images",
  "spec", "attributes", "logoID", "companyID", "metadata"
]);

export const isCommercialReceiverProduct = (
  value: unknown, environment: "develop" | "production" | null
): boolean => {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedKeys.has(key)) ||
    !isNullableString(value.reference) ||
    !isNullableString(value.title) ||
    (value.categorySellID !== null && !isPositiveInteger(value.categorySellID)) ||
    !isNullableString(value.category) ||
    (value.categorySellID === null ? value.category !== null : typeof value.category !== "string" || !value.category.trim()) ||
    (value.condition !== null && value.condition !== "Nuevo" && value.condition !== "Segunda_Mano") ||
    (value.price !== null && (typeof value.price !== "number" || !Number.isFinite(value.price) || value.price < 0)) ||
    !isNullableString(value.description_title) || !isNullableString(value.description) ||
    !isNullableString(value.description_general) ||
    (value.image !== null && !isWebUrl(value.image)) ||
    !Array.isArray(value.images) || !value.images.every(isWebUrl) ||
    new Set(value.images).size !== value.images.length ||
    (value.image !== null && !value.images.includes(value.image)) ||
    !isPresentableSpecifications(value.spec) ||
    (environment === null ? value.companyID !== undefined : !isPositiveInteger(value.companyID)) ||
    (value.logoID !== null && !isPositiveInteger(value.logoID)) ||
    !Array.isArray(value.attributes) || !isRecord(value.metadata)) return false;

  const metadata = value.metadata;
  if (Object.keys(metadata).some((key) => key !== "tags" && key !== "keywords" && key !== "featured") ||
    metadata.featured !== false || !tokenList(metadata.tags) || !tokenList(metadata.keywords)) return false;

  const attributeIDs = new Set<number>();
  for (const attribute of value.attributes) {
    if (!isRecord(attribute) || Object.keys(attribute).some((key) => key !== "attributeID" && key !== "value") ||
      !isPositiveInteger(attribute.attributeID) || attributeIDs.has(attribute.attributeID) ||
      (typeof attribute.value !== "string" && typeof attribute.value !== "boolean" &&
        (typeof attribute.value !== "number" || !Number.isFinite(attribute.value))) ||
      (typeof attribute.value === "string" && !attribute.value.trim())) return false;
    attributeIDs.add(attribute.attributeID);
  }
  return true;
};
