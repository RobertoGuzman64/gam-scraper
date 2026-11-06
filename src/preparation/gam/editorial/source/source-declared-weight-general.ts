import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { hasGamSourceUnitIdentity } from "../../technical/source/source-unit-identity.js";

const weightLiteral = /^(\d{3,5})\s*KG$/iu;
const weightMention = /\b(?:peso|masa)\b/iu;

const mentionsExactModel = (text: string, model: string): boolean => {
  const parts = model.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
    .split(/[^a-z0-9]+/iu).filter(Boolean);
  if (parts.length === 0) return false;
  const expression = parts.join("[^\\p{L}\\p{N}]*");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${expression}(?![\\p{L}\\p{N}])`, "iu").test(text);
};

export const includeGamSourceDeclaredWeightInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  const model = record.model;
  if (!general?.trim() || record.categoryKey !== "elevacion" ||
    !hasGamSourceUnitIdentity(record, general) || !model ||
    !record.title || !record.shortDescription || !record.longDescription ||
    ![record.title, record.shortDescription, record.longDescription, general]
      .every((part) => mentionsExactModel(part, model)) ||
    weightMention.test(general) || weightMention.test(record.longDescription)) return general;

  const sourceWeight = record.specs?.Peso;
  if (typeof sourceWeight !== "string" || specs.Peso !== sourceWeight) return general;
  const match = weightLiteral.exec(sourceWeight.trim());
  const kilograms = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(kilograms) || kilograms < 250 || kilograms > 30000) return general;

  const text = general.trim();
  const formatted = String(kilograms).replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
  const alreadyStated = new RegExp(`(?<!\\d)(?:${kilograms}|${formatted.replaceAll(".", "\\.")})\\s*kg\\b`, "iu");
  if (alreadyStated.test(general)) return general;
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} El peso indicado en la ficha técnica del proveedor es de ${formatted} kg.`;
};
