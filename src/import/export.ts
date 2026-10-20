import type { ImportCandidate, ImportCatalog, PreparedProduct } from "./prepare.js";
import type { CellValue } from "./xlsx.js";
import { parseCsv } from "../shared/csvParse.js";

const fixedHeaders = [
  "Referencia *", "Categoría *", "Título *", "Condición *", "Precio *",
  "Descripción título", "Descripción *", "Descripción general", "Estado de fila"
] as const;

const urlHeaders = Array.from({ length: 10 }, (_, index) => index === 0 ? "URL 1 *" : `URL ${index + 1}`);

export type ReferenceInventory = { readonly companyID: number; readonly references: ReadonlySet<string> };

export type PreparationDocument = {
  readonly quality: "complete";
  readonly published: true;
  readonly products: readonly PreparedProduct[];
};

export type ImportIssue = { readonly reference: string | null; readonly sourceUrl: string; readonly reason: string };

export type ImportPlan = {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly CellValue[])[];
  readonly report: {
    readonly providerId: string;
    readonly companyID: number;
    readonly total: number;
    readonly newProducts: number;
    readonly existingProducts: number;
    readonly reviewProducts: number;
    readonly duplicateReferences: number;
    readonly extraImages: number;
    readonly existing: readonly ImportIssue[];
    readonly review: readonly ImportIssue[];
    readonly duplicates: readonly ImportIssue[];
  };
};

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const validText = (input: unknown): input is string => typeof input === "string" && input.trim().length > 0;

const referenceKey = (value: string): string => value.trim().toLocaleUpperCase("es");

export const readReferenceInventory = (csv: string, companyID: number): ReferenceInventory => {
  const parsed = parseCsv(csv.replace(/^\ufeff/, ""));
  if (!parsed.headers.includes("companyID") || !parsed.headers.includes("reference") ||
    new Set(parsed.headers).size !== parsed.headers.length) {
    throw new Error("El inventario CSV debe incluir las columnas companyID y reference sin duplicados");
  }
  const references = new Set<string>();
  for (const row of parsed.rows) {
    const company = row.companyID?.trim();
    if (!company || !/^\d+$/.test(company) || Number(company) !== companyID) {
      throw new Error("El inventario incluye registros sin companyID válido o de otra empresa");
    }
    if (!validText(row.reference)) throw new Error("El inventario incluye una referencia vacía");
    references.add(referenceKey(row.reference));
  }
  return { companyID, references };
};

const isAttributeValue = (input: unknown): input is string | number | boolean =>
  typeof input === "string" || typeof input === "boolean" || (typeof input === "number" && Number.isFinite(input));

const isCandidate = (input: unknown): input is ImportCandidate => {
  if (!isRecord(input)) return false;
  return validText(input.providerId) && validText(input.sourceUrl) &&
    (input.reference === null || typeof input.reference === "string") &&
    (input.title === null || typeof input.title === "string") &&
    (input.categorySellID === null || Number.isSafeInteger(input.categorySellID)) &&
    (input.category === null || typeof input.category === "string") &&
    input.condition === "Segunda_Mano" &&
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

const attributeHeader = (attribute: ImportCatalog["attributes"][number]): string =>
  attribute.type !== "SELECT" && attribute.type !== "BOOLEAN" && attribute.unit_option.trim()
    ? `${attribute.name} (${attribute.unit_option})`
    : attribute.name;

const productIssues = (product: ImportCandidate, catalog: ImportCatalog): readonly string[] => {
  const issues: string[] = [];
  const category = catalog.categories.find((item) => item.id === product.categorySellID);
  if (!validText(product.reference)) issues.push("Referencia ausente");
  if (!validText(product.title)) issues.push("Título ausente");
  if (!category || category.name !== product.category ||
    catalog.categories.filter((item) => item.name === product.category).length !== 1) {
    issues.push("Categoría no coincide de forma única con el backend");
  }
  if (product.price === null || product.price <= 0) issues.push("Precio ausente o inválido");
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
    if (definition?.type === "NUMBER" && typeof attribute.value !== "number") {
      issues.push(`Atributo numérico inválido: ${attribute.attributeID}`);
    }
    if (definition?.type === "BOOLEAN" && typeof attribute.value !== "boolean") {
      issues.push(`Atributo booleano inválido: ${attribute.attributeID}`);
    }
    seen.add(attribute.attributeID);
  }
  for (const definition of catalog.attributes.filter((attribute) => active.has(attribute.id) && attribute.required)) {
    if (!seen.has(definition.id)) issues.push(`Atributo obligatorio ausente: ${definition.name}`);
  }
  return issues;
};

export const planProductImport = (
  document: PreparationDocument, providerId: string, inventory: ReferenceInventory, catalog: ImportCatalog
): ImportPlan => {
  const counts = new Map<string, number>();
  for (const entry of document.products) {
    const reference = entry.product.reference;
    if (validText(reference)) {
      const key = referenceKey(reference);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const existing: ImportIssue[] = [];
  const review: ImportIssue[] = [];
  const duplicates: ImportIssue[] = [];
  const selected: ImportCandidate[] = [];
  for (const entry of document.products) {
    const product = entry.product;
    if (product.providerId !== providerId) throw new Error("El lote mezcla proveedores");
    const reference = product.reference;
    const issue = { reference, sourceUrl: product.sourceUrl };
    if (validText(reference) && (counts.get(referenceKey(reference)) ?? 0) > 1) {
      duplicates.push({ ...issue, reason: "Referencia duplicada en la extracción" });
      continue;
    }
    if (entry.status === "review" || entry.issues.length > 0) {
      review.push({ ...issue, reason: [...entry.issues, ...productIssues(product, catalog)].join("; ") || "Requiere revisión" });
      continue;
    }
    const issues = productIssues(product, catalog);
    if (issues.length > 0) {
      review.push({ ...issue, reason: issues.join("; ") });
      continue;
    }
    if (reference && inventory.references.has(referenceKey(reference))) {
      existing.push({ ...issue, reason: "La referencia ya está en el inventario de la empresa; no se actualiza" });
      continue;
    }
    selected.push(product);
  }

  const attrIds = new Set(selected.flatMap((product) => product.attributes.map((attr) => attr.attributeID)));
  const attributes = catalog.attributes.filter((attr) => attrIds.has(attr.id));
  const headers = [...fixedHeaders, ...attributes.map(attributeHeader), ...urlHeaders];
  if (new Set(headers).size !== headers.length) throw new Error("Conflicto entre nombres de atributos y columnas del importador");
  const rows = selected.map((product) => {
    const values = new Map(product.attributes.map((attr) => [attr.attributeID, attr.value]));
    return [
      product.reference, product.category, product.title, product.condition, product.price,
      product.description_title ?? "", product.description, product.description_general ?? "", "",
      ...attributes.map((attr) => values.get(attr.id) ?? null),
      ...urlHeaders.map((_, index) => product.images[index] ?? null)
    ] as readonly CellValue[];
  });
  return {
    headers, rows,
    report: {
      providerId, companyID: inventory.companyID, total: document.products.length, newProducts: selected.length,
      existingProducts: existing.length, reviewProducts: review.length, duplicateReferences: duplicates.length,
      extraImages: selected.reduce((count, product) => count + Math.max(0, product.images.length - 10), 0),
      existing, review, duplicates
    }
  };
};
