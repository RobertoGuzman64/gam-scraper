import type { ProductRecord, SpecValue, SpecsMap } from "../../contracts/catalog.js";
import { reconcileGamVerifiedZeroSerial } from "../../preparation/gam/identity/evidence/musoshi-serial-evidence.js";
import { recoverGamMislabelledBatterySpec } from "../../preparation/gam/technical/evidence/energy-and-powertrain/source-battery-label-evidence.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "../../preparation/mercaeleva/technical/evidence/verified-platform-source-specs.js";
import { normalizedSpecKey, specHasValue } from "./content-gaps-source.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";

export type AccreditedSpecificationReconciliation = {
  readonly originalValue: SpecValue;
  readonly destinationKeys: readonly string[];
};

const presentSpecs = (specs: SpecsMap): ReadonlyMap<string, SpecValue> => {
  const values = new Map<string, SpecValue>();
  for (const [rawKey, value] of Object.entries(specs)) {
    if (specHasValue(value)) values.set(normalizedSpecKey(rawKey), value);
  }
  return values;
};

const reconciledSource = (source: ProductRecord): ProductRecord => {
  const identified = reconcileGamVerifiedZeroSerial(source);
  const reconciled = reconcileMercaelevaVerifiedPlatformSourceSpecs(identified);
  const batterySpecs = recoverGamMislabelledBatterySpec(reconciled);
  return batterySpecs === reconciled.specs ? reconciled : { ...reconciled, specs: batterySpecs };
};

export const accreditedSpecificationReconciliations = (
  input: DescriptionCoverageInput
): ReadonlyMap<string, AccreditedSpecificationReconciliation> => {
  if (input.origin !== "original_canonico") return new Map();
  const original = presentSpecs(input.source.specs ?? {});
  const reconciled = presentSpecs(reconciledSource(input.source).specs ?? {});
  const prepared = presentSpecs(input.prepared.product.spec);
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
    result.set(key, { originalValue, destinationKeys: replacements.map(([destination]) => destination).sort() });
  }
  return result;
};
