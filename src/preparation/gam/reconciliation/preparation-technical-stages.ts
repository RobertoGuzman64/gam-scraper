import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";
import { reconcileGamVerifiedYaleGp80vx } from "./gam-yale-gp80vx.js";
import { reconcileGamInitialIdentity, reconcileGamForPreparation } from "./gam.js";
import { reconcileGamVerifiedListingIdentity, reconcileGamVerifiedModelIdentity, reconcileGamVerifiedCapacityCoherence, reconcileGamVerifiedBasketLoad } from "./gam-verified-capacity-coherence.js";
import { reconcileGamCorroboratedLoadCapacity } from "./gam-capacity.js";
import { reconcileGamCorroboratedSummaryCapacity } from "./gam-source-summary-capacity.js";
import { reconcileGamBasketDimensions } from "./gam-basket-dimensions.js";
import { reconcileGamVerifiedBasketSizes } from "./gam-verified-basket-sizes.js";
import { reconcileGamHorometer } from "./gam-horometer.js";
import { reconcileGamCorroboratedSummaryModel } from "../identity/gam-corroborated-summary-model.js";
import { reconcileGamSourceTechnicalUnits } from "./gam-source-technical-units.js";

export const reconcileGamInitialTechnicalEvidence = (record: ProductRecord): ProductRecord =>
  reconcileGamVerifiedYaleGp80vx(record);

export const reconcileGamTechnicalIdentity = (record: ProductRecord): ProductRecord => {
  record = reconcileGamInitialIdentity(record);
  record = reconcileGamVerifiedListingIdentity(record);
  return reconcileGamCorroboratedSummaryModel(reconcileGamVerifiedModelIdentity(record));
};

export const reconcileGamTechnicalBeforeEditorial = (record: ProductRecord, observe?: TechnicalRecoveryObservation): ProductRecord =>
  reconcileGamForPreparation(record, observe);

export const reconcileGamTechnicalCapacities = (record: ProductRecord): ProductRecord => {
  record = reconcileGamVerifiedCapacityCoherence(record);
  record = reconcileGamVerifiedBasketLoad(record);
  return reconcileGamCorroboratedSummaryCapacity(reconcileGamCorroboratedLoadCapacity(record));
};

export const reconcileGamTechnicalMeasurements = (record: ProductRecord): ProductRecord => {
  record = reconcileGamBasketDimensions(record);
  record = reconcileGamVerifiedBasketSizes(record);
  return reconcileGamHorometer(record);
};

export const normalizeGamTechnicalSpecs = (
  record: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): SpecsMap => {
  const normalized = reconcileGamSourceTechnicalUnits({ ...record, specs }).specs ?? specs;
  const mechanism = "src/preparation/gam/technical/reconciliation/gam-source-technical-units.ts";
  const source = record.specs ?? {};
  for (const [field, sourceField] of [
    ["Voltaje batería (V)", typeof source["Ancho promedio"] === "string" ? "Ancho promedio" : "Capacidad de la batería"],
    ["Capacidad de la batería (Ah)", "Ancho promedio"]
  ] as const) {
    const value = normalized[field];
    if (value !== undefined && !(field in specs) && typeof source[sourceField] === "string" &&
      !(sourceField in normalized)) {
      observe?.(specs, { ...specs, [field]: value }, mechanism, { spec: sourceField });
    }
  }
  observe?.(specs, normalized, mechanism);
  return normalized;
};
