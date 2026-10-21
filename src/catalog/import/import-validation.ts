import type { ImportCandidate, ImportCatalog } from "./prepare.js";

const validText = (input: unknown): input is string => typeof input === "string" && input.trim().length > 0;

const isUsedLeafCategory = (categoryId: number, catalog: ImportCatalog): boolean => {
  const roots = catalog.categories.filter((item) => item.name === "Maquinaria de Ocasión");
  if (roots.length !== 1 || catalog.categories.some((item) => item.parentId === categoryId)) return false;
  const categories = new Map(catalog.categories.map((item) => [item.id, item]));
  const visited = new Set<number>();
  let parentId = categories.get(categoryId)?.parentId ?? null;
  while (parentId !== null && !visited.has(parentId)) {
    if (parentId === roots[0]?.id) return true;
    visited.add(parentId);
    parentId = categories.get(parentId)?.parentId ?? null;
  }
  return false;
};

export const descriptionImportIssue = (description: string | null, descriptionGeneral: string | null): string | null => {
  if (!validText(description)) {
    return validText(descriptionGeneral)
      ? "Descripción corta ausente: solo hay descripción general y el backend exige una descripción corta"
      : "Descripción ausente";
  }
  if (!validText(descriptionGeneral)) {
    return "Descripción general ausente: el backend duplicaría la descripción corta al crear el producto";
  }
  if (description.replace(/\s+/g, " ").trim() === descriptionGeneral.replace(/\s+/g, " ").trim()) {
    return "Descripciones corta y general duplicadas";
  }
  return null;
};

export const validateImportCandidate = (product: ImportCandidate, catalog: ImportCatalog): readonly string[] => {
  const issues: string[] = [];
  const category = catalog.categories.find((item) => item.id === product.categorySellID);
  if (!validText(product.reference)) issues.push("Referencia ausente");
  if (!validText(product.title)) issues.push("Título ausente");
  if (product.condition !== "Segunda_Mano") issues.push("Condición incompatible o no confirmada para importación");
  if (!category || category.name !== product.category ||
    catalog.categories.filter((item) => item.name === product.category).length !== 1 ||
    !isUsedLeafCategory(category.id, catalog)) {
    issues.push("Categoría no coincide de forma única con el backend");
  }
  if (product.price === null || !Number.isFinite(product.price) || product.price <= 0) issues.push("Precio ausente o inválido");
  const descriptionIssue = descriptionImportIssue(product.description, product.description_general);
  if (descriptionIssue) issues.push(descriptionIssue);
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

