import type { ImportCandidate, ImportCatalog } from "./contracts.js";
import type { PreparationDocument } from "../preparation/preparation-document.js";
import type { CellValue } from "../../infrastructure/spreadsheet/xlsx.js";
import type { ReferenceInventory } from "./reference-inventory.js";
export { readReferenceInventory } from "./reference-inventory.js";
export type { ReferenceInventory } from "./reference-inventory.js";
import { selectImportCandidates } from "./select-candidates.js";
import type { ImportIssue } from "./select-candidates.js";

const fixedHeaders = [
  "Referencia *", "Categoría *", "Título *", "Condición *", "Precio *",
  "Descripción título", "Descripción *", "Descripción general", "Estado de fila"
] as const;

const urlHeaders = Array.from({ length: 10 }, (_, index) => index === 0 ? "URL 1 *" : `URL ${index + 1}`);

export type { ImportIssue } from "./select-candidates.js";

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
    readonly selectedSources: readonly { readonly reference: ImportCandidate["reference"]; readonly sourceUrl: string }[];
    readonly existing: readonly ImportIssue[];
    readonly review: readonly ImportIssue[];
    readonly duplicates: readonly ImportIssue[];
  };
};

const attributeHeader = (attribute: ImportCatalog["attributes"][number]): string =>
  attribute.type !== "SELECT" && attribute.type !== "BOOLEAN" && attribute.unit_option.trim()
    ? `${attribute.name} (${attribute.unit_option})`
    : attribute.name;


export const planProductImport = (
  document: PreparationDocument, providerId: string, inventory: ReferenceInventory, catalog: ImportCatalog
): ImportPlan => {
  const { selected, existing, review, duplicates } = selectImportCandidates(document, providerId, inventory, catalog, "excel");

  const attrIds = new Set(selected.flatMap((product) => product.attributes.map((attr) => attr.attributeID)));
  const attributes = catalog.attributes.filter((attr) => attrIds.has(attr.id));
  const headersByAttribute = new Map(attributes.map((attribute) => [attribute.id, attributeHeader(attribute)]));
  const attributeHeaders = [...new Set(attributes.map(attributeHeader))];
  const headers = [...fixedHeaders, ...attributeHeaders, ...urlHeaders];
  if (new Set(headers).size !== headers.length) throw new Error("Conflicto entre nombres de atributos y columnas del importador");
  const rows = selected.map((product) => {
    const values = new Map<string, string | number | boolean>();
    for (const attribute of product.attributes) {
      const header = headersByAttribute.get(attribute.attributeID);
      if (!header) throw new Error(`Atributo sin cabecera reconocida: ${attribute.attributeID}`);
      if (values.has(header)) throw new Error(`Atributos con cabecera ambigua para la referencia ${product.reference}: ${header}`);
      values.set(header, attribute.value);
    }
    return [
      product.reference, product.category, product.title, product.condition, product.price,
      product.description_title ?? "", product.description, product.description_general ?? "", "",
      ...attributeHeaders.map((header) => values.get(header) ?? null),
      ...urlHeaders.map((_, index) => product.images[index] ?? null)
    ] as readonly CellValue[];
  });
  return {
    headers, rows,
    report: {
      providerId, companyID: inventory.companyID, total: document.products.length, newProducts: selected.length,
      existingProducts: existing.length, reviewProducts: review.length, duplicateReferences: duplicates.length,
      extraImages: selected.reduce((count, product) => count + Math.max(0, product.images.length - 10), 0),
      selectedSources: selected.map((product) => ({ reference: product.reference, sourceUrl: product.sourceUrl })),
      existing, review, duplicates
    }
  };
};
