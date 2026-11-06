import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

const towingCapacity = /\bcapacidad\s+de\s+arrastre\s+de\s+(\d{1,3}(?:\.\d{3})+)\s*kg\b/giu;
const towingCapacityTonnes = /\bcapacidad\s+de\s+arrastre\s+de\s+(\d{1,2})\s*toneladas\b/giu;
const nominalDrawbar = /\besfuerzo\s+en\s+(?:la\s+)?barra\s+de\s+tracci[oó]n\s+nominal\s+de\s+(\d{1,3}(?:\.\d{3})+)\s*N\b/giu;

const uniqueMeasure = (text: string, pattern: RegExp, minimum: number, maximum: number): number | null => {
  const values = [...text.matchAll(pattern)].map((match) => Number((match[1] ?? "").replace(/\./g, "")));
  const first = values[0];
  return first !== undefined && Number.isInteger(first) && first >= minimum && first <= maximum &&
    values.every((value) => value === first) ? first : null;
};

export const recoverGamVerifiedTowingSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamSourceVariant(record) || !/\btractor\s+(?:el[eé]ctrico\s+)?de\s+arrastre\b/iu.test(record.title ?? "")) {
    return source;
  }

  const text = record.longDescription ?? "";
  if (record.categoryKey === "manutencion" && record.condition === "Segunda mano" &&
    record.brand === "TECNA" && record.model === "VTA25" &&
    !Object.keys(source).some((key) => /capacidad\s+de\s+arrastre/iu.test(key))) {
    const kilograms = uniqueMeasure(text, towingCapacity, 1000, 50000);
    const tonnes = uniqueMeasure(text, towingCapacityTonnes, 1, 50);
    return kilograms !== null && tonnes !== null && kilograms === tonnes * 1000 ?
      { ...source, "Capacidad de arrastre (kg)": `${kilograms} KG` } : source;
  }

  if (record.categoryKey === "otros-nuevos" && record.condition === "Nuevo" &&
    record.brand === "YALE" && record.model === "MO70T" &&
    source["Tipo motor"] === "Eléctrico" &&
    !Object.keys(source).some((key) => /tiro\s+a\s+la\s+barra|esfuerzo\s+(?:de\s+)?tracci[oó]n/iu.test(key))) {
    const newtons = uniqueMeasure(text, nominalDrawbar, 500, 10000);
    return newtons === null ? source : { ...source, "Tiro a la barra nominal (N)": `${newtons} N` };
  }

  return source;
};
