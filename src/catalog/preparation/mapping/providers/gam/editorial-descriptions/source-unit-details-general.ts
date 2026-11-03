import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { hasGamSourceUnitIdentity } from "../../../../evidence/providers/gam/general-evidence/source-unit-identity.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const hasConflictingYears = (record: ProductRecord): boolean => {
  const year = record.year;
  if (!year || !/^(?:19|20)\d{2}$/u.test(year)) return false;
  return [...(record.longDescription ?? "").matchAll(/\b(?:19|20)\d{2}\b/gu)]
    .some(([found]) => found !== year);
};

export const includeGamSourceUnitDetailsInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  if (!general?.trim() || !hasGamSourceUnitIdentity(record, general) || hasConflictingYears(record)) return general;

  const serial = record.specs?.["Nº de serie"];
  const hours = record.horometer?.trim();
  const identity = typeof serial === "string" &&
    /^[a-z0-9][a-z0-9./-]{5,35}$/iu.test(serial) &&
    specs["Nº de serie"] === serial &&
    !normalized(general).includes(normalized(serial)) &&
    !/\b(?:n[uú]mero\s+de\s+serie|n[ºo]\s*de\s+serie|serie\s*[:#-])/iu.test(general)
    ? `número de serie ${serial}` : null;
  const horometer = hours && /^[1-9]\d{0,5} horas$/u.test(hours) &&
    record.specs?.["Horómetro"] === hours && specs["Horómetro"] === hours &&
    !/\bhor[oó]metro\b|\b\d[\d., ]*\s*(?:horas?|h)\b/iu.test(general)
    ? `horómetro de ${hours}` : null;
  const details = [identity, horometer].filter((detail): detail is string => detail !== null);
  if (details.length === 0) return general;

  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} Según la ficha del proveedor, esta unidad tiene ${details.join(" y ")}.`;
};
