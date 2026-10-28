import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { gamHandlingModelEvidence } from "./handling.js";
import { cleaningFamily, energy, batteryFromConfirmedDescription, driver } from "../../../evidence/providers/gam/cleaning-evidence.js";
import { workWidth } from "./cleaning-width.js";

export { gamCleaningCorrectedWidth, gamCleaningWidthConflicts } from "./cleaning-width.js";

export const gamCleaningCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (!cleaningFamily(record)) return null;
  if (/^microfregadora\b/i.test(record.title ?? "") &&
    (!record.longDescription || !gamHandlingModelEvidence(record, record.longDescription))) return null;
  const modelCode = record.model?.match(/\b([a-z]{1,4}\d{2,4})([a-z]{1,3})\b/i);
  if (modelCode?.[1] && modelCode[2]) {
    const variants = `${record.shortDescription ?? ""} ${record.longDescription ?? ""}`.match(new RegExp(`\\b${modelCode[1]}[a-z]{1,3}\\b`, "gi")) ?? [];
    if (variants.some((variant) => variant.toLowerCase() !== `${modelCode[1]}${modelCode[2]}`.toLowerCase())) {
      return null;
    }
  }
  const text = `${record.title}. ${record.shortDescription ?? ""}. ${record.longDescription ?? ""}`;
  if (attribute.name === "Alimentación" && attribute.type === "SELECT") {
    const value = energy(text) ?? batteryFromConfirmedDescription(record);
    return value === null ? null : { key: attribute.name, value };
  }
  if (attribute.name === "Tipo de conductor" && attribute.type === "SELECT") {
    const modelToken = record.model?.split(/[^a-zA-Z0-9]+/).find((part) => part.length >= 3 && /[a-zA-Z]/.test(part) && /\d/.test(part));
    const trustedShort = modelToken && record.shortDescription &&
      new RegExp(`\\b${modelToken}\\b`, "i").test(record.shortDescription)
      ? record.shortDescription : "";
    const value = driver(`${text} ${trustedShort}`);
    return value === null ? null : { key: attribute.name, value };
  }
  if (attribute.name === "Ancho de trabajo" && attribute.type === "NUMBER" && attribute.unit_option === "mm") {
    const value = workWidth(text);
    return value === null ? null : { key: attribute.name, value };
  }
  return null;
};
