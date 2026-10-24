import type { ProductRecord } from "../../../contracts/catalog.js";
import { distinguishDescriptions } from "../../normalization/descriptions.js";
import { validateCreateManyCandidate, validateImportCandidate } from "./import-validation.js";
import { resolveCategory } from "../mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { productAttributes } from "./product-attributes.js";
import { sourceAttributeQualityIssues } from "../mapping/source-attribute-quality.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { resolveCommercialCondition } from "./condition.js";
import { resolveMercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";
import { gamElevationSourceIdentityConflict } from "../mapping/providers/gam/elevation-identity.js";
import { reconcileGamElevationEditorialIdentity } from "../mapping/providers/gam/elevation-editorial.js";
import { reconcileGamOutdatedSourceTitle } from "../mapping/providers/gam/editorial-titles.js";
import { reconcileGamBtsEditorialSummary } from "../mapping/providers/gam/bts-editorial.js";
import { reconcileGamForkliftFuelEditorial } from "../mapping/providers/gam/forklift-fuel-editorial.js";
import { reconcileGamHandlingHeightEditorial } from "../mapping/providers/gam/handling-height-editorial.js";
import { reconcileGamHandlingCapacityEditorial } from "../mapping/providers/gam/handling-capacity-editorial.js";
import { reconcileGamOrderPickerEditorial } from "../mapping/providers/gam/orderpicker-editorial.js";
import { reconcileGamVerifiedHandlingEditorial } from "../mapping/providers/gam/handling-verified-editorial.js";
import type { ImportCandidate, ImportCatalog, PreparedProduct } from "./contracts.js";

export const prepareProduct = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => {
  record = reconcileGamOrderPickerEditorial(reconcileGamHandlingHeightEditorial(reconcileGamForkliftFuelEditorial(reconcileGamBtsEditorialSummary(reconcileGamElevationEditorialIdentity(reconcileGamOutdatedSourceTitle(record))))));
  record = reconcileGamVerifiedHandlingEditorial(reconcileGamHandlingCapacityEditorial(record));
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
  if (gamElevationSourceIdentityConflict(record)) issues.push("Identidad GAM contradictoria entre título, resumen y ficha técnica");
  const attributeResult = productAttributes(record, category, catalog);

  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  if (!reference) issues.push("Referencia ausente");
  if (!category) {
    const sourceIssue = sourceCategoryQualityIssue(record);
    if (sourceIssue) issues.push(sourceIssue);
  }
  if (price === null && /\d/.test(record.price ?? "")) issues.push("Precio publicado inválido");
  issues.push(...(category ? attributeResult.qualityIssues : sourceAttributeQualityIssues(record, catalog)));

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
