import type { ProductRecord } from "../contracts/catalog.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../commercial/legacy-export/import-validation.js";
import { resolveCategory } from "./shared/classification/mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { excludeGamRelatedProductImages } from "../catalog/normalization/gam/gallery.js";
import { excludeGomarizForeignCover } from "../catalog/normalization/gomariz/gallery.js";
import { productAttributes } from "./product-attributes.js";
import { sourceAttributeQualityIssues, sourceTechnicalQualityIssues } from "./shared/quality/source/attribute-quality.js";
import { sourceSemanticQualityIssues } from "./shared/quality/source/semantic-quality.js";
import { preparedTechnicalConsistencyIssues } from "./shared/technical/source/technical-consistency.js";
import { resolveCommercialCondition } from "./condition.js";
import type { ImportCandidate, ImportCatalog } from "../commercial/legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";
import { applyReconciledTechnicalSpecs } from "./shared/technical/reconciliation/technical-specifications.js";
import { captureSourceEditorialEvidence } from "./shared/editorial/mapping/source-editorial-evidence.js";
import { reconcileInitialTechnicalEvidence, resolveSourceTechnicalSemanticRecord, reconcileTechnicalSourceForRecovery, reconcileTechnicalBeforeEditorial, reconcileTechnicalAfterEditorial, normalizePreparedTechnicalSpecs } from "./shared/technical/reconciliation/preparation-technical-stages.js";
import { publicationConflictForMercaeleva } from "./mercaeleva/technical/reconciliation/mercaeleva.js";
import { reconcileHandlingFamilySpecs } from "./shared/technical/reconciliation/handling-family-specifications.js";
import { presentGamVerifiedRestrictedCapacity } from "./gam/technical/reconciliation/gam-verified-capacity-coherence.js";
import { recoverBaseTechnicalSpecs } from "./shared/technical/recovery/base-technical-recovery.js";
import { recoverDocumentedTechnicalSpecs } from "./shared/technical/recovery/documented-technical-recovery.js";
import { resolvePreparedEditorial } from "./shared/editorial/mapping/prepared-editorial.js";
import { normalizePreparedEditorialPresentation } from "./shared/editorial/mapping/prepared-editorial-presentation.js";
import { reconcileUsedHandlingSource } from "./shared/editorial/mapping/source-used-handling.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const sourceUnitRecord = record;
  const coherentSource = reconcileUsedHandlingSource(sourceUnitRecord);
  if (coherentSource.year !== record.year && coherentSource.yearSource === "url") {
    record = { ...record, year: coherentSource.year, yearSource: coherentSource.yearSource };
  }
  record = reconcileInitialTechnicalEvidence(record);
  const publicationConflict = publicationConflictForMercaeleva(record);
  const semanticIssues = sourceSemanticQualityIssues(resolveSourceTechnicalSemanticRecord(record));
  record = reconcileTechnicalSourceForRecovery(record);
  const sourceYearSpecs = recoverBaseTechnicalSpecs(record, sourceUnitRecord);
  const { documentedSpecs } = recoverDocumentedTechnicalSpecs(sourceUnitRecord, sourceYearSpecs);
  const beforeReconciliation = record;
  record = reconcileTechnicalBeforeEditorial(record);
  record = reconcileTechnicalAfterEditorial(record);
  const reconciledSpecs = applyReconciledTechnicalSpecs(beforeReconciliation, record, documentedSpecs);
  const editorialRecord: ProductRecord = { ...record, specs: reconciledSpecs,
    shortDescription: sourceUnitRecord.shortDescription, longDescription: coherentSource.longDescription };
  const sourceEditorial = captureSourceEditorialEvidence(editorialRecord);
  const qualityRecord = coherentSource === sourceUnitRecord ? record :
    { ...record, longDescription: coherentSource.longDescription };
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = catalog ? resolveCategory(record, catalog.categories, condition) : null;
  const sourceImages = imageUrls(record);
  const images = record.providerId === "gam" && record.image === sourceImages[0]
    ? excludeGamRelatedProductImages(sourceImages, record) : record.providerId === "gomariz"
      ? excludeGomarizForeignCover(sourceImages, record.reference) : sourceImages;
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const editorial = resolvePreparedEditorial(editorialRecord, sourceUnitRecord, sourceEditorial);
  const attributeResult = catalog ? productAttributes(qualityRecord, category, catalog) : null;
  if (editorial.heightConflict) issues.push("Descripción comercial contradictoria: altura de trabajo");
  if (editorial.sourceIdentityConflict) issues.push("Identidad GAM contradictoria entre título, resumen y ficha técnica");
  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  if (publicationConflict !== null) issues.push(publicationConflict);
  issues.push(...semanticIssues);
  if (!reference) issues.push("Referencia ausente");
  if (price === null && /\d/.test(record.price ?? "")) issues.push("Precio publicado inválido");
  issues.push(...(catalog === null ? sourceTechnicalQualityIssues(qualityRecord) :
    category ? attributeResult!.qualityIssues : sourceAttributeQualityIssues(qualityRecord, catalog)));

  const descriptions = { short: editorial.preparedShort, general: editorial.preparedLong };
  issues.push(...preparedTechnicalConsistencyIssues(qualityRecord, reconciledSpecs));
  const normalizedSpecs = normalizePreparedTechnicalSpecs(record, reconciledSpecs);
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
    spec: reconcileHandlingFamilySpecs(editorialRecord, presentGamVerifiedRestrictedCapacity(record, normalizedSpecs)),
    attributes: attributeResult?.attributes ?? []
  };
  const presented = normalizePreparedEditorialPresentation(sourceUnitRecord, product);
  if (!presented.description?.trim()) issues.push("Cobertura editorial insuficiente: descripción corta");
  if (!presented.description_general?.trim()) issues.push("Cobertura editorial insuficiente: descripción general");
  return {
    status: issues.length ? "review" : "ready",
    issues,
    ...(catalog === null ? {} : { importIssues: {
      excel: validateImportCandidate(presented, catalog),
      createMany: validateCreateManyCandidate(presented, catalog)
    } }),
    product: presented
  };
};

export const prepareWithCatalog = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => prepare(record, catalog);
export const prepareSourceProduct = (record: ProductRecord): PreparedProduct => prepare(record, null);
