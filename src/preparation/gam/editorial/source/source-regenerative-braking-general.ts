import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { hasGamSourceRegenerativeBraking } from "../../technical/mobility/source-regenerative-braking.js";

export const includeGamRegenerativeBrakingInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  if (!general?.trim() || specs["Frenado regenerativo"] !== true ||
    /regenerativ[oa]s?/iu.test(general) || !hasGamSourceRegenerativeBraking(record)) return general;
  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} La ficha del proveedor confirma que este modelo dispone de frenado regenerativo.`;
};
