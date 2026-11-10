import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { reconcileGamInitialTechnicalEvidence, reconcileGamTechnicalIdentity, reconcileGamTechnicalBeforeEditorial, reconcileGamTechnicalCapacities, reconcileGamTechnicalMeasurements, normalizeGamTechnicalSpecs } from "../../../gam/technical/reconciliation/preparation-technical-stages.js";
import { reconcileMercaelevaInitialTechnicalEvidence, reconcileMercaelevaSourceFamily, reconcileMercaelevaSourceTechnicalSpecs, reconcileMercaelevaTechnicalBeforeEditorial, reconcileMercaelevaTechnicalCapacity, reconcileMercaelevaTechnicalCorroboratedCapacity, sanitizeMercaelevaTechnicalSpecs } from "../../../mercaeleva/technical/reconciliation/preparation-technical-stages.js";
import { reconcileGomarizVerifiedElectricSemanticSource, reconcileGomarizVerifiedPlatformHeight } from "../../../gomariz/technical/reconciliation/gomariz.js";

export const reconcileInitialTechnicalEvidence = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaInitialTechnicalEvidence(reconcileGamInitialTechnicalEvidence(record));

export const resolveSourceTechnicalSemanticRecord = (record: ProductRecord): ProductRecord =>
  reconcileGomarizVerifiedElectricSemanticSource(reconcileMercaelevaSourceFamily(record));

export const reconcileTechnicalSourceForRecovery = (record: ProductRecord): ProductRecord => {
  record = reconcileMercaelevaSourceFamily(record);
  record = reconcileGamTechnicalIdentity(record);
  return reconcileMercaelevaSourceTechnicalSpecs(record);
};

export const reconcileTechnicalBeforeEditorial = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaTechnicalBeforeEditorial(reconcileGamTechnicalBeforeEditorial(record));

export const reconcileTechnicalAfterEditorial = (record: ProductRecord): ProductRecord => {
  record = reconcileMercaelevaTechnicalCapacity(record);
  record = reconcileGamTechnicalCapacities(record);
  record = reconcileGomarizVerifiedPlatformHeight(record);
  record = reconcileMercaelevaTechnicalCorroboratedCapacity(record);
  return reconcileGamTechnicalMeasurements(record);
};

export const normalizePreparedTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  normalizeGamTechnicalSpecs(record, sanitizeMercaelevaTechnicalSpecs(record, specs));
