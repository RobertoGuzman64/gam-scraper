import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { hasGamSourceUnitIdentity } from "../../technical/evidence/general-evidence/source-unit-identity.js";

const hasGradeability = (text: string): boolean =>
  /\bpendientes?\b[^.!?\n]{0,65}\d|\b\d{1,3}\s*%[^.!?\n]{0,45}\bpendientes?\b/iu.test(text);

export const includeGamSourceGradeabilityInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  if (!general?.trim() || !hasGamSourceUnitIdentity(record, general) ||
    record.categoryKey !== "elevacion") return general;

  const sourceValue = record.specs?.["Pendiente superable"];
  if (typeof sourceValue !== "string" || !/^(?:[1-9]\d?|100)\s*%$/u.test(sourceValue.trim()) ||
    specs["Pendiente superable"] !== sourceValue ||
    hasGradeability(general) || hasGradeability(record.longDescription ?? "")) return general;

  const value = sourceValue.trim().replace(/\s*%$/u, " %");
  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} La ficha técnica del proveedor declara una pendiente superable del ${value} para este modelo.`;
};
