import { reconcileGamForeignCategoryTitle } from "../../../gam/identity/reconciliation/gam-foreign-category-title.js";
import { reconcileGamSourceIdentity } from "../../../gam/identity/reconciliation/gam-source-identity.js";
import { reconcileGamVerifiedHysterSGlp } from "../../../gam/technical/models/hyster-s-glp-evidence.js";
import { reconcileGamVerifiedYaleGc40vxLpg } from "../../../gam/technical/models/yale-gc40vx-lpg-evidence.js";
import { reconcileGamVerifiedYaleGc45vxLpg } from "../../../gam/technical/models/yale-gc45vx-lpg-evidence.js";
import { reconcileGamVerifiedYaleGc55vxGlp } from "../../../gam/technical/models/yale-gc55vx-glp-evidence.js";
import { reconcileGamVerifiedManufacturerLoad } from "../../../gam/technical/models/gam-verified-manufacturer-load.js";
import { reconcileGamVerifiedReviewClaims } from "../../../gam/technical/models/gam-verified-review-claims.js";
import { reconcileGamVerifiedListing } from "../../../gam/technical/models/gam-verified-listing-reconciliation.js";
import { reconcileGamVerifiedSourceClaims } from "../../../gam/technical/models/gam-verified-source-claims.js";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../../technical-recovery-observation.js";
import { reconcileGamInitialTechnicalEvidence, reconcileGamTechnicalIdentity, reconcileGamTechnicalBeforeEditorial, reconcileGamTechnicalCapacities, reconcileGamTechnicalMeasurements, normalizeGamTechnicalSpecs } from "../../../gam/technical/reconciliation/preparation-technical-stages.js";
import { reconcileMercaelevaInitialTechnicalEvidence, reconcileMercaelevaSourceFamily, reconcileMercaelevaSourceTechnicalSpecs, reconcileMercaelevaTechnicalBeforeEditorial, reconcileMercaelevaTechnicalCapacity, reconcileMercaelevaTechnicalCorroboratedCapacity, sanitizeMercaelevaTechnicalSpecs } from "../../../mercaeleva/technical/reconciliation/preparation-technical-stages.js";
import { reconcileGomarizDocumentedWeight } from "../../../gomariz/technical/evidence/documented-weight.js";
import { reconcileGomarizDocumented1cxFuel } from "../../../gomariz/technical/evidence/verified-1cx-fuel.js";
import { reconcileGomarizVerifiedElectricSemanticSource, reconcileGomarizVerifiedPlatformHeight, reconcileGomarizVerifiedTowerModel, reconcileGomarizVerifiedCompositeBrand } from "../../../gomariz/technical/reconciliation/gomariz.js";

export const reconcileSourceCategoryTitle = (record: ProductRecord): ProductRecord =>
  reconcileGamForeignCategoryTitle(record);

export const reconcileVerifiedSourceIdentity = (record: ProductRecord): ProductRecord =>
  reconcileGamSourceIdentity(record);

export const reconcileVerifiedSourceReviewClaims = (record: ProductRecord): ProductRecord =>
  reconcileGamVerifiedListing(reconcileGamVerifiedReviewClaims(record));

export const reconcileVerifiedSourceFamily = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaSourceFamily(record);

export const reconcileVerifiedSourceFuel = (record: ProductRecord): ProductRecord => {
  record = reconcileGamVerifiedHysterSGlp(record);
  record = reconcileGamVerifiedYaleGc40vxLpg(record);
  record = reconcileGamVerifiedYaleGc45vxLpg(record);
  return reconcileGomarizDocumented1cxFuel(reconcileGamVerifiedYaleGc55vxGlp(record));
};

export const reconcileVerifiedManufacturerSourceLoad = (record: ProductRecord): ProductRecord =>
  reconcileGamVerifiedSourceClaims(reconcileGamVerifiedManufacturerLoad(record));

export const reconcileInitialTechnicalEvidence = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaInitialTechnicalEvidence(reconcileGamInitialTechnicalEvidence(record));

export const resolveSourceTechnicalSemanticRecord = (record: ProductRecord): ProductRecord =>
  reconcileGomarizVerifiedElectricSemanticSource(reconcileMercaelevaSourceFamily(record));

export const reconcileTechnicalSourceForRecovery = (record: ProductRecord): ProductRecord => {
  record = reconcileMercaelevaSourceFamily(record);
  record = reconcileGamTechnicalIdentity(record);
  return reconcileGomarizDocumentedWeight(reconcileGomarizVerifiedCompositeBrand(reconcileGomarizVerifiedTowerModel(
    reconcileMercaelevaSourceTechnicalSpecs(record))));
};

export const reconcileTechnicalBeforeEditorial = (record: ProductRecord, observe?: TechnicalRecoveryObservation): ProductRecord =>
  reconcileMercaelevaTechnicalBeforeEditorial(reconcileGamTechnicalBeforeEditorial(record, observe));

export const reconcileTechnicalAfterEditorial = (record: ProductRecord): ProductRecord => {
  record = reconcileMercaelevaTechnicalCapacity(record);
  record = reconcileGamTechnicalCapacities(record);
  record = reconcileGomarizVerifiedPlatformHeight(record);
  record = reconcileMercaelevaTechnicalCorroboratedCapacity(record);
  return reconcileGamTechnicalMeasurements(record);
};

export const normalizePreparedTechnicalSpecs = (
  record: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): SpecsMap => normalizeGamTechnicalSpecs(record, sanitizeMercaelevaTechnicalSpecs(record, specs), observe);
