import type { ProductRecord } from "../../../contracts/catalog.js";
import { distinguishDescriptions } from "../../normalization/descriptions.js";
import { validateCreateManyCandidate, validateImportCandidate } from "./import-validation.js";
import { resolveCategory } from "../mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { productAttributes } from "./product-attributes.js";
import { resolveCommercialCondition } from "./condition.js";
import { resolveMercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";
import type { ImportCandidate, ImportCatalog, PreparedProduct } from "./contracts.js";

export const prepareProduct = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => {
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = resolveCategory(record, catalog.categories, condition);
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const title = record.title?.trim() || null;
  const descriptionEvidence = resolveMercaelevaShortDescription(record);
  const descriptions = distinguishDescriptions(record.shortDescription ?? descriptionEvidence.description, record.longDescription);
  if (descriptionEvidence.heightConflict) issues.push("Descripción comercial contradictoria: altura de trabajo");
  const attributeResult = productAttributes(record, category, catalog);

  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  else if (condition === null) issues.push("Condición comercial no confirmada (Nuevo o Segunda_Mano)");
  if (!reference) issues.push("Referencia ausente");
  if (!category) issues.push("Categoría Equipzilla sin correspondencia inequívoca");
  if (price === null && /\d/.test(record.price ?? "")) issues.push("Precio publicado inválido");
  issues.push(...attributeResult.qualityIssues);

  const product: ImportCandidate = {
    providerId: record.providerId,
    sourceUrl: record.url,
    reference,
    title,
    categorySellID: category?.id ?? null,
    category: category?.name ?? null,
    condition,
    price,
    description_title: title,
    description: descriptions.short,
    description_general: descriptions.long,
    image: images[0] ?? null,
    images,
    spec: record.specs ?? {},
    attributes: attributeResult.attributes
  };
  return {
    status: issues.length ? "review" : "ready",
    issues,
    importIssues: {
      excel: validateImportCandidate(product, catalog),
      createMany: validateCreateManyCandidate(product, catalog)
    },
    product
  };
};
