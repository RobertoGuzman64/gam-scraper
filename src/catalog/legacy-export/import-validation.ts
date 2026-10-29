import { isLeafCategoryForCondition } from "../preparation/mapping/category-mapping.js";
import type { ImportCandidate, ImportCatalog } from "./contracts.js";
import { commercialReference } from "./commercial-reference.js";

type ImportReceiver = "excel" | "createMany";

const validText = (input: unknown): input is string => typeof input === "string" && input.trim().length > 0;

export const descriptionImportIssue = (description: string | null, descriptionGeneral: string | null): string | null => {
  if (!validText(description)) {
    return validText(descriptionGeneral)
      ? "Descripción corta ausente: solo hay descripción general y el backend exige una descripción corta"
      : "Descripción ausente";
  }
  return null;
};

const validateForReceiver = (product: ImportCandidate, catalog: ImportCatalog, receiver: ImportReceiver): readonly string[] => {
  const issues: string[] = [];
  const category = catalog.categories.find((item) => item.id === product.categorySellID);
  if (!validText(commercialReference(product))) issues.push(product.providerId === "gam"
    ? "Referencia comercial GAM (externalReference) ausente" : "Referencia ausente");
  if (!validText(product.title)) issues.push("Título ausente");
  if (product.condition !== "Segunda_Mano" && product.condition !== "Nuevo") issues.push("Condición incompatible o no confirmada para importación");
  if (!category || category.active === false || category.name !== product.category ||
    (receiver === "excel" && catalog.categories.filter((item) => item.active !== false && item.name === product.category).length !== 1) ||
    !product.condition || !isLeafCategoryForCondition(category.id, catalog.categories, product.condition)) {
    issues.push(receiver === "excel" ? "Categoría no coincide de forma única con el backend" : "Categoría no válida para create/many");
  }
  if ((receiver === "excel" && product.price === null) ||
    (product.price !== null && (!Number.isFinite(product.price) || product.price <= 0))) {
    issues.push("Precio ausente o inválido");
  }
  const descriptionIssue = descriptionImportIssue(product.description, product.description_general);
  if (descriptionIssue) issues.push(descriptionIssue);
  if (product.images.length === 0 || product.images.some((image) => {
    try { return !["http:", "https:"].includes(new URL(image).protocol); }
    catch { return true; }
  })) issues.push("URL de imagen ausente o inválida");

  const active = new Set(catalog.relations.filter((relation) =>
    relation.categoryID === product.categorySellID && relation.actived !== false
  ).map((relation) => relation.attributeID));
  const byId = new Map(catalog.attributes.map((attribute) => [attribute.id, attribute]));
  const seen = new Set<number>();
  for (const attribute of product.attributes) {
    const definition = byId.get(attribute.attributeID);
    if (!definition || !active.has(attribute.attributeID) || seen.has(attribute.attributeID)) {
      issues.push(`Atributo no asociado o duplicado: ${attribute.attributeID}`);
    }
    if (typeof attribute.value === "string" && !attribute.value.trim()) {
      issues.push(`Atributo vacío: ${attribute.attributeID}`);
    }
    if ((definition?.type === "NUMBER" || definition?.type === "DECIMAL") &&
      (typeof attribute.value !== "number" || !Number.isFinite(attribute.value))) {
      issues.push(`Atributo numérico inválido: ${attribute.attributeID}`);
    }
    if (definition?.type === "BOOLEAN" && typeof attribute.value !== "boolean") {
      issues.push(`Atributo booleano inválido: ${attribute.attributeID}`);
    }
    if ((definition?.type === "SELECT" || definition?.type === "TEXT") && typeof attribute.value !== "string") {
      issues.push(`Atributo de texto inválido: ${attribute.attributeID}`);
    }
    if (definition?.type === "DATE" || definition?.type === "MULTISELECT") {
      issues.push(`Atributo sin equivalencia de normalización confirmada: ${attribute.attributeID}`);
    }
    seen.add(attribute.attributeID);
  }
  for (const definition of catalog.attributes.filter((attribute) => active.has(attribute.id) && attribute.required)) {
    if (!seen.has(definition.id)) issues.push(`Atributo obligatorio ausente: ${definition.name}`);
  }
  return issues;
};

export const validateImportCandidate = (product: ImportCandidate, catalog: ImportCatalog): readonly string[] =>
  validateForReceiver(product, catalog, "excel");

export const validateCreateManyCandidate = (product: ImportCandidate, catalog: ImportCatalog): readonly string[] =>
  validateForReceiver(product, catalog, "createMany");
