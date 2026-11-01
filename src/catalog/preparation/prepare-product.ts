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
import { rebalanceGamTechnicalShort } from "./mapping/providers/gam/rebalance-technical-short.js";
import { resolveGomarizEditorialTitle } from "./mapping/providers/gomariz/editorial-title.js";
import { resolveGamGeneralDescription } from "./mapping/providers/gam/general-description.js";
import { resolveGamCrossedIdentityEditorial } from "./mapping/providers/gam/crossed-identity-editorial.js";
import { resolveGamVerifiedCommercialShort } from "./mapping/providers/gam/verified-commercial-short.js";
import { resolveGamVerifiedConciseGeneral } from "./mapping/providers/gam/verified-concise-long.js";
import { resolveGamVerifiedElevationGeneral } from "./mapping/providers/gam/verified-elevation-general.js";
import { resolveGamSpecialtyEditorial } from "./mapping/providers/gam/specialty-editorial.js";
import { resolveGamWarehouseTechnicalEditorial } from "./mapping/providers/gam/warehouse-technical-editorial.js";
import { resolveGamHandlingSourceEditorial } from "./mapping/providers/gam/handling-source-editorial.js";
import { resolveGamVerifiedResidualEditorial } from "./mapping/providers/gam/verified-residual-editorial.js";
import { resolveGamCondensedGeneral, resolveGamCondensedShort } from "./mapping/providers/gam/verified-condensed-general.js";
import { resolveGamAdditionalCondensedGeneral, resolveGamAdditionalCondensedShort } from "./mapping/providers/gam/verified-condensed-additional.js";
import { resolveGamExtendedCondensedGeneral, resolveGamExtendedCondensedShort } from "./mapping/providers/gam/verified-condensed-extended.js";
import { resolveGamCleaningCondensedGeneral, resolveGamCleaningCondensedShort } from "./mapping/providers/gam/verified-condensed-cleaning.js";
import { resolveGamResidualCleaningGeneral, resolveGamResidualCleaningShort } from "./mapping/providers/gam/residual-cleaning-editorial.js";
import { resolveGamForkliftCondensedGeneral, resolveGamForkliftCondensedShort } from "./mapping/providers/gam/verified-condensed-forklifts.js";
import { resolveGamHandlingCondensedGeneral, resolveGamHandlingCondensedShort } from "./mapping/providers/gam/verified-condensed-handling.js";
import { resolveGamPlatformCondensedGeneral, resolveGamPlatformCondensedShort } from "./mapping/providers/gam/verified-condensed-platforms.js";
import { resolveGamWarehouseCondensedGeneral, resolveGamWarehouseCondensedShort } from "./mapping/providers/gam/verified-condensed-warehouse.js";
import { resolveGamHysterCondensedGeneral, resolveGamHysterCondensedShort } from "./mapping/providers/gam/verified-condensed-hyster.js";
import { resolveGamTennantCondensedGeneral, resolveGamTennantCondensedShort } from "./mapping/providers/gam/verified-condensed-tennant.js";
import { resolveGamModelSpecificGeneral } from "./mapping/providers/gam/model-specific-general.js";
import { removeGamDetachedAffirmatives, removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts, resolveGamLongDescription } from "./mapping/providers/gam/long-description.js";
import { resolveGamVerifiedBriefGeneral } from "./mapping/providers/gam/brief-technical-general.js";
import { resolveGamPriorityBriefGeneral } from "./mapping/providers/gam/priority-brief-general.js";
import { resolveGamCriticalBriefGeneral } from "./mapping/providers/gam/critical-brief-general.js";
import { resolveGamFamilyTechnicalDescription } from "./mapping/providers/gam/family-technical-description.js";
import { resolveGamTecnacarGeneral } from "./mapping/providers/gam/tecnacar-general.js";
import { resolveGamIndividualizedGeneral } from "./mapping/providers/gam/individualized-general.js";
import { resolveGamUsedYearGeneral } from "./mapping/providers/gam/used-year-general.js";
import { resolveGamUsedHoursGeneral } from "./mapping/providers/gam/used-hours-general.js";
import { resolveGamUsedUnitGeneral } from "./mapping/providers/gam/used-unit-general.js";
import { resolveGamYaleDieselDimensions } from "./mapping/providers/gam/yale-diesel-dimensions.js";
import { resolveGamExactVariantGeneral, resolveGamModelIdentifiedGeneral, resolveGamSourceIdentifiedModel } from "./mapping/providers/gam/model-identified-general.js";
import { resolveGomarizIndividualizedGeneral } from "./mapping/providers/gomariz/individualized-general.js";
import { resolveGomarizShortDescription } from "./mapping/providers/gomariz/short-description.js";
import { resolveGomarizCriticalBriefGeneral } from "./mapping/providers/gomariz/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "./mapping/providers/gomariz/general-description.js";
import { removeGomarizConversationalLead, resolveGomarizResidualGeneral } from "./mapping/providers/gomariz/residual-general.js";
import { gamElevationSourceIdentityConflict } from "./evidence/providers/gam/elevation-identity.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./reconciliation/gam.js";
import { recoverGamExplicitWorkHeightSpec } from "./evidence/providers/gam/work-height-evidence.js";
import { recoverGamExplicitHorizontalReachSpec } from "./evidence/providers/gam/reach-evidence.js";
import { recoverGamExplicitLoadCapacitySpec } from "./evidence/providers/gam/load-capacity-evidence.js";
import { recoverGamExplicitMachineSpecs } from "./evidence/providers/gam/measured-machine-specs.js";
import { recoverGamOperationalSpecs } from "./evidence/providers/gam/operational-measures-evidence.js";
import { recoverGamCleaningTankSpecs, recoverGamSweeperHopperCapacity } from "./evidence/providers/gam/cleaning-tank-evidence.js";
import { recoverGamScrubbingPressureSpec } from "./evidence/providers/gam/scrubbing-pressure-evidence.js";
import { recoverGamSweepingBrushSpecs } from "./evidence/providers/gam/sweeping-brush-evidence.js";
import { recoverGamSourceGradeabilitySpecs } from "./evidence/providers/gam/source-gradeability-evidence.js";
import { recoverGamVerifiedTechnicalSpecs } from "./evidence/providers/gam/verified-technical-measures.js";
import { recoverGamElectricMotorPowerSpecs } from "./evidence/providers/gam/electric-motor-power-evidence.js";
import { recoverGamBatteryMeasures } from "./evidence/providers/gam/battery-measures-evidence.js";
import { recoverGamLithiumBatteryType } from "./evidence/providers/gam/battery-chemistry-evidence.js";
import { recoverGamClearanceAndPlatform } from "./evidence/providers/gam/clearance-platform-evidence.js";
import { recoverGamWheelbaseSpec } from "./evidence/providers/gam/wheelbase-evidence.js";
import { recoverGamAutonomySpec } from "./evidence/providers/gam/autonomy-evidence.js";
import { recoverGamAcousticSpec, recoverGamHandlingAcousticSpec } from "./evidence/providers/gam/acoustic-evidence.js";
import { recoverGamCleaningProductivitySpec, recoverGamCleaningWorkingWidthSpec } from "./evidence/providers/gam/cleaning-productivity-evidence.js";
import { recoverGamMaximumLiftHeightSpec } from "./evidence/providers/gam/lift-height-evidence.js";
import { recoverGamElectricalBatterySpecs, recoverGamVerifiedBatteryPairSpecs } from "./evidence/providers/gam/battery-electrical-evidence.js";
import { recoverGamMotorConfigurationSpecs, recoverGamVerifiedTwinMotorSpecs, recoverGamVerifiedEnginePowerSpecs, recoverGamVerifiedEngineTorqueSpecs, recoverGamVerifiedCombustionDriveSpecs } from "./evidence/providers/gam/motor-configuration-evidence.js";
import { recoverGamPhysicalMeasures } from "./evidence/providers/gam/physical-measures-evidence.js";
import { recoverGamHysterForkliftTyresSpec, recoverGamNonMarkingTyresSpec, recoverGamYaleSuperelasticTyresSpec, recoverGamVerifiedSuperelasticTyresSpec, recoverGamVerifiedTyreMaterialsSpec } from "./evidence/providers/gam/non-marking-tyres-evidence.js";
import { publicationConflictForMercaeleva, reconcileMercaelevaForPreparation } from "./reconciliation/mercaeleva.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const crossedIdentity = resolveGamCrossedIdentityEditorial(record);
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
  const twinMotorSpecs = recoverGamVerifiedTwinMotorSpecs({ ...record, specs: enrichedSpecs });
  const batterySpecs = recoverGamBatteryMeasures({ ...record, specs: twinMotorSpecs });
  const batteryTypeSpecs = recoverGamLithiumBatteryType({ ...record, specs: batterySpecs });
  const measuredGeometrySpecs = recoverGamClearanceAndPlatform({ ...record, specs: batteryTypeSpecs });
  const wheelbaseSpecs = recoverGamWheelbaseSpec({ ...record, specs: measuredGeometrySpecs });
  const autonomySpecs = recoverGamAutonomySpec({ ...record, specs: wheelbaseSpecs });
  const acousticSpecs = recoverGamAcousticSpec({ ...record, specs: autonomySpecs });
  const handlingAcousticSpecs = recoverGamHandlingAcousticSpec({ ...record, specs: acousticSpecs });
  const cleaningProductivitySpecs = recoverGamCleaningProductivitySpec({ ...record, specs: handlingAcousticSpecs });
  const cleaningWidthSpecs = recoverGamCleaningWorkingWidthSpec({ ...record, specs: cleaningProductivitySpecs });
  const tyreSpecs = recoverGamNonMarkingTyresSpec({ ...record, specs: cleaningWidthSpecs });
  const forkliftTyreSpecs = recoverGamHysterForkliftTyresSpec({ ...record, specs: tyreSpecs });
  const yaleTyreSpecs = recoverGamYaleSuperelasticTyresSpec({ ...record, specs: forkliftTyreSpecs });
  const liftSpecs = recoverGamMaximumLiftHeightSpec({ ...record, specs: yaleTyreSpecs });
  const physicalSpecs = recoverGamPhysicalMeasures({ ...record, specs: liftSpecs });
  const electricalSpecs = recoverGamElectricalBatterySpecs({ ...record, specs: physicalSpecs });
  const batteryPairSpecs = recoverGamVerifiedBatteryPairSpecs({ ...record, specs: electricalSpecs });
  const motorSpecs = recoverGamMotorConfigurationSpecs({ ...record, specs: batteryPairSpecs });
  const engineSpecs = recoverGamVerifiedEnginePowerSpecs({ ...record, specs: motorSpecs });
  const engineTorqueSpecs = recoverGamVerifiedEngineTorqueSpecs({ ...record, specs: engineSpecs });
  const combustionDriveSpecs = recoverGamVerifiedCombustionDriveSpecs({ ...record, specs: engineTorqueSpecs });
  const superelasticSpecs = recoverGamVerifiedSuperelasticTyresSpec({ ...record, specs: combustionDriveSpecs });
  const tyreMaterialSpecs = recoverGamVerifiedTyreMaterialsSpec({ ...record, specs: superelasticSpecs });
  const hopperSpecs = recoverGamSweeperHopperCapacity({ ...record, specs: tyreMaterialSpecs });
  const pressureSpecs = recoverGamScrubbingPressureSpec({ ...record, specs: hopperSpecs });
  const brushSpecs = recoverGamSweepingBrushSpecs({ ...record, specs: pressureSpecs });
  const finalSpecs = recoverGamSourceGradeabilitySpecs({ ...record, specs: brushSpecs });
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
  const general = crossedIdentity?.general ?? resolveGamCondensedGeneral(record) ?? resolveGamAdditionalCondensedGeneral(record) ?? resolveGamExtendedCondensedGeneral(record) ?? resolveGamCleaningCondensedGeneral(record) ?? resolveGamForkliftCondensedGeneral(record) ?? resolveGamHandlingCondensedGeneral(record) ?? resolveGamPlatformCondensedGeneral(record) ?? resolveGamWarehouseCondensedGeneral(record) ?? resolveGamHysterCondensedGeneral(record) ?? resolveGamTennantCondensedGeneral(record) ?? resolveGamIndividualizedGeneral(record) ?? resolveGomarizIndividualizedGeneral(record) ?? resolveGomarizCriticalBriefGeneral(record) ?? resolveGomarizGeneralDescription(record) ?? resolveGomarizResidualGeneral(record) ?? verifiedMercaelevaCriticalGeneral(record) ?? verifiedPriorityPlatformGeneral(record) ?? resolveMercaelevaGeneralDescription(record) ?? resolveGamPriorityBriefGeneral(record) ?? resolveGamCriticalBriefGeneral(record) ?? resolveGamGeneralDescription(record) ?? resolveGamModelSpecificGeneral(record) ?? resolveGamLongDescription(record) ?? verifiedGamFamilyGeneral ?? resolveGamTecnacarGeneral(record) ?? record.longDescription ?? missingDescriptions.long ?? missingGamDescriptions.long;
  const balanced = conciseGamShort === null ? rebalanceGamOverlongShort(record, general) : null;
  const technicalBalance = conciseGamShort === null && balanced === null ? rebalanceGamTechnicalShort(record, general) : null;
  const conciseResidual = conciseGamShort === null && balanced === null && technicalBalance === null ? resolveGamResidualConciseShort(record, general) : null;
  const descriptions = distinguishDescriptions(
    crossedIdentity?.short ?? resolveGamVerifiedCommercialShort(record) ?? resolveGamCondensedShort(record) ?? resolveGamAdditionalCondensedShort(record) ?? resolveGamExtendedCondensedShort(record) ?? resolveGamCleaningCondensedShort(record) ?? resolveGamForkliftCondensedShort(record) ?? resolveGamHandlingCondensedShort(record) ?? resolveGamPlatformCondensedShort(record) ?? resolveGamWarehouseCondensedShort(record) ?? resolveGamHysterCondensedShort(record) ?? resolveGamTennantCondensedShort(record) ?? conciseGamShort ?? balanced?.short ?? technicalBalance?.short ?? conciseResidual ?? conciseMercaelevaShort ?? record.shortDescription ?? descriptionEvidence.description ?? resolveGomarizShortDescription(record) ?? missingGamDescriptions.short,
    balanced?.general ?? technicalBalance?.general ?? general
  );
  const residualCleaningShort = resolveGamResidualCleaningShort(record, descriptions.short);
  const usedYearGeneral = resolveGamUsedYearGeneral(record, descriptions.short, descriptions.long);
  const usedHoursGeneral = resolveGamUsedHoursGeneral(record, usedYearGeneral ?? descriptions.long);
  const usedUnitGeneral = resolveGamUsedUnitGeneral(record, usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const yaleDieselDimensions = resolveGamYaleDieselDimensions(record, usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const modelIdentifiedGeneral = resolveGamModelIdentifiedGeneral(record, yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const exactVariantGeneral = resolveGamExactVariantGeneral(record, modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const briefTechnicalGeneral = resolveGamVerifiedBriefGeneral(record, exactVariantGeneral ?? modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const sourceIdentifiedGeneral = resolveGamSourceIdentifiedModel(record, briefTechnicalGeneral ?? exactVariantGeneral ?? modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long);
  const preparedGeneral = sourceIdentifiedGeneral ?? briefTechnicalGeneral ?? exactVariantGeneral ?? modelIdentifiedGeneral ?? yaleDieselDimensions ?? usedUnitGeneral ?? usedHoursGeneral ?? usedYearGeneral ?? descriptions.long;
  const baseEditorialGeneral = removeGamOrphanAffirmative(record, preparedGeneral) ?? removeGamDetachedAffirmatives(record, preparedGeneral) ?? preparedGeneral;
  const editorialGeneral = removeGamResidualEditorialArtifacts(record, baseEditorialGeneral) ?? removeGomarizConversationalLead(record, baseEditorialGeneral) ?? baseEditorialGeneral;
  const conciseVerifiedGeneral = resolveGamVerifiedConciseGeneral(record, editorialGeneral);
  const elevationGeneral = resolveGamVerifiedElevationGeneral(record, conciseVerifiedGeneral ?? editorialGeneral);
  const residualCleaningGeneral = resolveGamResidualCleaningGeneral(record, elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral);
  const specialtyEditorial = resolveGamSpecialtyEditorial(
    record, residualCleaningShort ?? descriptions.short,
    residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const warehouseEditorial = resolveGamWarehouseTechnicalEditorial(
    record, specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const handlingEditorial = resolveGamHandlingSourceEditorial(
    record, warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
  const verifiedResidualEditorial = resolveGamVerifiedResidualEditorial(
    record, handlingEditorial?.short ?? warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral
  );
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
    description: verifiedResidualEditorial?.short ?? handlingEditorial?.short ?? warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short,
    description_general: verifiedResidualEditorial?.general ?? handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral,
    image: images[0] ?? null,
    images,
    spec: finalSpecs,
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
