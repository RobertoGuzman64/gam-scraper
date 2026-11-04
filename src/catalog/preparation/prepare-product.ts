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
import { resolveMercaelevaDocumentedPlatformGeneral } from "./mapping/providers/mercaeleva/documented-platform-general.js";
import { resolveMercaelevaDocumentedAdditionalPlatformGeneral } from "./mapping/providers/mercaeleva/documented-additional-platform-general.js";
import { resolveMercaelevaDocumentedResidualPlatformGeneral } from "./mapping/providers/mercaeleva/documented-residual-platform-general.js";
import { resolveMercaelevaDocumentedFurtherPlatformGeneral } from "./mapping/providers/mercaeleva/documented-further-platform-general.js";
import { resolveMercaelevaDocumentedPendingPlatformGeneral } from "./mapping/providers/mercaeleva/documented-pending-platform-general.js";
import { resolveMercaelevaLegacyPlatformGeneral } from "./mapping/providers/mercaeleva/documented-legacy-platform-general.js";
import { resolveMercaelevaVerifiedSourceEditorial } from "./mapping/providers/mercaeleva/verified-source-editorial.js";
import { resolveGamVerifiedUnitSourceGeneral } from "./mapping/providers/gam/editorial-descriptions/verified-unit-source-general.js";
import { resolveVerifiedCanonicalBriefEditorial } from "./mapping/verified-canonical-brief-editorial.js";
import { applyVerifiedEditorialComposition } from "./mapping/verified-editorial-composition.js";
import { resolveVerifiedUnitSummaryEditorial } from "./mapping/verified-unit-summary-editorial.js";
import { resolveGomarizVerifiedModelGeneral } from "./mapping/providers/gomariz/verified-model-general.js";
import { resolveGomarizVerifiedResidualTitle } from "./mapping/providers/gomariz/verified-residual-title.js";
import { resolveGamVerifiedResidualTitle } from "./mapping/providers/gam/editorial-descriptions/verified-residual-title.js";
import { resolveGamVerifiedResidualGeneral } from "./mapping/providers/gam/editorial-descriptions/verified-residual-general.js";
import { verifiedMercaelevaCriticalGeneral } from "./evidence/providers/mercaeleva/critical-general-descriptions.js";
import { verifiedPriorityPlatformGeneral } from "./evidence/providers/mercaeleva/priority-platform-generals.js";
import { verifiedMercaelevaResidualGeneral } from "./evidence/providers/mercaeleva/verified-residual-generals.js";
import { verifiedMercaelevaUnitGeneral } from "./mapping/providers/mercaeleva/verified-unit-general.js";
import { mercaelevaMissingDescriptions } from "./mapping/providers/mercaeleva/missing-descriptions.js";
import { gamMissingDescriptions } from "./mapping/providers/gam/editorial-descriptions/missing-descriptions.js";
import { rebalanceGamOverlongShort, resolveGamResidualConciseShort, resolveGamShortDescription } from "./mapping/providers/gam/editorial-descriptions/short-description.js";
import { resolveGamConciseTitle } from "./mapping/providers/gam/editorial-descriptions/concise-titles.js";
import { rebalanceGamTechnicalShort } from "./mapping/providers/gam/editorial-descriptions/rebalance-technical-short.js";
import { resolveGomarizEditorialTitle } from "./mapping/providers/gomariz/editorial-title.js";
import { recoverGomarizSourceYearSpec } from "./mapping/providers/gomariz/source-year-spec.js";
import { recoverMercaelevaSourceFuel } from "./evidence/providers/mercaeleva/source-fuel-evidence.js";
import { includeSourceYearInGeneral } from "./mapping/source-year-general.js";
import { includeGamRegenerativeBrakingInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-regenerative-braking-general.js";
import { includeGamSourceUnitDetailsInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-unit-details-general.js";
import { includeGamSourceGradeabilityInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-gradeability-general.js";
import { includeGamSourceDeclaredWeightInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-declared-weight-general.js";
import { includeGamSourceSafetyControlsInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-safety-controls-general.js";
import { includeGamSourceBatteryVoltageInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-battery-voltage-general.js";
import { includeGamSourceMachineDimensionsInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-machine-dimensions-general.js";
import { includeGamSourceForkliftMeasuresInGeneral } from "./mapping/providers/gam/editorial-descriptions/source-forklift-measures-general.js";
import { resolveGamGeneralDescription } from "./mapping/providers/gam/editorial-descriptions/general-description.js";
import { resolveGamCrossedIdentityEditorial } from "./mapping/providers/gam/identity/crossed-identity-editorial.js";
import { resolveGamVerifiedCommercialShort } from "./mapping/providers/gam/editorial-descriptions/verified-commercial-short.js";
import { resolveGamVerifiedConciseGeneral } from "./mapping/providers/gam/editorial-descriptions/verified-concise-long.js";
import { resolveGamVerifiedElevationGeneral } from "./mapping/providers/gam/editorial-descriptions/verified-elevation-general.js";
import { resolveGamSpecialtyEditorial } from "./mapping/providers/gam/editorial-descriptions/specialty-editorial.js";
import { resolveGamWarehouseTechnicalEditorial } from "./mapping/providers/gam/editorial-descriptions/warehouse-technical-editorial.js";
import { resolveGamHandlingSourceEditorial } from "./mapping/providers/gam/editorial-descriptions/handling-source-editorial.js";
import { resolveGamVerifiedResidualEditorial } from "./mapping/providers/gam/editorial-descriptions/verified-residual-editorial.js";
import { resolveGamVerifiedExtendedGeneral } from "./mapping/providers/gam/editorial-descriptions/verified-extended-general.js";
import { resolveGamCondensedGeneral, resolveGamCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-general.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "./evidence/providers/gam/editorial/verified-source-condensed-generals.js";
import { resolveGamAdditionalCondensedGeneral, resolveGamAdditionalCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-additional.js";
import { resolveGamExtendedCondensedGeneral, resolveGamExtendedCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-extended.js";
import { resolveGamCleaningCondensedGeneral, resolveGamCleaningCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-cleaning.js";
import { resolveGamResidualCleaningGeneral, resolveGamResidualCleaningShort } from "./mapping/providers/gam/editorial-descriptions/residual-cleaning-editorial.js";
import { resolveGamForkliftCondensedGeneral, resolveGamForkliftCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-forklifts.js";
import { resolveGamHandlingCondensedGeneral, resolveGamHandlingCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-handling.js";
import { resolveGamPlatformCondensedGeneral, resolveGamPlatformCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-platforms.js";
import { resolveGamWarehouseCondensedGeneral, resolveGamWarehouseCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-warehouse.js";
import { resolveGamHysterCondensedGeneral, resolveGamHysterCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-hyster.js";
import { resolveGamTennantCondensedGeneral, resolveGamTennantCondensedShort } from "./mapping/providers/gam/editorial-descriptions/verified-condensed-tennant.js";
import { resolveGamModelSpecificGeneral } from "./mapping/providers/gam/editorial-descriptions/model-specific-general.js";
import { removeGamDetachedAffirmatives, removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts, resolveGamLongDescription } from "./mapping/providers/gam/editorial-descriptions/long-description.js";
import { resolveGamVerifiedBriefGeneral } from "./mapping/providers/gam/editorial-descriptions/brief-technical-general.js";
import { resolveGamPriorityBriefGeneral } from "./mapping/providers/gam/editorial-descriptions/priority-brief-general.js";
import { resolveGamCriticalBriefGeneral } from "./mapping/providers/gam/editorial-descriptions/critical-brief-general.js";
import { resolveGamFamilyTechnicalDescription } from "./mapping/providers/gam/editorial-descriptions/family-technical-description.js";
import { resolveGamTecnacarGeneral } from "./mapping/providers/gam/editorial-descriptions/tecnacar-general.js";
import { resolveGamIndividualizedGeneral } from "./mapping/providers/gam/editorial-descriptions/individualized-general.js";
import { resolveGamUsedYearGeneral } from "./mapping/providers/gam/editorial-descriptions/used-year-general.js";
import { resolveGamUsedHoursGeneral } from "./mapping/providers/gam/editorial-descriptions/used-hours-general.js";
import { resolveGamUsedUnitGeneral } from "./mapping/providers/gam/editorial-descriptions/used-unit-general.js";
import { resolveGamYaleDieselDimensions } from "./mapping/providers/gam/technical-rules/yale-diesel-dimensions.js";
import { resolveGamExactVariantGeneral, resolveGamModelIdentifiedGeneral, resolveGamSourceIdentifiedModel } from "./mapping/providers/gam/editorial-descriptions/model-identified-general.js";
import { verifiedGomarizPriorityGeneral } from "./evidence/providers/gomariz/verified-priority-general.js";
import { resolveGomarizIndividualizedGeneral } from "./mapping/providers/gomariz/individualized-general.js";
import { resolveGomarizShortDescription } from "./mapping/providers/gomariz/short-description.js";
import { resolveGomarizCriticalBriefGeneral } from "./mapping/providers/gomariz/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "./mapping/providers/gomariz/general-description.js";
import { removeGomarizConversationalLead, resolveGomarizResidualGeneral } from "./mapping/providers/gomariz/residual-general.js";
import { gamElevationSourceIdentityConflict } from "./evidence/providers/gam/identity/elevation-identity.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./reconciliation/gam.js";
import { recoverGamExplicitWorkHeightSpec } from "./evidence/providers/gam/measurements-and-capacities/work-height-evidence.js";
import { recoverGamExplicitHorizontalReachSpec } from "./evidence/providers/gam/measurements-and-capacities/reach-evidence.js";
import { recoverGamExplicitLoadCapacitySpec } from "./evidence/providers/gam/measurements-and-capacities/load-capacity-evidence.js";
import { recoverGamExplicitMachineSpecs } from "./evidence/providers/gam/measurements-and-capacities/measured-machine-specs.js";
import { recoverGamOperationalSpecs } from "./evidence/providers/gam/measurements-and-capacities/operational-measures-evidence.js";
import { recoverGamCleaningTankSpecs, recoverGamSweeperHopperCapacity } from "./evidence/providers/gam/operations-and-safety/cleaning-tank-evidence.js";
import { recoverGamScrubbingPressureSpec } from "./evidence/providers/gam/operations-and-safety/scrubbing-pressure-evidence.js";
import { recoverGamSweepingBrushSpecs } from "./evidence/providers/gam/operations-and-safety/sweeping-brush-evidence.js";
import { recoverGamSourceGradeabilitySpecs } from "./evidence/providers/gam/mobility/source-gradeability-evidence.js";
import { recoverGamVerifiedTowingSpecs } from "./evidence/providers/gam/mobility/towing-evidence.js";
import { recoverGamStatedTwinTractionPower } from "./evidence/providers/gam/energy-and-powertrain/motor-configuration-evidence.js";
import { recoverGamVerifiedMobilityBatteryType } from "./evidence/providers/gam/energy-and-powertrain/battery-chemistry-evidence.js";
import { recoverGamMislabelledBatterySpec } from "./evidence/providers/gam/energy-and-powertrain/source-battery-label-evidence.js";
import { recoverGamVerifiedVariantAcoustics } from "./evidence/providers/gam/identity/variant-acoustics-evidence.js";
import { recoverGamVerifiedTyreDimensions } from "./evidence/providers/gam/mobility/verified-tyre-dimensions-evidence.js";
import { recoverGamVerifiedConditionalAcoustics } from "./evidence/providers/gam/operations-and-safety/verified-conditional-acoustics-evidence.js";
import { recoverGamVerifiedResidualOperationSpecs } from "./evidence/providers/gam/general-evidence/verified-residual-operation-evidence.js";
import { recoverGamVerifiedResidualGeometrySpecs } from "./evidence/providers/gam/measurements-and-capacities/verified-residual-geometry-evidence.js";
import { recoverGamVerifiedResidualPerformanceSpecs } from "./evidence/providers/gam/operations-and-safety/verified-residual-performance-evidence.js";
import { recoverGamVerifiedTractionBraking } from "./evidence/providers/gam/mobility/verified-traction-braking-evidence.js";
import { recoverGamVerifiedSteeringBraking } from "./evidence/providers/gam/mobility/verified-steering-braking-evidence.js";
import { recoverGamSourceRegenerativeBraking } from "./evidence/providers/gam/mobility/source-regenerative-braking.js";
import { recoverGamUsedForkliftFuel } from "./evidence/providers/gam/energy-and-powertrain/used-forklift-fuel-evidence.js";
import { recoverGamUsedDieselFuel } from "./evidence/providers/gam/energy-and-powertrain/used-diesel-fuel-evidence.js";
import { recoverGamSourceElectricDrive } from "./evidence/providers/gam/energy-and-powertrain/source-electric-drive-evidence.js";
import { recoverGamVerifiedDrivetrainBrakes } from "./evidence/providers/gam/mobility/verified-drivetrain-brakes-evidence.js";
import { recoverGamVerifiedOperatorControls } from "./evidence/providers/gam/operations-and-safety/verified-operator-controls-evidence.js";
import { recoverGamVerifiedOperationalSafety } from "./evidence/providers/gam/operations-and-safety/verified-operational-safety-evidence.js";
import { recoverGamSourceSafetyControls } from "./evidence/providers/gam/operations-and-safety/source-safety-controls-evidence.js";
import { recoverGamSourceStabilization } from "./evidence/providers/gam/operations-and-safety/source-stabilization-evidence.js";
import { recoverGamVerifiedUsedYearSpec } from "./evidence/providers/gam/general-evidence/used-year-spec-evidence.js";
import { recoverGamVerifiedElectricDriveSpec } from "./evidence/providers/gam/energy-and-powertrain/verified-electric-drive-evidence.js";
import { recoverGamVerifiedTechnicalSpecs } from "./evidence/providers/gam/measurements-and-capacities/verified-technical-measures.js";
import { recoverGamElectricMotorPowerSpecs } from "./evidence/providers/gam/energy-and-powertrain/electric-motor-power-evidence.js";
import { recoverGamBatteryMeasures } from "./evidence/providers/gam/energy-and-powertrain/battery-measures-evidence.js";
import { recoverGamLithiumBatteryType } from "./evidence/providers/gam/energy-and-powertrain/battery-chemistry-evidence.js";
import { recoverGamClearanceAndPlatform } from "./evidence/providers/gam/measurements-and-capacities/clearance-platform-evidence.js";
import { recoverGamWheelbaseSpec } from "./evidence/providers/gam/mobility/wheelbase-evidence.js";
import { recoverGamAutonomySpec } from "./evidence/providers/gam/energy-and-powertrain/autonomy-evidence.js";
import { recoverGamAcousticSpec, recoverGamHandlingAcousticSpec } from "./evidence/providers/gam/operations-and-safety/acoustic-evidence.js";
import { recoverGamCleaningProductivitySpec, recoverGamCleaningWorkingWidthSpec } from "./evidence/providers/gam/operations-and-safety/cleaning-productivity-evidence.js";
import { recoverGamMaximumLiftHeightSpec } from "./evidence/providers/gam/measurements-and-capacities/lift-height-evidence.js";
import { recoverGamElectricalBatterySpecs, recoverGamVerifiedBatteryPairSpecs, recoverGamVerifiedIntegratedCharger } from "./evidence/providers/gam/energy-and-powertrain/battery-electrical-evidence.js";
import { recoverGamMotorConfigurationSpecs, recoverGamVerifiedTwinMotorSpecs, recoverGamVerifiedEnginePowerSpecs, recoverGamVerifiedEngineTorqueSpecs, recoverGamVerifiedCombustionDriveSpecs } from "./evidence/providers/gam/energy-and-powertrain/motor-configuration-evidence.js";
import { recoverGamPhysicalMeasures } from "./evidence/providers/gam/measurements-and-capacities/physical-measures-evidence.js";
import { recoverGamHysterForkliftTyresSpec, recoverGamNonMarkingTyresSpec, recoverGamYaleSuperelasticTyresSpec, recoverGamVerifiedSuperelasticTyresSpec, recoverGamVerifiedTyreMaterialsSpec } from "./evidence/providers/gam/mobility/non-marking-tyres-evidence.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "./evidence/providers/mercaeleva/verified-platform-source-specs.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "./evidence/providers/mercaeleva/documented-platform-technical-specs.js";
import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "./evidence/providers/mercaeleva/documented-equipment-technical-specs.js";
import { recoverGamDocumentedTechnicalDensitySpecs } from "./evidence/providers/gam/verified-models/documented-technical-density-units.js";
import { recoverGamDocumentedLogitransHandlingSpecs } from "./evidence/providers/gam/verified-models/documented-logitrans-handling-specs.js";
import { recoverGamDocumentedDensity178Specs } from "./evidence/providers/gam/verified-models/documented-density-178.js";
import { recoverGamDocumentedModulaStorageSpecs } from "./evidence/providers/gam/verified-models/documented-modula-storage-specs.js";
import { recoverMercaelevaDocumentedResidualLiftSpecs } from "./evidence/providers/mercaeleva/documented-residual-lift-specs.js";
import { recoverGamDocumentedDensity180Specs } from "./evidence/providers/gam/verified-models/documented-density-180.js";
import { recoverMercaelevaDocumentedDensity180Specs } from "./evidence/providers/mercaeleva/documented-density-180.js";
import { recoverGomarizDocumentedDensity180Specs } from "./evidence/providers/gomariz/documented-density-180.js";
import { recoverGamDocumentedResidualDensitySpecs } from "./evidence/providers/gam/verified-models/documented-density-residual.js";
import { recoverMercaelevaDocumentedResidualDensitySpecs } from "./evidence/providers/mercaeleva/documented-density-residual.js";
import { recoverGomarizDocumentedResidualDensitySpecs } from "./evidence/providers/gomariz/documented-density-residual.js";
import { recoverGamDocumentedPendingDensitySpecs } from "./evidence/providers/gam/verified-models/documented-pending-density.js";
import { recoverMercaelevaDocumentedPendingDensitySpecs } from "./evidence/providers/mercaeleva/documented-pending-density.js";
import { recoverGamDocumentedDensity183Specs } from "./evidence/providers/gam/verified-models/documented-density-183.js";
import { recoverMercaelevaDocumentedDensity183Specs } from "./evidence/providers/mercaeleva/documented-density-183.js";
import { publicationConflictForMercaeleva, reconcileMercaelevaForPreparation } from "./reconciliation/mercaeleva.js";

const prepare = (record: ProductRecord, catalog: ImportCatalog | null): PreparedProduct => {
  const sourceUnitRecord = record;
  const crossedIdentity = resolveGamCrossedIdentityEditorial(record);
  const verifiedGamCondensedGeneral = resolveGamVerifiedSourceCondensedGeneral(record);
  const conciseGamShort = resolveGamShortDescription(record);
  const verifiedGamFamilyGeneral = resolveGamFamilyTechnicalDescription(record);
  const publicationConflict = publicationConflictForMercaeleva(record);
  const semanticIssues = sourceSemanticQualityIssues(record);
  record = reconcileGamInitialIdentity(record);
  record = reconcileMercaelevaVerifiedPlatformSourceSpecs(record);
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
  const mobilityBatterySpecs = recoverGamVerifiedMobilityBatteryType({ ...record, specs: batteryTypeSpecs });
  const measuredGeometrySpecs = recoverGamClearanceAndPlatform({ ...record, specs: mobilityBatterySpecs });
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
  const integratedChargerSpecs = recoverGamVerifiedIntegratedCharger({ ...record, specs: electricalSpecs });
  const batteryPairSpecs = recoverGamVerifiedBatteryPairSpecs({ ...record, specs: integratedChargerSpecs });
  const labelledBatterySpecs = recoverGamMislabelledBatterySpec({ ...record, specs: batteryPairSpecs });
  const motorSpecs = recoverGamMotorConfigurationSpecs({ ...record, specs: labelledBatterySpecs });
  const tractionSpecs = recoverGamStatedTwinTractionPower({ ...record, specs: motorSpecs });
  const engineSpecs = recoverGamVerifiedEnginePowerSpecs({ ...record, specs: tractionSpecs });
  const engineTorqueSpecs = recoverGamVerifiedEngineTorqueSpecs({ ...record, specs: engineSpecs });
  const combustionDriveSpecs = recoverGamVerifiedCombustionDriveSpecs({ ...record, specs: engineTorqueSpecs });
  const superelasticSpecs = recoverGamVerifiedSuperelasticTyresSpec({ ...record, specs: combustionDriveSpecs });
  const tyreMaterialSpecs = recoverGamVerifiedTyreMaterialsSpec({ ...record, specs: superelasticSpecs });
  const hopperSpecs = recoverGamSweeperHopperCapacity({ ...record, specs: tyreMaterialSpecs });
  const pressureSpecs = recoverGamScrubbingPressureSpec({ ...record, specs: hopperSpecs });
  const brushSpecs = recoverGamSweepingBrushSpecs({ ...record, specs: pressureSpecs });
  const gradeabilitySpecs = recoverGamSourceGradeabilitySpecs({ ...record, specs: brushSpecs });
  const towingSpecs = recoverGamVerifiedTowingSpecs({ ...record, specs: gradeabilitySpecs });
  const variantAcousticSpecs = recoverGamVerifiedVariantAcoustics({ ...record, specs: towingSpecs });
  const tyreDimensionSpecs = recoverGamVerifiedTyreDimensions({ ...record, specs: variantAcousticSpecs });
  const confirmedSpecs = recoverGamVerifiedConditionalAcoustics({ ...record, specs: tyreDimensionSpecs });
  const finalSpecs = recoverGamVerifiedResidualOperationSpecs({ ...record, specs: confirmedSpecs });
  const recoveredGeometrySpecs = recoverGamVerifiedResidualGeometrySpecs({ ...record, specs: finalSpecs });
  const recoveredPerformanceSpecs = recoverGamVerifiedResidualPerformanceSpecs({ ...record, specs: recoveredGeometrySpecs });
  const tractionBrakingSpecs = recoverGamVerifiedTractionBraking({ ...record, specs: recoveredPerformanceSpecs });
  const steeringBrakingSpecs = recoverGamVerifiedSteeringBraking({ ...record, specs: tractionBrakingSpecs });
  const sourceBrakingSpecs = recoverGamSourceRegenerativeBraking(record, steeringBrakingSpecs);
  const drivetrainBrakesSpecs = recoverGamVerifiedDrivetrainBrakes({ ...record, specs: sourceBrakingSpecs });
  const operatorControlsSpecs = recoverGamVerifiedOperatorControls({ ...record, specs: drivetrainBrakesSpecs });
  const operationalSafetySpecs = recoverGamVerifiedOperationalSafety({ ...record, specs: operatorControlsSpecs });
  const electricDriveSpecs = recoverGamVerifiedElectricDriveSpec({ ...record, specs: operationalSafetySpecs });
  const usedYearSpecs = recoverGamVerifiedUsedYearSpec({ ...record, specs: electricDriveSpecs });
  const usedForkliftFuelSpecs = recoverGamUsedForkliftFuel(record, usedYearSpecs);
  const sourceElectricSpecs = recoverGamSourceElectricDrive(sourceUnitRecord, usedForkliftFuelSpecs);
  const sourceDieselSpecs = recoverGamUsedDieselFuel(sourceUnitRecord, sourceElectricSpecs);
  const sourceSafetySpecs = recoverGamSourceSafetyControls(sourceUnitRecord, sourceDieselSpecs);
  const sourceStabilizationSpecs = recoverGamSourceStabilization(sourceUnitRecord, sourceSafetySpecs);
  const sourceYearSpecs = recoverGomarizSourceYearSpec(record, sourceStabilizationSpecs);
  const sourceFuelSpecs = recoverMercaelevaSourceFuel(sourceUnitRecord, sourceYearSpecs);
  const documentedPlatformSpecs = recoverMercaelevaDocumentedPlatformTechnicalSpecs(sourceUnitRecord, sourceFuelSpecs);
  const documentedEquipmentSpecs = recoverMercaelevaDocumentedEquipmentTechnicalSpecs(sourceUnitRecord, documentedPlatformSpecs);
  const documentedGamSpecs = recoverGamDocumentedDensity178Specs(sourceUnitRecord, recoverGamDocumentedLogitransHandlingSpecs(sourceUnitRecord, recoverGamDocumentedTechnicalDensitySpecs(sourceUnitRecord, documentedEquipmentSpecs)));
  const documentedModulaSpecs = recoverGamDocumentedModulaStorageSpecs(sourceUnitRecord, documentedGamSpecs);
  const documentedResidualLifts = recoverMercaelevaDocumentedResidualLiftSpecs(sourceUnitRecord, documentedModulaSpecs);
  const documentedDensity180Gam = recoverGamDocumentedDensity180Specs(sourceUnitRecord, documentedResidualLifts);
  const documentedDensity180Mercaeleva = recoverMercaelevaDocumentedDensity180Specs(sourceUnitRecord, documentedDensity180Gam);
  const documentedDensity180Specs = recoverGomarizDocumentedDensity180Specs(sourceUnitRecord, documentedDensity180Mercaeleva);
  const documentedDensityResidualGam = recoverGamDocumentedResidualDensitySpecs(sourceUnitRecord, documentedDensity180Specs);
  const documentedDensityResidualMercaeleva = recoverMercaelevaDocumentedResidualDensitySpecs(sourceUnitRecord, documentedDensityResidualGam);
  const documentedDensityResidualSpecs = recoverGomarizDocumentedResidualDensitySpecs(sourceUnitRecord, documentedDensityResidualMercaeleva);
  const documentedPendingGam = recoverGamDocumentedPendingDensitySpecs(sourceUnitRecord, documentedDensityResidualSpecs);
  const documentedPendingSpecs = recoverMercaelevaDocumentedPendingDensitySpecs(sourceUnitRecord, documentedPendingGam);
  const documented183Gam = recoverGamDocumentedDensity183Specs(sourceUnitRecord, documentedPendingSpecs);
  const documented183Specs = recoverMercaelevaDocumentedDensity183Specs(sourceUnitRecord, documented183Gam);
  record = reconcileGamForPreparation(record);
  record = reconcileMercaelevaForPreparation(record);
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = catalog ? resolveCategory(record, catalog.categories, condition) : null;
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const mappedTitle = (resolveGomarizEditorialTitle(record) ?? resolveGamConciseTitle(record) ?? record.title?.trim()) || null;
  const title = resolveGomarizVerifiedResidualTitle(sourceUnitRecord, mappedTitle) ?? resolveGamVerifiedResidualTitle(sourceUnitRecord, mappedTitle) ?? mappedTitle;
  const descriptionEvidence = resolveMercaelevaShortDescription(record);
  const conciseMercaelevaShort = resolveMercaelevaConciseDescription(record);
  const missingDescriptions = mercaelevaMissingDescriptions(record);
  const missingGamDescriptions = gamMissingDescriptions(record);
  const existingMercaelevaGeneral = resolveMercaelevaDocumentedPendingPlatformGeneral(record) ?? resolveMercaelevaDocumentedFurtherPlatformGeneral(record) ?? verifiedMercaelevaCriticalGeneral(record) ?? verifiedPriorityPlatformGeneral(record) ?? verifiedMercaelevaResidualGeneral(record) ?? verifiedMercaelevaUnitGeneral(record) ?? resolveMercaelevaDocumentedPlatformGeneral(record) ?? resolveMercaelevaDocumentedAdditionalPlatformGeneral(record) ?? resolveMercaelevaDocumentedResidualPlatformGeneral(record) ?? resolveMercaelevaGeneralDescription(record);
  const mercaelevaGeneral = existingMercaelevaGeneral && existingMercaelevaGeneral.trim().split(/\s+/u).length >= 60
    ? existingMercaelevaGeneral
    : resolveMercaelevaLegacyPlatformGeneral(record) ?? existingMercaelevaGeneral;
  const general = crossedIdentity?.general ?? verifiedGamCondensedGeneral ?? resolveGamCondensedGeneral(record) ?? resolveGamAdditionalCondensedGeneral(record) ?? resolveGamExtendedCondensedGeneral(record) ?? resolveGamCleaningCondensedGeneral(record) ?? resolveGamForkliftCondensedGeneral(record) ?? resolveGamHandlingCondensedGeneral(record) ?? resolveGamPlatformCondensedGeneral(record) ?? resolveGamWarehouseCondensedGeneral(record) ?? resolveGamHysterCondensedGeneral(record) ?? resolveGamTennantCondensedGeneral(record) ?? resolveGamIndividualizedGeneral(record) ?? verifiedGomarizPriorityGeneral(record) ?? resolveGomarizIndividualizedGeneral(record) ?? resolveGomarizCriticalBriefGeneral(record) ?? resolveGomarizGeneralDescription(record) ?? resolveGomarizResidualGeneral(record) ?? mercaelevaGeneral ?? resolveGamPriorityBriefGeneral(record) ?? resolveGamCriticalBriefGeneral(record) ?? resolveGamGeneralDescription(record) ?? resolveGamModelSpecificGeneral(record) ?? resolveGamLongDescription(record) ?? verifiedGamFamilyGeneral ?? resolveGamTecnacarGeneral(record) ?? record.longDescription ?? missingDescriptions.long ?? missingGamDescriptions.long;
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
  const extendedGeneral = resolveGamVerifiedExtendedGeneral(record, verifiedResidualEditorial?.general ?? handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral);
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

  const preparedShort = verifiedResidualEditorial?.short ?? handlingEditorial?.short ?? warehouseEditorial?.short ?? specialtyEditorial?.short ?? residualCleaningShort ?? descriptions.short;
  const preparedLong = extendedGeneral ?? verifiedResidualEditorial?.general ?? handlingEditorial?.general ?? warehouseEditorial?.general ?? specialtyEditorial?.general ?? residualCleaningGeneral ?? elevationGeneral ?? conciseVerifiedGeneral ?? editorialGeneral;
  const sourceYearGeneral = issues.length === 0 ? includeSourceYearInGeneral(record, preparedLong, preparedShort, sourceFuelSpecs) : preparedLong;
  const sourcedBrakingGeneral = issues.length === 0
    ? includeGamRegenerativeBrakingInGeneral(record, sourceYearGeneral, sourceFuelSpecs) : sourceYearGeneral;
  const sourcedUnitGeneral = issues.length === 0
    ? includeGamSourceUnitDetailsInGeneral(sourceUnitRecord, sourcedBrakingGeneral, sourceFuelSpecs) : sourcedBrakingGeneral;
  const sourcedGradeabilityGeneral = issues.length === 0
    ? includeGamSourceGradeabilityInGeneral(sourceUnitRecord, sourcedUnitGeneral, sourceFuelSpecs) : sourcedUnitGeneral;
  const sourcedWeightGeneral = issues.length === 0
    ? includeGamSourceDeclaredWeightInGeneral(sourceUnitRecord, sourcedGradeabilityGeneral, sourceFuelSpecs) : sourcedGradeabilityGeneral;

  const sourcedSafetyGeneral = issues.length === 0
    ? includeGamSourceSafetyControlsInGeneral(sourceUnitRecord, sourcedWeightGeneral, sourceFuelSpecs) : sourcedWeightGeneral;

  const sourcedDimensionsGeneral = issues.length === 0
    ? includeGamSourceMachineDimensionsInGeneral(sourceUnitRecord, sourcedSafetyGeneral, sourceFuelSpecs) : sourcedSafetyGeneral;

  const sourcedForkliftGeneral = issues.length === 0
    ? includeGamSourceForkliftMeasuresInGeneral(sourceUnitRecord, sourcedDimensionsGeneral, sourceFuelSpecs) : sourcedDimensionsGeneral;

  const sourcedBatteryGeneral = issues.length === 0
    ? includeGamSourceBatteryVoltageInGeneral(sourceUnitRecord, sourcedForkliftGeneral, sourceFuelSpecs) : sourcedForkliftGeneral;
  const verifiedSourceGeneral = issues.length === 0
    ? resolveGamVerifiedUnitSourceGeneral(record, sourcedBatteryGeneral) ?? sourcedBatteryGeneral : sourcedBatteryGeneral;
  const verifiedEditorialGeneral = issues.length === 0
    ? resolveMercaelevaVerifiedSourceEditorial(sourceUnitRecord, verifiedSourceGeneral) ?? verifiedSourceGeneral : verifiedSourceGeneral;
  const canonicalBriefGeneral = issues.length === 0
    ? resolveVerifiedCanonicalBriefEditorial(sourceUnitRecord, verifiedEditorialGeneral) ?? verifiedEditorialGeneral : verifiedEditorialGeneral;
  const verifiedDescriptions = applyVerifiedEditorialComposition(
    sourceUnitRecord, preparedShort, canonicalBriefGeneral, issues.length === 0
  );

  const verifiedModelGeneral = issues.length === 0
    ? resolveGomarizVerifiedModelGeneral(sourceUnitRecord, verifiedDescriptions.general) : null;
  const verifiedResidualGeneral = issues.length === 0
    ? resolveGamVerifiedResidualGeneral(sourceUnitRecord, verifiedModelGeneral ?? verifiedDescriptions.general) : null;
  const verifiedUnitSummary = issues.length === 0
    ? resolveVerifiedUnitSummaryEditorial(sourceUnitRecord, verifiedDescriptions.short, verifiedDescriptions.general) : null;

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
    description: verifiedUnitSummary ?? verifiedDescriptions.short,
    description_general: verifiedResidualGeneral ?? verifiedModelGeneral ?? verifiedDescriptions.general,
    image: images[0] ?? null,
    images,
    spec: documented183Specs,
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
