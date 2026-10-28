import type { ImportCatalog, ImportCandidate } from "./contracts.js";
import type { PreparationDocument } from "../preparation/preparation-document.js";
import type { ReferenceInventory } from "./reference-inventory.js";
import { selectImportCandidates } from "./select-candidates.js";
import type { ImportIssue } from "./select-candidates.js";

export type CreateManyProduct = {
  readonly title: string;
  readonly categorySellID: number;
  readonly condition: "Nuevo" | "Segunda_Mano";
  readonly companyID: number;
  readonly description: string;
  readonly reference: string;
  readonly image: string;
  readonly images: readonly string[];
  readonly description_general?: string;
  readonly description_title?: string;
  readonly price?: number;
  readonly attributes: ImportCandidate["attributes"];
  readonly spec?: ImportCandidate["spec"];
};

export type CreateManyPlan = {
  readonly products: readonly CreateManyProduct[];
  readonly report: {
    readonly providerId: string;
    readonly companyID: number;
    readonly total: number;
    readonly newProducts: number;
    readonly existingProducts: number;
    readonly reviewProducts: number;
    readonly duplicateReferences: number;
    readonly selectedSources: readonly { readonly reference: ImportCandidate["reference"]; readonly sourceUrl: string }[];
    readonly existing: readonly ImportIssue[];
    readonly review: readonly ImportIssue[];
    readonly duplicates: readonly ImportIssue[];
  };
};

const toCreateManyProduct = (product: ImportCandidate, companyID: number): CreateManyProduct => {
  const { title, categorySellID, condition, description, reference, image, images } = product;
  if (!title || categorySellID === null || !condition || !description || !reference || !image || images.length === 0) {
    throw new Error("Producto incompleto para el contrato create/many");
  }
  return {
    title, categorySellID, condition, companyID, description, reference, image, images,
    attributes: product.attributes,
    ...(product.description_general ? { description_general: product.description_general } : {}),
    ...(product.description_title ? { description_title: product.description_title } : {}),
    ...(product.price === null ? {} : { price: product.price }),
    ...(Object.keys(product.spec).length > 0 ? { spec: product.spec } : {})
  };
};

export const planCreateMany = (
  document: PreparationDocument, providerId: string, inventory: ReferenceInventory, catalog: ImportCatalog
): CreateManyPlan => {
  const { selected, existing, review, duplicates } = selectImportCandidates(document, providerId, inventory, catalog, "createMany");
  return {
    products: selected.map((product) => toCreateManyProduct(product, inventory.companyID)),
    report: {
      providerId, companyID: inventory.companyID, total: document.products.length,
      newProducts: selected.length, existingProducts: existing.length,
      reviewProducts: review.length, duplicateReferences: duplicates.length,
      selectedSources: selected.map((product) => ({ reference: product.reference, sourceUrl: product.sourceUrl })),
      existing, review, duplicates
    }
  };
};
