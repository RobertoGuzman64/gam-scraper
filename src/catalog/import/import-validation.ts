import type { ImportCandidate, ImportCatalog } from "./prepare.js";

const validText = (input: unknown): input is string => typeof input === "string" && input.trim().length > 0;

export const validateImportCandidate = (product: ImportCandidate, catalog: ImportCatalog): readonly string[] => {
  const issues: string[] = [];
  const category = catalog.categories.find((item) => item.id === product.categorySellID);
  if (!validText(product.reference)) issues.push("Referencia ausente");
  if (!validText(product.title)) issues.push("Título ausente");
  if (product.condition !== "Segunda_Mano") issues.push("Condición incompatible o no confirmada para importación");
  if (!category || category.name !== product.category ||
    catalog.categories.filter((item) => item.name === product.category).length !== 1) {
    issues.push("Categoría no coincide de forma única con el backend");
  }
  if (product.price === null || !Number.isFinite(product.price) || product.price <= 0) issues.push("Precio ausente o inválido");
  if (!validText(product.description)) issues.push("Descripción ausente");
  if (product.images.length === 0 || product.images.some((image) => {
    try { return !["http:", "https:"].includes(new URL(image).protocol); }
    catch { return true; }
  })) issues.push("URL de imagen ausente o inválida");

  const active = new Set(catalog.relations.filter((relation) => relation.categoryID === product.categorySellID).map((relation) => relation.attributeID));
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
    if (definition?.type === "NUMBER" && (typeof attribute.value !== "number" || !Number.isFinite(attribute.value))) {
      issues.push(`Atributo numérico inválido: ${attribute.attributeID}`);
    }
    if (definition?.type === "BOOLEAN" && typeof attribute.value !== "boolean") {
      issues.push(`Atributo booleano inválido: ${attribute.attributeID}`);
    }
    if ((definition?.type === "SELECT" || definition?.type === "TEXT") && typeof attribute.value !== "string") {
      issues.push(`Atributo de texto inválido: ${attribute.attributeID}`);
    }
    seen.add(attribute.attributeID);
  }
  for (const definition of catalog.attributes.filter((attribute) => active.has(attribute.id) && attribute.required)) {
    if (!seen.has(definition.id)) issues.push(`Atributo obligatorio ausente: ${definition.name}`);
  }
  return issues;
};

