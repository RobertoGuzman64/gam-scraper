import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { reconcileGamVerifiedYaleGp80vx } from "./gam-yale-gp80vx.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./gam.js";
import { reconcileGamVerifiedListingIdentity, reconcileGamVerifiedModelIdentity, reconcileGamVerifiedCapacityCoherence, reconcileGamVerifiedBasketLoad } from "./gam-verified-capacity-coherence.js";
import { reconcileGamCorroboratedLoadCapacity } from "./gam-capacity.js";
import { reconcileGamBasketDimensions } from "./gam-basket-dimensions.js";
import { reconcileGamVerifiedBasketSizes } from "./gam-verified-basket-sizes.js";
import { reconcileGamHorometer } from "./gam-horometer.js";
import { reconcileGamSourceTechnicalUnits } from "./gam-source-technical-units.js";

export const reconcileGamInitialTechnicalEvidence = (record: ProductRecord): ProductRecord =>
  reconcileGamVerifiedYaleGp80vx(record);

export const reconcileGamTechnicalIdentity = (record: ProductRecord): ProductRecord => {
  record = reconcileGamInitialIdentity(record);
  record = reconcileGamVerifiedListingIdentity(record);
  return reconcileGamVerifiedModelIdentity(record);
};

export const reconcileGamTechnicalBeforeEditorial = (record: ProductRecord): ProductRecord =>
  reconcileGamForPreparation(record);

export const reconcileGamTechnicalCapacities = (record: ProductRecord): ProductRecord => {
  record = reconcileGamVerifiedCapacityCoherence(record);
  record = reconcileGamVerifiedBasketLoad(record);
  return reconcileGamCorroboratedLoadCapacity(record);
};

export const reconcileGamTechnicalMeasurements = (record: ProductRecord): ProductRecord => {
  record = reconcileGamBasketDimensions(record);
  record = reconcileGamVerifiedBasketSizes(record);
  return reconcileGamHorometer(record);
};

export const normalizeGamTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  reconcileGamSourceTechnicalUnits({ ...record, specs }).specs ?? specs;
