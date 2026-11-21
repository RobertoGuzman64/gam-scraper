import { recoverGamDocumentedSourcePerformanceSpecs } from "../../../gam/technical/models/documented-source-performance-specs.js";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../../technical-recovery-observation.js";
import { recoverMercaelevaDocumentedSourceSpecs } from "../../../mercaeleva/technical/evidence/documented-source-recovery.js";
import { recoverGamDocumentedHandlingAndStorageSpecs } from "../../../gam/technical/models/documented-handling-recovery.js";
import { recoverMercaelevaDocumentedLgmgAndBtLiftSpecs } from "../../../mercaeleva/technical/evidence/documented-lgmg-and-bt-lift-specs.js";
import { recoverGamDocumentedIndustrialEquipmentSpecs } from "../../../gam/technical/models/documented-industrial-equipment-specs.js";
import { recoverMercaelevaDocumentedLiftingAndWarehouseSpecs } from "../../../mercaeleva/technical/evidence/documented-lifting-and-warehouse-specs.js";
import { recoverGomarizDocumentedScaniaP220Specs } from "../../../gomariz/technical/evidence/documented-scania-p220-specs.js";
import { recoverGamDocumentedMobilityAndAccessSpecs } from "../../../gam/technical/models/documented-mobility-and-access-specs.js";
import { recoverMercaelevaDocumentedTransportAndAccessSpecs } from "../../../mercaeleva/technical/evidence/documented-transport-and-access-specs.js";
import { recoverGomarizDocumentedRenaultPremiumSpecs } from "../../../gomariz/technical/evidence/documented-renault-premium-specs.js";
import { recoverGamDocumentedElectricMobilityAndTruckAccessSpecs } from "../../../gam/technical/models/documented-electric-mobility-and-truck-access-specs.js";
import { recoverMercaelevaDocumentedToyotaForkliftSpecs } from "../../../mercaeleva/technical/evidence/documented-toyota-forklift-specs.js";
import { recoverGamDocumentedMultiUnitLotSpecs } from "../../../gam/technical/models/documented-multi-unit-lot-specs.js";
import { recoverMercaelevaDocumentedJlgSl203204Specs } from "../../../mercaeleva/technical/evidence/documented-jlg-sl203-204-specs.js";

export const recoverDocumentedTechnicalSpecs = (
  sourceUnitRecord: ProductRecord, sourceYearSpecs: SpecsMap, observe?: TechnicalRecoveryObservation
): { sourceFuelSpecs: SpecsMap; documentedSpecs: SpecsMap } => {
  const { sourceFuelSpecs, documentedSpecs: documentedEquipmentSpecs } = recoverMercaelevaDocumentedSourceSpecs(sourceUnitRecord, sourceYearSpecs, observe);
  const documentedModulaSpecs = recoverGamDocumentedHandlingAndStorageSpecs(sourceUnitRecord, documentedEquipmentSpecs, observe);
  const documentedResidualLifts = recoverMercaelevaDocumentedLgmgAndBtLiftSpecs(sourceUnitRecord, documentedModulaSpecs, observe);
  observe?.(documentedModulaSpecs, documentedResidualLifts, "src/preparation/mercaeleva/technical/evidence/documented-lgmg-and-bt-lift-specs.ts");
  const documentedDensity180Gam = recoverGamDocumentedIndustrialEquipmentSpecs(sourceUnitRecord, documentedResidualLifts, observe);
  observe?.(documentedResidualLifts, documentedDensity180Gam, "src/preparation/gam/technical/models/documented-industrial-equipment-specs.ts");
  const documentedDensity180Mercaeleva = recoverMercaelevaDocumentedLiftingAndWarehouseSpecs(sourceUnitRecord, documentedDensity180Gam, observe);
  observe?.(documentedDensity180Gam, documentedDensity180Mercaeleva, "src/preparation/mercaeleva/technical/evidence/documented-lifting-and-warehouse-specs.ts");
  const documentedDensity180Specs = recoverGomarizDocumentedScaniaP220Specs(sourceUnitRecord, documentedDensity180Mercaeleva);
  observe?.(documentedDensity180Mercaeleva, documentedDensity180Specs, "src/preparation/gomariz/technical/evidence/documented-scania-p220-specs.ts");
  const documentedDensityResidualGam = recoverGamDocumentedMobilityAndAccessSpecs(sourceUnitRecord, documentedDensity180Specs, observe);
  observe?.(documentedDensity180Specs, documentedDensityResidualGam, "src/preparation/gam/technical/models/documented-mobility-and-access-specs.ts");
  const documentedDensityResidualMercaeleva = recoverMercaelevaDocumentedTransportAndAccessSpecs(sourceUnitRecord, documentedDensityResidualGam, observe);
  observe?.(documentedDensityResidualGam, documentedDensityResidualMercaeleva, "src/preparation/mercaeleva/technical/evidence/documented-transport-and-access-specs.ts");
  const documentedDensityResidualSpecs = recoverGomarizDocumentedRenaultPremiumSpecs(sourceUnitRecord, documentedDensityResidualMercaeleva);
  observe?.(documentedDensityResidualMercaeleva, documentedDensityResidualSpecs, "src/preparation/gomariz/technical/evidence/documented-renault-premium-specs.ts");
  const documentedPendingGam = recoverGamDocumentedElectricMobilityAndTruckAccessSpecs(sourceUnitRecord, documentedDensityResidualSpecs, observe);
  observe?.(documentedDensityResidualSpecs, documentedPendingGam, "src/preparation/gam/technical/models/documented-electric-mobility-and-truck-access-specs.ts");
  const documentedPendingSpecs = recoverMercaelevaDocumentedToyotaForkliftSpecs(sourceUnitRecord, documentedPendingGam, observe);
  observe?.(documentedPendingGam, documentedPendingSpecs, "src/preparation/mercaeleva/technical/evidence/documented-toyota-forklift-specs.ts");
  const documented183Gam = recoverGamDocumentedMultiUnitLotSpecs(sourceUnitRecord, documentedPendingSpecs, observe);
  observe?.(documentedPendingSpecs, documented183Gam, "src/preparation/gam/technical/models/documented-multi-unit-lot-specs.ts");
  const documented183Specs = recoverMercaelevaDocumentedJlgSl203204Specs(sourceUnitRecord, documented183Gam, observe);
  observe?.(documented183Gam, documented183Specs, "src/preparation/mercaeleva/technical/evidence/documented-jlg-sl203-204-specs.ts");
  const documentedSourcePerformanceSpecs = recoverGamDocumentedSourcePerformanceSpecs(sourceUnitRecord, documented183Specs, observe);
  observe?.(documented183Specs, documentedSourcePerformanceSpecs, "src/preparation/gam/technical/models/documented-source-performance-specs.ts");
  return { sourceFuelSpecs, documentedSpecs: documentedSourcePerformanceSpecs };
};
