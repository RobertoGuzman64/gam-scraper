import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { hasGamSourceUnitIdentity } from "../../technical/source/source-unit-identity.js";

const measurement = /^(\d{3,5})\s*mm$/iu;
const describedDimensions = /\b(?:longitud|anchura|ancho|medidas|dimensiones|mide|alto\s+total|altura\s+(?:total|de transporte))\b/iu;

const exactModel = (text: string, model: string): boolean => {
  const parts = model.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
    .split(/[^a-z0-9]+/iu).filter(Boolean);
  if (parts.length === 0) return false;
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${parts.join("[^\\p{L}\\p{N}]*")}(?![\\p{L}\\p{N}])`, "iu").test(text);
};

const millimetres = (value: unknown, minimum: number, maximum: number): number | null => {
  if (typeof value !== "string") return null;
  const match = measurement.exec(value.trim());
  if (!match?.[1]) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
};

const metres = (millimetresValue: number): string =>
  (millimetresValue / 1000).toLocaleString("es-ES", { maximumFractionDigits: 3 });

export const includeGamSourceMachineDimensionsInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  const model = record.model;
  if (!general?.trim() || record.categoryKey !== "elevacion" || !model ||
    !hasGamSourceUnitIdentity(record, general) || !record.title ||
    !record.shortDescription || !record.longDescription ||
    ![record.title, record.shortDescription, record.longDescription, general]
      .every((part) => exactModel(part, model)) ||
    describedDimensions.test(general) || describedDimensions.test(record.longDescription)) return general;

  const source = record.specs;
  if (!source || ["Longitud", "Anchura", "Altura"].some((key) =>
    source[key] === undefined || source[key] !== specs[key])) return general;
  const length = millimetres(source.Longitud, 1000, 20000);
  const width = millimetres(source.Anchura, 600, 4000);
  const height = millimetres(source.Altura, 600, 4500);
  if (length === null || width === null || height === null || length < width) return general;

  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} Dimensiones declaradas de la máquina (largo × ancho × alto): ${metres(length)} × ${metres(width)} × ${metres(height)} m.`;
};
