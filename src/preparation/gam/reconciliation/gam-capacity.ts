import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { gamHandlingReconciledCapacity } from "../measurements/evidence/capacity-evidence.js";

import { gamElevationCandidate } from "../measurements/elevation.js";
import { gamElevationIdentityConflict } from "../identity/evidence/elevation-identity.js";
import { resolvedEditorialUnitFamilies } from "../../editorial/identity/editorial-unit-provenance.js";
import { reconcileOriginalMassCapacityPresentation } from "../../technical/technical-presentation.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";
import { parseNumber } from "../../../catalog/normalization/spec-parsers.js";
import { fold } from "../../classification/attribute-utils.js";

export const reconcileGamBasketCapacityPresentation = (original: ProductRecord, specs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  if (original.providerId !== "gam") return specs;
  const family = resolvedEditorialUnitFamilies(original, original)?.[0];
  if (!family?.startsWith("plataforma-") || gamElevationIdentityConflict(original)) return specs;
  const text = fold(`${original.shortDescription ?? ""} ${original.longDescription ?? ""}`);
  if (/\b(?:con|sin)\s+(?:restricciones?|restriccion|limitaciones?|limitacion)\b|\bcapacidad\s+(?:dual|restringida|variable)\b/u.test(text)) return specs;
  const capacity = gamElevationCandidate(original, { name: "Capacidad de la cesta", type: "NUMBER", unit_option: "kg" });
  const raw = original.specs?.["Capacidad de carga (kg)"];
  if (!capacity || capacity.value !== parseNumber(raw, "kg")) return specs;
  return reconcileOriginalMassCapacityPresentation(original, specs, "Capacidad de carga (kg)", "Capacidad de la cesta",
    "src/preparation/gam/reconciliation/gam-capacity.ts", observe);
};

export const reconcileGamCorroboratedLoadCapacity = (record: ProductRecord): ProductRecord => {
  const capacity = gamHandlingReconciledCapacity(record);
  if (capacity === null || record.specs?.["Capacidad de carga (kg)"] === `${capacity} KG`) return record;
  return { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": `${capacity} KG` } };
};
