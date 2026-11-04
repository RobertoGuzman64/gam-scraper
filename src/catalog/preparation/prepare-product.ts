import type { ProductRecord } from "../../contracts/catalog.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../legacy-export/import-validation.js";
import { resolveCategory } from "./mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { productAttributes } from "./product-attributes.js";
import { sourceAttributeQualityIssues, sourceTechnicalQualityIssues } from "./source/attribute-quality.js";
import { sourceSemanticQualityIssues } from "./source/semantic-quality.js";
import { resolveCommercialCondition } from "./condition.js";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./reconciliation/gam.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "./evidence/providers/mercaeleva/verified-platform-source-specs.js";
import { publicationConflictForMercaeleva, reconcileMercaelevaForPreparation } from "./reconciliation/mercaeleva.js";
import { captureSourceEditorialEvidence } from "./mapping/source-editorial-evidence.js";
import { recoverBaseTechnicalSpecs } from "./recovery/gam-technical-recovery.js";
import { recoverDocumentedTechnicalSpecs } from "./recovery/documented-technical-recovery.js";
import { resolvePreparedEditorial } from "./mapping/prepared-editorial.js";
import { finalizePreparedEditorial } from "./mapping/verified-editorial-finalization.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const sourceUnitRecord = record;
  const sourceEditorial = captureSourceEditorialEvidence(record);
  const publicationConflict = publicationConflictForMercaeleva(record);
  const semanticIssues = sourceSemanticQualityIssues(record);
  record = reconcileGamInitialIdentity(record);
  record = reconcileMercaelevaVerifiedPlatformSourceSpecs(record);
  const sourceYearSpecs = recoverBaseTechnicalSpecs(record, sourceUnitRecord);
  const { sourceFuelSpecs, documentedSpecs } = recoverDocumentedTechnicalSpecs(sourceUnitRecord, sourceYearSpecs);
  record = reconcileGamForPreparation(record);
  record = reconcileMercaelevaForPreparation(record);
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = catalog ? resolveCategory(record, catalog.categories, condition) : null;
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const editorial = resolvePreparedEditorial(record, sourceUnitRecord, sourceEditorial);
  const attributeResult = catalog ? productAttributes(record, category, catalog) : null;
  if (editorial.heightConflict) issues.push("Descripción comercial contradictoria: altura de trabajo");
  if (editorial.sourceIdentityConflict) issues.push("Identidad GAM contradictoria entre título, resumen y ficha técnica");
  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  if (publicationConflict !== null) issues.push(publicationConflict);
  issues.push(...semanticIssues);
  if (!reference) issues.push("Referencia ausente");
  if (price === null && /\d/.test(record.price ?? "")) issues.push("Precio publicado inválido");
  issues.push(...(catalog === null ? sourceTechnicalQualityIssues(record) :
    category ? attributeResult!.qualityIssues : sourceAttributeQualityIssues(record, catalog)));

  const descriptions = finalizePreparedEditorial(
    record, sourceUnitRecord, editorial.preparedShort, editorial.preparedLong,
    sourceFuelSpecs, issues.length === 0
  );
  const product: ImportCandidate = {
    providerId: record.providerId,
    sourceUrl: record.url,
    reference,
    ...(record.providerId === "gam" ? { externalReference: record.externalReference?.trim() || null } : {}),
    title: editorial.title,
    categorySellID: category?.id ?? null,
    category: catalog === null ? record.categoryName.trim() || null : category?.name ?? null,
    condition,
    price,
    description_title: editorial.title,
    description: descriptions.short,
    description_general: descriptions.general,
    image: images[0] ?? null,
    images,
    spec: documentedSpecs,
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
