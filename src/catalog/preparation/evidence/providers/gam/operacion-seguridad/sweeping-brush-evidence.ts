import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";

const brushMain = "Anchura del cepillo principal (mm)";
const brushSide = "Anchura del cepillo lateral (mm)";
const sweepingSingle = "Anchura de barrido con un cepillo lateral (mm)";
const sweepingDouble = "Anchura de barrido con dos cepillos laterales (mm)";
const brushMeasure = /\bcepillo\s+(principal|lateral)\s+de\s+(\d{1,2}\.\d{3}|\d{3,4})\s*mm\b/giu;
const sweepingPair = /\bancho\s+de\s+barrido\s+de\s+(\d{3,4})\s*mm\s+con\s+un\s+cepillo\s+lateral\s+y\s+hasta\s+(\d{3,4})\s*mm\s+con\s+cepillos\s+(?:laterales\s+)?dobles\b/giu;
const anySweepingWidth = /\bancho\s+de\s+barrido\s+de\s+\d{3,4}\s*mm\b/giu;
const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const sourceIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "limpieza-barredoras" || normalize(record.brand ?? "") !== "tennant" ||
    normalize(String(record.specs?.["Marca"] ?? "")) !== "tennant" ||
    normalize(String(record.specs?.["Modelo"] ?? "")) !== normalize(record.model ?? "") ||
    !normalize(record.title ?? "").includes(normalize(record.model ?? "")) ||
    !normalize(record.longDescription ?? "").includes("tennant")) return false;
  const model = record.model ?? "";
  const baseModel = model.match(/^(?:BCS\s+(?:S\d+[A-Z]?|\d+)|BF\s+M\d+)/iu)?.[0];
  if (!baseModel || !normalize(record.longDescription ?? "").includes(normalize(baseModel))) return false;
  const sourceShortModel = record.shortDescription?.match(/\b(?:BCS\s+(?:S\d+[A-Z]?|\d+)|BF\s+M\d+)\b/iu)?.[0];
  if (sourceShortModel && normalize(sourceShortModel) !== normalize(baseModel)) return false;
  if (/\bdescarga\s+baja\b/iu.test(model) && !/\bdescarga\s+baja\b/iu.test(record.longDescription ?? "")) return false;
  if (/\bbater[ií]a\b/iu.test(model) && !/\ba\s+bater[ií]a\b/iu.test(record.longDescription ?? "")) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      ["tennant", "barredoras-industriales-nuevas", "fregadoras-industriales-nuevas"].includes(parts[1] ?? "") &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(model));
  } catch {
    return false;
  }
};

const readBrush = (text: string, label: string): number | null => {
  const values = [...text.matchAll(brushMeasure)]
    .filter((match) => match[1]?.toLowerCase() === label)
    .map((match) => Number((match[2] ?? "").replace(".", "")));
  const value = values[0];
  return value !== undefined && Number.isInteger(value) && value >= 300 && value <= 1500 &&
    values.every((candidate) => candidate === value) ? value : null;
};

const readSweepingWidths = (text: string): readonly [number, number] | null => {
  const matches = [...text.matchAll(sweepingPair)];
  if (matches.length === 0 || [...text.matchAll(anySweepingWidth)].length !== matches.length) return null;
  const values = matches.map((match) => [Number(match[1]), Number((match[2] ?? "").replace(".", ""))] as const);
  const first = values[0];
  return first && first[0] >= 500 && first[1] <= 3000 && first[1] > first[0] &&
    values.every(([single, dual]) => single === first[0] && dual === first[1]) ? first : null;
};

export const recoverGamSweepingBrushSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!sourceIdentity(record)) return source;
  const text = record.longDescription ?? "";
  let result: SpecsMap = source;
  const main = readBrush(text, "principal");
  const side = readBrush(text, "lateral");
  if (main !== null && !Object.hasOwn(result, brushMain)) result = { ...result, [brushMain]: main };
  if (side !== null && !Object.hasOwn(result, brushSide)) result = { ...result, [brushSide]: side };
  const widths = readSweepingWidths(text);
  if (widths !== null) {
    if (!Object.hasOwn(result, sweepingSingle)) result = { ...result, [sweepingSingle]: widths[0] };
    if (!Object.hasOwn(result, sweepingDouble)) result = { ...result, [sweepingDouble]: widths[1] };
  }
  return result;
};
