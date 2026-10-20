import type { ImportCandidate, ImportCatalog } from "./prepare.js";
import type { PreparationDocument } from "./preparation-document.js";
import type { CellValue } from "./xlsx.js";
import { parseCsv } from "../../shared/csv-parse.js";
import { validateImportCandidate } from "./import-validation.js";

const fixedHeaders = [
  "Referencia *", "Categoría *", "Título *", "Condición *", "Precio *",
  "Descripción título", "Descripción *", "Descripción general", "Estado de fila"
] as const;

const urlHeaders = Array.from({ length: 10 }, (_, index) => index === 0 ? "URL 1 *" : `URL ${index + 1}`);

export type ReferenceInventory = { readonly companyID: number; readonly references: ReadonlySet<string> };

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

const attributeHeader = (attribute: ImportCatalog["attributes"][number]): string =>
  attribute.type !== "SELECT" && attribute.type !== "BOOLEAN" && attribute.unit_option.trim()
    ? `${attribute.name} (${attribute.unit_option})`
    : attribute.name;


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
      review.push({ ...issue, reason: [...entry.issues, ...validateImportCandidate(product, catalog)].join("; ") || "Requiere revisión" });
      continue;
    }
    const issues = validateImportCandidate(product, catalog);
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
