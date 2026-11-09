import type { ProductRecord } from "../contracts/catalog.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../commercial/legacy-export/import-validation.js";
import { resolveCategory } from "./shared/classification/mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { excludeGamRelatedProductImages } from "../catalog/normalization/gam/gallery.js";
import { productAttributes } from "./product-attributes.js";
import { sourceAttributeQualityIssues, sourceTechnicalQualityIssues } from "./shared/quality/source/attribute-quality.js";
import { sourceSemanticQualityIssues } from "./shared/quality/source/semantic-quality.js";
import { preparedTechnicalConsistencyIssues } from "./shared/technical/source/technical-consistency.js";
import { resolveCommercialCondition } from "./condition.js";
import type { ImportCandidate, ImportCatalog } from "../commercial/legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./gam/technical/reconciliation/gam.js";
import { reconcileGamSourceTechnicalUnits } from "./gam/technical/reconciliation/gam-source-technical-units.js";
import { normalizeMercaelevaAusaHeightText } from "./mercaeleva/technical/reconciliation/mercaeleva-ausa-height.js";
import { verifiedGamHysterH45fts5Editorial } from "./gam/technical/reconciliation/gam-hyster-h45fts5.js";
import { reconcileGamElectricTowTractorEditorial } from "./gam/editorial/models/hyster-tow-tractor-editorial.js";
import { reconcileGamModulaStorageSummary } from "./gam/editorial/models/modula-storage-editorial.js";
import { reconcileGamVerifiedYaleGp80vx } from "./gam/technical/reconciliation/gam-yale-gp80vx.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "./mercaeleva/technical/evidence/verified-platform-source-specs.js";
import { reconcileMercaelevaVerifiedLindeE48p } from "./mercaeleva/technical/evidence/linde-e48p-publication-evidence.js";
import { reconcileMercaelevaVerifiedJlg450AjBaseModel } from "./mercaeleva/technical/reconciliation/mercaeleva-jlg-450aj.js";
import { publicationConflictForMercaeleva, reconcileMercaelevaForPreparation, reconcileMercaelevaCorroboratedCapacity, reconcileMercaelevaVerifiedReachTruckFamily, reconcileMercaelevaNonUsableSentinels } from "./mercaeleva/technical/reconciliation/mercaeleva.js";
import { reconcileGomarizVerifiedPlatformHeight, reconcileGomarizVerifiedElectricSemanticSource } from "./gomariz/technical/reconciliation/gomariz.js";
import { reconcileGamCorroboratedLoadCapacity } from "./gam/technical/reconciliation/gam-capacity.js";
import { applyReconciledTechnicalSpecs } from "./shared/technical/reconciliation/technical-specifications.js";
import { reconcileGamBasketDimensions } from "./gam/technical/reconciliation/gam-basket-dimensions.js";
import { reconcileGamVerifiedBasketSizes } from "./gam/technical/reconciliation/gam-verified-basket-sizes.js";
import { reconcileGamSourceCapacitySummary, preparedGamSourceCapacityShort } from "./gam/technical/reconciliation/gam-source-capacity-summary.js";
import { removeGamVehicleListingMarkers } from "./gam/editorial/general/long-description.js";
import { reconcileGamVerifiedCapacityCoherence, reconcileGamVerifiedModelIdentity, reconcileGamVerifiedBasketLoad, reconcileGamVerifiedListingIdentity, reconcileGamVerifiedEditorialCoherence } from "./gam/technical/reconciliation/gam-verified-capacity-coherence.js";
import { reconcileGamHorometer } from "./gam/technical/reconciliation/gam-horometer.js";
import { captureSourceEditorialEvidence } from "./shared/editorial/mapping/source-editorial-evidence.js";
import { recoverBaseTechnicalSpecs } from "./gam/technical/gam-technical-recovery.js";
import { recoverDocumentedTechnicalSpecs } from "./shared/technical/recovery/documented-technical-recovery.js";
import { resolvePreparedEditorial } from "./shared/editorial/mapping/prepared-editorial.js";
import { finalizePreparedEditorial } from "./shared/editorial/mapping/verified-editorial-finalization.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const sourceUnitRecord = record;
  record = reconcileGamVerifiedYaleGp80vx(record);
  record = reconcileMercaelevaVerifiedLindeE48p(record);
  record = reconcileMercaelevaVerifiedJlg450AjBaseModel(record);
  const sourceEditorial = captureSourceEditorialEvidence(record);
  const publicationConflict = publicationConflictForMercaeleva(record);
  const semanticIssues = sourceSemanticQualityIssues(reconcileGomarizVerifiedElectricSemanticSource(reconcileMercaelevaVerifiedReachTruckFamily(record)));
  record = reconcileMercaelevaVerifiedReachTruckFamily(record);
  record = reconcileGamInitialIdentity(record);
  record = reconcileGamVerifiedListingIdentity(record);
  record = reconcileGamVerifiedModelIdentity(record);
  record = reconcileMercaelevaVerifiedPlatformSourceSpecs(record);
  const sourceYearSpecs = recoverBaseTechnicalSpecs(record, sourceUnitRecord);
  const { sourceFuelSpecs, documentedSpecs } = recoverDocumentedTechnicalSpecs(sourceUnitRecord, sourceYearSpecs);
  const beforeReconciliation = record;
  record = reconcileGamForPreparation(record);
  record = reconcileMercaelevaForPreparation(record);
  const editorialRecord = record;
  record = reconcileGamSourceCapacitySummary(record);
  record = reconcileGamVerifiedCapacityCoherence(record);
  record = reconcileGamVerifiedBasketLoad(record);
  record = reconcileGamCorroboratedLoadCapacity(record);
  record = reconcileGomarizVerifiedPlatformHeight(record);
  record = reconcileMercaelevaCorroboratedCapacity(record);
  record = reconcileGamBasketDimensions(record);
  record = reconcileGamVerifiedBasketSizes(record);
  record = reconcileGamHorometer(record);
  const reconciledSpecs = applyReconciledTechnicalSpecs(beforeReconciliation, record, documentedSpecs);
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = catalog ? resolveCategory(record, catalog.categories, condition) : null;
  const sourceImages = imageUrls(record);
  const images = record.providerId === "gam" && record.image === sourceImages[0]
    ? excludeGamRelatedProductImages(sourceImages, record) : sourceImages;
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const editorial = resolvePreparedEditorial(editorialRecord, sourceUnitRecord, sourceEditorial);
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
    editorialRecord, sourceUnitRecord, editorial.preparedShort, editorial.preparedLong,
    sourceFuelSpecs, issues.length === 0
  );
  issues.push(...preparedTechnicalConsistencyIssues(record, reconciledSpecs));
  const sanitizedSpecs = reconcileMercaelevaNonUsableSentinels({ ...record, specs: reconciledSpecs }).specs ?? reconciledSpecs;
  const normalizedSpecs = reconcileGamSourceTechnicalUnits({ ...record, specs: sanitizedSpecs }).specs ?? sanitizedSpecs;
  const hysterEditorial = verifiedGamHysterH45fts5Editorial(sourceUnitRecord, record);
  const tractorEditorial = reconcileGamElectricTowTractorEditorial(sourceUnitRecord, descriptions, normalizedSpecs);
  const preparedGeneral = normalizeMercaelevaAusaHeightText(
    sourceUnitRecord, hysterEditorial?.general ?? reconcileGamVerifiedEditorialCoherence(record, tractorEditorial.general)
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
    description: normalizeMercaelevaAusaHeightText(
      sourceUnitRecord, reconcileGamModulaStorageSummary(sourceUnitRecord,
        hysterEditorial?.short ?? preparedGamSourceCapacityShort(editorialRecord, record, tractorEditorial.short), tractorEditorial.spec)
    ),
    description_general: removeGamVehicleListingMarkers(sourceUnitRecord, preparedGeneral) ?? preparedGeneral,
    image: images[0] ?? null,
    images,
    spec: tractorEditorial.spec,
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
