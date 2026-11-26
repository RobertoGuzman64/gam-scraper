import type { ProductRecord, SpecValue, SpecsMap } from "../../../contracts/catalog.js";
import { reconcileGamVerifiedZeroSerial } from "../../../preparation/gam/identity/evidence/musoshi-serial-evidence.js";
import { recoverGamMislabelledBatterySpec } from "../../../preparation/gam/energy/source-battery-label-evidence.js";
import { recoverGamCrossedTechnicalSpecs } from "../../../preparation/gam/technical/crossed-specifications.js";
import { reconcileGamHorometer } from "../../../preparation/gam/reconciliation/gam-horometer.js";
import { reconcileGamSourceTechnicalUnits, reconcileGamSpreadsheetLiftHeight } from "../../../preparation/gam/reconciliation/gam-source-technical-units.js";
import { reconcileGamVerifiedClassicVehicleIdentity } from "../../../preparation/gam/identity/evidence/used-classic-vehicle-identity.js";
import { reconcileHandlingFamilySpecs } from "../../../preparation/technical/recovery/handling-family-specifications.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "../../../preparation/mercaeleva/evidence/verified-platform-source-specs.js";
import { reconcileMercaelevaNonUsableSentinels } from "../../../preparation/mercaeleva/technical/mercaeleva.js";
import { inspectTechnicalCoherence } from "../../validation/technical-specifications.js";
import { normalizedSpecKey, specHasValue } from "./content-gaps-source.js";
import { hasIndependentDescriptionSource, type DescriptionCoverageInput } from "./description-coverage.js";
import { accreditSourceTechnicalPresentation } from "../../../preparation/provenance/accredited-technical-presentation.js";

export type AccreditedSpecificationReconciliation = {
  readonly originalValue: SpecValue;
  readonly destinationKeys: readonly string[];
  readonly classification?: "origen_no_utilizable" | "transformacion_acreditada";
};

const presentSpecs = (specs: SpecsMap): ReadonlyMap<string, SpecValue> => {
  const values = new Map<string, SpecValue>();
  for (const [rawKey, value] of Object.entries(specs)) {
    if (specHasValue(value)) values.set(normalizedSpecKey(rawKey), value);
  }
  return values;
};

const reconciledSource = (source: ProductRecord, sourceUnits = true): ProductRecord => {
  const identified = reconcileGamVerifiedZeroSerial(source);
  const vehicle = reconcileGamVerifiedClassicVehicleIdentity(identified);
  const reconciled = reconcileMercaelevaNonUsableSentinels(
    reconcileGamHorometer(reconcileMercaelevaVerifiedPlatformSourceSpecs(vehicle)));
  const crossedSpecs = recoverGamCrossedTechnicalSpecs(reconciled);
  const batterySpecs = recoverGamMislabelledBatterySpec({ ...reconciled, specs: crossedSpecs });
  const legacyEvidenceRequired = source.reference === "2219" && batterySpecs === crossedSpecs;
  const normalizedSpecs = (sourceUnits && !legacyEvidenceRequired ?
    reconcileGamSourceTechnicalUnits({ ...reconciled, specs: batterySpecs }) :
    reconcileGamSpreadsheetLiftHeight({ ...reconciled, specs: batterySpecs })).specs ?? batterySpecs;
  const specs = reconcileHandlingFamilySpecs({ ...reconciled, specs: normalizedSpecs }, normalizedSpecs);
  return specs === reconciled.specs ? reconciled : { ...reconciled, specs };
};

const legacyReconciliations = (
  input: DescriptionCoverageInput
): ReadonlyMap<string, AccreditedSpecificationReconciliation> => {
  const original = presentSpecs(input.source.specs ?? {});
  const reconciled = presentSpecs(reconciledSource(input.source).specs ?? {});
  const sourceHorometer = reconcileGamHorometer(input.source);
  const horometer = presentSpecs(sourceHorometer.specs ?? {});
  const prepared = presentSpecs(input.prepared.product.spec);
  const reconciledUnits = presentSpecs(reconcileGamSourceTechnicalUnits(input.source).specs ?? {});
  const removed = [...original.keys()].filter((key) => !reconciled.has(key));
  if (removed.length === 0) return new Map();
  const replacements = [...reconciled].filter(([key, value]) =>
    !original.has(key) || JSON.stringify(original.get(key)) !== JSON.stringify(value));
  if (replacements.some(([key, value]) => JSON.stringify(prepared.get(key)) !== JSON.stringify(value))) return new Map();
  const result = new Map<string, AccreditedSpecificationReconciliation>();
  for (const key of removed) {
    if (prepared.has(key)) continue;
    const originalValue = original.get(key);
    if (originalValue === undefined) continue;
    const unitsRemoved = input.source.providerId === "gam" && !reconciledUnits.has(key);
    const sourceKey = Object.keys(input.source.specs ?? {}).find((originalKey) => normalizedSpecKey(originalKey) === key);
    if (sourceKey === undefined) continue;
    let destinations: string[];
    if (unitsRemoved) {
      const alternateSpecs = { ...input.source.specs };
      delete alternateSpecs[sourceKey];
      const alternate = presentSpecs(reconciledSource({ ...input.source, specs: alternateSpecs }).specs ?? {});
      destinations = replacements.filter(([destination, value]) =>
        JSON.stringify(alternate.get(destination)) !== JSON.stringify(value)).map(([destination]) => destination);
    } else {
      destinations = [...presentSpecs(reconciledSource(input.source, false).specs ?? {})].filter(([destination, value]) =>
        !original.has(destination) || JSON.stringify(original.get(destination)) !== JSON.stringify(value))
        .map(([destination]) => destination);
    }
    const unusableHorometer = sourceHorometer !== input.source && !horometer.has(key) &&
      key === normalizedSpecKey("Horómetro");
    const unusableSpreadsheet = input.source.providerId === "gam" &&
      key === normalizedSpecKey("Altura de elevación (mm)") && originalValue === "#VALUE! mm";
    const unusableSentinel = input.source.providerId === "mercaeleva" &&
      inspectTechnicalCoherence(input.source.specs ?? {}).some((issue) =>
        issue.code === "valor-centinela-no-utilizable" && normalizedSpecKey(issue.key) === key &&
        typeof input.source.specs?.[issue.key] === "string");
    const unusable = unusableHorometer || unusableSpreadsheet || unusableSentinel || (unitsRemoved && destinations.length === 0);
    result.set(key, {
      originalValue, destinationKeys: unusable ? [] : destinations.sort(),
      classification: unusable ? "origen_no_utilizable" : "transformacion_acreditada"
    });
  }
  return result;
};

export const accreditedSpecificationReconciliations = (
  input: DescriptionCoverageInput
): ReadonlyMap<string, AccreditedSpecificationReconciliation> => {
  if (!hasIndependentDescriptionSource(input.origin)) return new Map();
  const original = presentSpecs(input.source.specs ?? {});
  const prepared = presentSpecs(input.prepared.product.spec);
  if (![...original.keys()].some((key) => !prepared.has(key))) return new Map();
  const result = new Map(legacyReconciliations(input));
  const sourceFields = Object.keys(input.source.specs ?? {});
  const preparedFields = Object.keys(input.prepared.product.spec);
  for (const proof of accreditSourceTechnicalPresentation(input.source, input.prepared.product).values()) {
    const key = normalizedSpecKey(proof.sourceField);
    const destination = normalizedSpecKey(proof.destinationField);
    if (!original.has(key) || prepared.has(key) || !prepared.has(destination) ||
      sourceFields.filter((field) => normalizedSpecKey(field) === key).length !== 1 ||
      preparedFields.filter((field) => normalizedSpecKey(field) === destination).length !== 1) continue;
    result.set(key, { originalValue: proof.originalValue, destinationKeys: [destination],
      classification: "transformacion_acreditada" });
  }
  return result;
};
