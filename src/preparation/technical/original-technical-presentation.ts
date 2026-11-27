import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../provenance/technical-recovery-observation.js";
import { reconcileGamWorkingHeightPresentation } from "../gam/measurements/evidence/work-height-evidence.js";
import { reconcileGamBasketCapacityPresentation } from "../gam/reconciliation/gam-capacity.js";
import { reconcileGomarizMassCapacityPresentation, reconcileGomarizRedundantWorkingHeight, reconcileGomarizRoundedWorkingHeight } from "../gomariz/technical/gomariz.js";
import { reconcileManainMassCapacityPresentation, reconcileManainScissorExtensionPresentation } from "../manain/normalization.js";
import { normalizeOriginalTechnicalPresentation } from "./technical-presentation.js";

export const reconcileOriginalTechnicalPresentation = (original: ProductRecord, specs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const normalized = normalizeOriginalTechnicalPresentation(specs, original.specs ?? {}, observe);
  const height = reconcileGamWorkingHeightPresentation(original, normalized, observe);
  const capacity = reconcileGamBasketCapacityPresentation(original, height, observe);
  const gomariz = reconcileGomarizMassCapacityPresentation(original, capacity, observe);
  const heightPresentation = reconcileGomarizRoundedWorkingHeight(original, reconcileGomarizRedundantWorkingHeight(original, gomariz, observe), observe);
  const manain = reconcileManainMassCapacityPresentation(original, heightPresentation, observe);
  return reconcileManainScissorExtensionPresentation(original, manain, observe);
};
