import type { ProductRecord } from "../../contracts/catalog.js";
import { distinguishDescriptions } from "../normalization/descriptions.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../legacy-export/import-validation.js";
import { resolveCategory } from "./mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { productAttributes } from "./product-attributes.js";
import { sourceAttributeQualityIssues, sourceTechnicalQualityIssues } from "./source/attribute-quality.js";
import { resolveCommercialCondition } from "./condition.js";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";
import { resolveMercaelevaShortDescription } from "./mapping/providers/mercaeleva/descriptions.js";
import { resolveGomarizShortDescription } from "./mapping/providers/gomariz/short-description.js";
import { gamElevationSourceIdentityConflict } from "./evidence/providers/gam/elevation-identity.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./reconciliation/gam.js";
import { publicationConflictForMercaeleva, reconcileMercaelevaForPreparation } from "./reconciliation/mercaeleva.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const publicationConflict = publicationConflictForMercaeleva(record);
  record = reconcileGamInitialIdentity(record);
  const originalSpecs = record.specs;
  record = reconcileGamForPreparation(record);
  record = reconcileMercaelevaForPreparation(record);
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = catalog ? resolveCategory(record, catalog.categories, condition) : null;
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const title = record.title?.trim() || null;
  const descriptionEvidence = resolveMercaelevaShortDescription(record);
  const descriptions = distinguishDescriptions(record.shortDescription ?? descriptionEvidence.description ?? resolveGomarizShortDescription(record), record.longDescription);
  if (descriptionEvidence.heightConflict) issues.push("Descripción comercial contradictoria: altura de trabajo");
  if (gamElevationSourceIdentityConflict(record)) issues.push("Identidad GAM contradictoria entre título, resumen y ficha técnica");
  const attributeResult = catalog ? productAttributes(record, category, catalog) : null;

  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  if (publicationConflict !== null) issues.push(publicationConflict);
  if (!reference) issues.push("Referencia ausente");
  if (price === null && /\d/.test(record.price ?? "")) issues.push("Precio publicado inválido");
  issues.push(...(catalog === null ? sourceTechnicalQualityIssues(record) :
    category ? attributeResult!.qualityIssues : sourceAttributeQualityIssues(record, catalog)));

  const product: ImportCandidate = {
    providerId: record.providerId,
    sourceUrl: record.url,
    reference,
    ...(record.providerId === "gam" ? { externalReference: record.externalReference?.trim() || null } : {}),
    title,
    categorySellID: category?.id ?? null,
    category: catalog === null ? record.categoryName.trim() || null : category?.name ?? null,
    condition,
    price,
    description_title: title,
    description: descriptions.short,
    description_general: descriptions.long,
    image: images[0] ?? null,
    images,
    spec: originalSpecs ?? {},
    attributes: attributeResult?.attributes ?? []
  };
  return {
    status: issues.length ? "review" : "ready",
    issues,
    ...(catalog === null ? {} : { importIssues: {
      excel: validateImportCandidate(product, catalog),
      createMany: validateCreateManyCandidate(product, catalog)
    } }),
    product
  };
};

export const prepareWithCatalog = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => prepare(record, catalog);
export const prepareSourceProduct = (record: ProductRecord): PreparedProduct => prepare(record, null);
