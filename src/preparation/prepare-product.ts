import type { ProductRecord } from "../contracts/catalog.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../commercial/legacy-export/import-validation.js";
import { resolveCategory } from "./classification/category-mapping.js";
import { imageUrls, normalizePrice } from "./product/product-fields.js";
import { excludeGamRelatedProductImages } from "../catalog/normalization/gam/gallery.js";
import { excludeGomarizForeignCover } from "../catalog/normalization/gomariz/gallery.js";
import { productAttributes } from "./product/product-attributes.js";
import { sourceAttributeQualityIssues, sourceTechnicalQualityIssues } from "./quality/attribute-quality.js";
import { canOmitImplausiblePlatformWeight, sourceSemanticQualityIssues, withoutRejectedWeight } from "./quality/semantic-quality.js";
import { preparedTechnicalConsistencyIssues } from "./technical/technical-consistency.js";
import { resolveCommercialCondition } from "./product/condition.js";
import type { ImportCandidate, ImportCatalog } from "../commercial/legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";
import { captureTechnicalProvenance } from "./provenance/technical-provenance.js";
import { applyReconciledTechnicalSpecs } from "./technical/technical-specifications.js";
import { captureSourceEditorialEvidence } from "./editorial/claims/source-editorial-evidence.js";
import { reconcileSourceCategoryTitle, reconcileVerifiedSourceReviewClaims, reconcileVerifiedSourceFamily, reconcileVerifiedSourceFuel, reconcileVerifiedSourceIdentity, reconcileVerifiedManufacturerSourceLoad, reconcileInitialTechnicalEvidence, resolveSourceTechnicalSemanticRecord, reconcileTechnicalSourceForRecovery, reconcileTechnicalBeforeEditorial, reconcileTechnicalAfterEditorial, normalizePreparedTechnicalSpecs } from "./technical/preparation-technical-stages.js";
import { publicationConflictForMercaeleva } from "./mercaeleva/technical/mercaeleva.js";
import { hasDocumentedGomarizPriceOnRequest } from "./gomariz/price-on-request.js";
import { normalizeOriginalEnergyPresentation, normalizeOriginalLengthPresentation, normalizeOriginalMassPresentation } from "./technical/technical-presentation.js";
import { reconcileHandlingFamilySpecs } from "./technical/handling-family-specifications.js";
import { presentGamVerifiedRestrictedCapacity } from "./gam/reconciliation/gam-verified-capacity-coherence.js";
import { recoverSourcePlatformGeometry } from "./technical/platform-geometry-recovery.js";
import { recoverBaseTechnicalSpecs } from "./technical/base-technical-recovery.js";
import { recoverReviewedModelTechnicalSpecs } from "./technical/documented-technical-evidence.js";
import { recoverDocumentedTechnicalSpecs } from "./technical/documented-technical-recovery.js";
import { resolvePreparedEditorial } from "./editorial/core/prepared-editorial.js";
import { normalizePreparedEditorialPresentation } from "./editorial/writing/prepared-editorial-presentation.js";
import { reconcileUsedHandlingSource } from "./editorial/identity/source-used-handling.js";
import { hasVerifiedPublishedEditorialLoadConflict } from "./editorial/measurements/coherence/prepared-editorial-load-consistency.js";
import { reconcileManainEditorialSourceSpecs } from "./manain/domain-source.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const originalRecord = record;
  const technicalProvenance = captureTechnicalProvenance(originalRecord);
  const categorizedSource = reconcileSourceCategoryTitle(record);
  const verifiedClaims = reconcileVerifiedSourceReviewClaims(categorizedSource);
  const technicalSource = reconcileVerifiedManufacturerSourceLoad(
    reconcileVerifiedSourceIdentity(reconcileVerifiedSourceFuel(verifiedClaims)));
  record = reconcileVerifiedSourceFamily(technicalSource);
  const restoredFamily = record !== technicalSource;
  const sourceUnitRecord = record;
  const coherentSource = reconcileUsedHandlingSource(sourceUnitRecord);
  if (coherentSource.year !== record.year && coherentSource.yearSource === "url") {
    record = { ...record, year: coherentSource.year, yearSource: coherentSource.yearSource };
  }
  record = reconcileInitialTechnicalEvidence(record);
  const publicationConflict = publicationConflictForMercaeleva(record);
  const semanticRecord = resolveSourceTechnicalSemanticRecord(record);
  record = reconcileTechnicalSourceForRecovery(record, technicalProvenance.observe);
  const recoverySource = record;
  const sourceYearSpecs = recoverBaseTechnicalSpecs(record, sourceUnitRecord, technicalProvenance.observe);
  const documentedOriginal = verifiedClaims !== categorizedSource ? categorizedSource :
    restoredFamily ? originalRecord : sourceUnitRecord;
  const { documentedSpecs } = recoverDocumentedTechnicalSpecs(documentedOriginal, sourceYearSpecs, technicalProvenance.observe);
  const beforeReconciliation = record;
  record = reconcileTechnicalBeforeEditorial(record, technicalProvenance.observe);
  record = reconcileTechnicalAfterEditorial(record);
  const sourceGeometrySpecs = recoverSourcePlatformGeometry(originalRecord, recoverySource,
    applyReconciledTechnicalSpecs(beforeReconciliation, record, documentedSpecs), technicalProvenance.observe);
  const reconciledSpecs = recoverReviewedModelTechnicalSpecs(originalRecord, sourceGeometrySpecs, technicalProvenance.observe);
  const editorialRecord = reconcileManainEditorialSourceSpecs({ ...record, specs: reconciledSpecs,
    shortDescription: sourceUnitRecord.shortDescription, longDescription: coherentSource.longDescription });
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
  const attributeResult = catalog ? productAttributes(qualityRecord, category, catalog) : null;
  const normalizedSpecs = normalizePreparedTechnicalSpecs(record, reconciledSpecs, technicalProvenance.observe);
  const limitedSpecs = presentGamVerifiedRestrictedCapacity(record, normalizedSpecs);
  const handledSpecs = reconcileHandlingFamilySpecs(editorialRecord, limitedSpecs);
  technicalProvenance.observe(limitedSpecs, handledSpecs,
    "src/preparation/shared/technical/reconciliation/handling-family-specifications.ts",
    { spec: "Capacidad de carga (kg)" });
  const presentedSpecs = normalizeOriginalEnergyPresentation(normalizeOriginalLengthPresentation(
    normalizeOriginalMassPresentation(handledSpecs, originalRecord.specs ?? {}), originalRecord.specs ?? {}), originalRecord.specs ?? {});
  const editorialProvenance = technicalProvenance.finalize(presentedSpecs, recoverySource);
  const editorial = resolvePreparedEditorial(editorialRecord, restoredFamily ? originalRecord : sourceUnitRecord, sourceEditorial, originalRecord);
  const descriptions = { short: editorial.preparedShort, general: editorial.preparedLong };
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
    spec: presentedSpecs,
    attributes: attributeResult?.attributes ?? []
  };
  const presented = normalizePreparedEditorialPresentation(sourceUnitRecord, product);
  const weightOmitted = canOmitImplausiblePlatformWeight(semanticRecord, editorialRecord, presented, catalog) &&
    semanticRecord.specs?.Peso === qualityRecord.specs?.Peso;
  const blockingQualityRecord = weightOmitted ? withoutRejectedWeight(qualityRecord) : qualityRecord;
  if (editorial.heightConflict) issues.push("Descripción comercial contradictoria: altura de trabajo");
  if (editorial.sourceMotorConflict) issues.push("Motorización de origen no corroborada por evidencia histórica firmada");
  if (editorial.sourceIdentityConflict) issues.push("Identidad GAM contradictoria entre título, resumen y ficha técnica");
  if (editorial.sourceModelConflict && !editorial.sourceIdentityConflict)
    issues.push("Identidad GAM contradictoria entre título y modelo técnico");
  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  if (publicationConflict !== null) issues.push(publicationConflict);
  issues.push(...sourceSemanticQualityIssues(weightOmitted ? withoutRejectedWeight(semanticRecord) : semanticRecord));
  if (!reference) issues.push("Referencia ausente");
  if (price === null && /\d/.test(record.price ?? "") &&
    !hasDocumentedGomarizPriceOnRequest(originalRecord)) issues.push("Precio publicado inválido");
  issues.push(...(catalog === null ? sourceTechnicalQualityIssues(blockingQualityRecord) :
    category ? (weightOmitted ? productAttributes(blockingQualityRecord, category, catalog).qualityIssues : attributeResult!.qualityIssues) :
      sourceAttributeQualityIssues(blockingQualityRecord, catalog)));

  issues.push(...preparedTechnicalConsistencyIssues(qualityRecord, reconciledSpecs));
  if (hasVerifiedPublishedEditorialLoadConflict(sourceUnitRecord, presented) &&
    !issues.some((issue) => /(?:atributo contradictorio: capacidad de carga|capacidad contradictoria:)/iu.test(issue))) {
    issues.push("Descripción comercial contradictoria: capacidad de carga");
  }
  if (!presented.description?.trim()) issues.push("Cobertura editorial insuficiente: descripción corta");
  if (!presented.description_general?.trim()) issues.push("Cobertura editorial insuficiente: descripción general");
  return {
    status: issues.length ? "review" : "ready",
    issues,
    ...(catalog === null ? {} : { importIssues: {
      excel: validateImportCandidate(presented, catalog),
      createMany: validateCreateManyCandidate(presented, catalog)
    } }),
    product: presented,
    technicalProvenance: presented.spec === presentedSpecs ? editorialProvenance : technicalProvenance.finalize(presented.spec, recoverySource)
  };
};

export const prepareWithCatalog = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => prepare(record, catalog);
export const prepareSourceProduct = (record: ProductRecord): PreparedProduct => prepare(record, null);
