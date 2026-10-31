import type { ProductRecord } from "../../contracts/catalog.js";
import { distinguishDescriptions } from "../normalization/descriptions.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../legacy-export/import-validation.js";
import { resolveCategory } from "./mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { productAttributes } from "./product-attributes.js";
import { sourceAttributeQualityIssues, sourceTechnicalQualityIssues } from "./source/attribute-quality.js";
import { sourceSemanticQualityIssues } from "./source/semantic-quality.js";
import { resolveCommercialCondition } from "./condition.js";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";
import { resolveMercaelevaShortDescription } from "./mapping/providers/mercaeleva/descriptions.js";
import { resolveMercaelevaConciseDescription } from "./mapping/providers/mercaeleva/concise-description.js";
import { resolveMercaelevaGeneralDescription } from "./mapping/providers/mercaeleva/general-description.js";
import { verifiedMercaelevaCriticalGeneral } from "./evidence/providers/mercaeleva/critical-general-descriptions.js";
import { verifiedPriorityPlatformGeneral } from "./evidence/providers/mercaeleva/priority-platform-generals.js";
import { mercaelevaMissingDescriptions } from "./mapping/providers/mercaeleva/missing-descriptions.js";
import { gamMissingDescriptions } from "./mapping/providers/gam/missing-descriptions.js";
import { rebalanceGamOverlongShort, resolveGamResidualConciseShort, resolveGamShortDescription } from "./mapping/providers/gam/short-description.js";
import { resolveGamConciseTitle } from "./mapping/providers/gam/concise-titles.js";
import { resolveGomarizEditorialTitle } from "./mapping/providers/gomariz/editorial-title.js";
import { resolveGamGeneralDescription } from "./mapping/providers/gam/general-description.js";
import { resolveGamModelSpecificGeneral } from "./mapping/providers/gam/model-specific-general.js";
import { resolveGamLongDescription } from "./mapping/providers/gam/long-description.js";
import { resolveGamPriorityBriefGeneral } from "./mapping/providers/gam/priority-brief-general.js";
import { resolveGamCriticalBriefGeneral } from "./mapping/providers/gam/critical-brief-general.js";
import { resolveGamFamilyTechnicalDescription } from "./mapping/providers/gam/family-technical-description.js";
import { resolveGamTecnacarGeneral } from "./mapping/providers/gam/tecnacar-general.js";
import { resolveGamIndividualizedGeneral } from "./mapping/providers/gam/individualized-general.js";
import { resolveGamUsedYearGeneral } from "./mapping/providers/gam/used-year-general.js";
import { resolveGamUsedHoursGeneral } from "./mapping/providers/gam/used-hours-general.js";
import { resolveGamUsedUnitGeneral } from "./mapping/providers/gam/used-unit-general.js";
import { resolveGamYaleDieselDimensions } from "./mapping/providers/gam/yale-diesel-dimensions.js";
import { resolveGamModelIdentifiedGeneral } from "./mapping/providers/gam/model-identified-general.js";
import { resolveGomarizIndividualizedGeneral } from "./mapping/providers/gomariz/individualized-general.js";
import { resolveGomarizShortDescription } from "./mapping/providers/gomariz/short-description.js";
import { resolveGomarizCriticalBriefGeneral } from "./mapping/providers/gomariz/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "./mapping/providers/gomariz/general-description.js";
import { resolveGomarizResidualGeneral } from "./mapping/providers/gomariz/residual-general.js";
import { gamElevationSourceIdentityConflict } from "./evidence/providers/gam/elevation-identity.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./reconciliation/gam.js";
import { recoverGamExplicitWorkHeightSpec } from "./evidence/providers/gam/work-height-evidence.js";
import { recoverGamExplicitHorizontalReachSpec } from "./evidence/providers/gam/reach-evidence.js";
import { recoverGamExplicitLoadCapacitySpec } from "./evidence/providers/gam/load-capacity-evidence.js";
import { recoverGamExplicitMachineSpecs } from "./evidence/providers/gam/measured-machine-specs.js";
import { recoverGamOperationalSpecs } from "./evidence/providers/gam/operational-measures-evidence.js";
import { recoverGamCleaningTankSpecs } from "./evidence/providers/gam/cleaning-tank-evidence.js";
import { recoverGamVerifiedTechnicalSpecs } from "./evidence/providers/gam/verified-technical-measures.js";
import { recoverGamElectricMotorPowerSpecs } from "./evidence/providers/gam/electric-motor-power-evidence.js";
import { recoverGamBatteryMeasures } from "./evidence/providers/gam/battery-measures-evidence.js";
import { recoverGamClearanceAndPlatform } from "./evidence/providers/gam/clearance-platform-evidence.js";
import { publicationConflictForMercaeleva, reconcileMercaelevaForPreparation } from "./reconciliation/mercaeleva.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const conciseGamShort = resolveGamShortDescription(record);
  const verifiedGamFamilyGeneral = resolveGamFamilyTechnicalDescription(record);
  const publicationConflict = publicationConflictForMercaeleva(record);
  const semanticIssues = sourceSemanticQualityIssues(record);
  record = reconcileGamInitialIdentity(record);
  const workHeightSpecs = recoverGamExplicitWorkHeightSpec(record);
  const reachSpecs = recoverGamExplicitHorizontalReachSpec({ ...record, specs: workHeightSpecs });
  const capacitySpecs = recoverGamExplicitLoadCapacitySpec({ ...record, specs: reachSpecs });
  const measuredSpecs = recoverGamExplicitMachineSpecs({ ...record, specs: capacitySpecs });
  const operationalSpecs = recoverGamOperationalSpecs({ ...record, specs: measuredSpecs });
  const cleaningSpecs = recoverGamCleaningTankSpecs({ ...record, specs: operationalSpecs });
  const verifiedSpecs = recoverGamVerifiedTechnicalSpecs({ ...record, specs: cleaningSpecs });
  const enrichedSpecs = recoverGamElectricMotorPowerSpecs({ ...record, specs: verifiedSpecs });
  const batterySpecs = recoverGamBatteryMeasures({ ...record, specs: enrichedSpecs });
  const measuredGeometrySpecs = recoverGamClearanceAndPlatform({ ...record, specs: batterySpecs });
  record = reconcileGamForPreparation(record);
  record = reconcileMercaelevaForPreparation(record);
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = catalog ? resolveCategory(record, catalog.categories, condition) : null;
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const title = (resolveGomarizEditorialTitle(record) ?? resolveGamConciseTitle(record) ?? record.title?.trim()) || null;
  const descriptionEvidence = resolveMercaelevaShortDescription(record);
  const conciseMercaelevaShort = resolveMercaelevaConciseDescription(record);
  const missingDescriptions = mercaelevaMissingDescriptions(record);
  const missingGamDescriptions = gamMissingDescriptions(record);
  const general = resolveGamIndividualizedGeneral(record) ?? resolveGomarizIndividualizedGeneral(record) ?? resolveGomarizCriticalBriefGeneral(record) ?? resolveGomarizGeneralDescription(record) ?? resolveGomarizResidualGeneral(record) ?? verifiedMercaelevaCriticalGeneral(record) ?? verifiedPriorityPlatformGeneral(record) ?? resolveMercaelevaGeneralDescription(record) ?? resolveGamPriorityBriefGeneral(record) ?? resolveGamCriticalBriefGeneral(record) ?? resolveGamGeneralDescription(record) ?? resolveGamModelSpecificGeneral(record) ?? resolveGamLongDescription(record) ?? verifiedGamFamilyGeneral ?? resolveGamTecnacarGeneral(record) ?? record.longDescription ?? missingDescriptions.long ?? missingGamDescriptions.long;
  const balanced = conciseGamShort === null ? rebalanceGamOverlongShort(record, general) : null;
  const conciseResidual = conciseGamShort === null && balanced === null ? resolveGamResidualConciseShort(record, general) : null;
  const descriptions = distinguishDescriptions(
    conciseGamShort ?? balanced?.short ?? conciseResidual ?? conciseMercaelevaShort ?? record.shortDescription ?? descriptionEvidence.description ?? resolveGomarizShortDescription(record) ?? missingGamDescriptions.short,
    balanced?.general ?? general
  );
  const usedYearGeneral = resolveGamUsedYearGeneral(record, descriptions.short, descriptions.long);
  const usedHoursGeneral = resolveGamUsedHoursGeneral(record, usedYearGeneral ?? descriptions.long);
  const usedUnitGeneral = resolveGamUsedUnitGeneral(record, usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const yaleDieselDimensions = resolveGamYaleDieselDimensions(record, usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const modelIdentifiedGeneral = resolveGamModelIdentifiedGeneral(record, yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  if (descriptionEvidence.heightConflict) issues.push("Descripción comercial contradictoria: altura de trabajo");
  if (gamElevationSourceIdentityConflict(record)) issues.push("Identidad GAM contradictoria entre título, resumen y ficha técnica");
  const attributeResult = catalog ? productAttributes(record, category, catalog) : null;

  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  if (publicationConflict !== null) issues.push(publicationConflict);
  issues.push(...semanticIssues);
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
    description_general: modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long,
    image: images[0] ?? null,
    images,
    spec: measuredGeometrySpecs,
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
