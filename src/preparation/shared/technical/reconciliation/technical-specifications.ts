import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

export const applyReconciledTechnicalSpecs = (
  previous: ProductRecord,
  reconciled: ProductRecord,
  documented: SpecsMap
): SpecsMap => {
  const updated = { ...documented };
  for (const [key, value] of Object.entries(reconciled.specs ?? {})) {
    if (previous.specs?.[key] !== value) updated[key] = value;
  }
  for (const key of Object.keys(previous.specs ?? {})) {
    if (!(key in (reconciled.specs ?? {}))) delete updated[key];
  }
  return updated;
};
