import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ImportCatalog } from "../../catalog/import/preparation/contracts.js";

type Category = ImportCatalog["categories"][number];
type Attribute = ImportCatalog["attributes"][number];
type Relation = ImportCatalog["relations"][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isCategory = (value: unknown): value is Category => isRecord(value) &&
  Number.isSafeInteger(value.id) && (value.parentId === null || Number.isSafeInteger(value.parentId)) &&
  typeof value.name === "string" && typeof value.slug === "string";

const isAttribute = (value: unknown): value is Attribute => isRecord(value) &&
  Number.isSafeInteger(value.id) && typeof value.name === "string" &&
  ["NUMBER", "TEXT", "SELECT", "BOOLEAN"].includes(String(value.type)) &&
  typeof value.required === "boolean" && typeof value.unit_option === "string";

const isRelation = (value: unknown): value is Relation => isRecord(value) &&
  Number.isSafeInteger(value.categoryID) && Number.isSafeInteger(value.attributeID);

export const loadImportCatalog = async (): Promise<ImportCatalog> => {
  const categoryPath = fileURLToPath(new URL("../../../data/category/categorySell-flat.json", import.meta.url));
  const attributePath = fileURLToPath(new URL("../../../data/import/attributeCatalog.json", import.meta.url));
  const [categoriesRaw, attributesRaw] = await Promise.all([readFile(categoryPath, "utf8"), readFile(attributePath, "utf8")]);
  const categories: unknown = JSON.parse(categoriesRaw);
  const metadata: unknown = JSON.parse(attributesRaw);
  if (!Array.isArray(categories) || !categories.every(isCategory) || !isRecord(metadata) ||
    !Array.isArray(metadata.attributes) || !metadata.attributes.every(isAttribute) ||
    !Array.isArray(metadata.relations) || !metadata.relations.every(isRelation)) {
    throw new Error("Metadatos de categorías o atributos de Equipzilla inválidos");
  }
  const ids = new Set(categories.map((category) => category.id));
  if (ids.size !== categories.length || categories.some((category) =>
    category.parentId !== null && !ids.has(category.parentId))) {
    throw new Error("Catálogo de categorías de Equipzilla con IDs duplicados o padres inexistentes");
  }
  return { categories, attributes: metadata.attributes, relations: metadata.relations };
};
