import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

const identity = (value: string): string => fold(value).replace(/[^a-z0-9]/g, "");

const machineFamily = (value: string): string | null => {
  const text = fold(value);
  const families: readonly [string, RegExp][] = [
    ["carretilla", /\bcarretilla\b/],
    ["transpaleta", /\btranspalet(?:a)?\b/],
    ["apilador", /\bapilador(?:a)?\b/],
    ["plataforma", /\bplataforma\b/],
    ["manipulador", /\bmanipulador\b/],
    ["dumper", /\bdumper\b/],
    ["miniexcavadora", /\bminiexcavadora\b/],
    ["camion", /\bcamion\b/]
  ];
  const matches = families.filter(([, pattern]) => pattern.test(text));
  return matches.length === 1 ? matches[0]?.[0] ?? null : null;
};

export const mercaelevaShortDescription = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.shortDescription?.trim()) return null;
  const general = record.longDescription?.trim();
  if (!general) return null;

  const match = general.match(/^ref\.\s*[\p{L}\d/-]+\s+(.+)$/iu);
  if (!match?.[1]) return null;
  const sellerText = match[1].trim();
  const source = sellerText.split(/\s+(?:horas?\s*:?\s*\d|a[nñ]o\s+de\s+fabricaci[oó]n\b)/i)[0]?.trim();
  if (!source || source.length < 35 || general.length - source.length < 20) return null;

  const titleFamily = machineFamily(record.title ?? "");
  if (!titleFamily || machineFamily(source) !== titleFamily) return null;

  const original = identity(sellerText);
  if (record.model && !original.includes(identity(record.model))) return null;
  if (record.brand && !original.includes(identity(record.brand))) return null;

  const title = fold(record.title ?? "");
  const description = fold(source);
  const titleElectric = /\belectric[oa]s?\b/.test(title);
  const titleDiesel = /\bdiesel\b/.test(title);
  const textElectric = /\belectric[oa]s?\b/.test(description);
  const textDiesel = /\bdiesel\b/.test(description);
  if ((titleElectric && textDiesel) || (titleDiesel && textElectric)) return null;

  const subtype = (value: string): string | null => {
    const types = ["tijera", "articulada", "telescopica", "vertical", "unipersonal"];
    const found = types.filter((type) => new RegExp(`\\b${type}\\b`).test(value));
    return found.length === 1 ? found[0] ?? null : null;
  };
  const titleSubtype = subtype(title);
  const sourceSubtype = subtype(description);
  if (titleSubtype && sourceSubtype && titleSubtype !== sourceSubtype) return null;

  const mastTypes = ["simplex", "duplex", "triplex"];
  if (mastTypes.filter((type) => new RegExp(`\\b${type}\\b`).test(description)).length > 1) return null;

  const titleHeight = title.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:mt|metros?)\b/)?.[1];
  const sourceHeight = description.match(/\baltura\s+(?:de\s+)?(?:trabajo|elevacion)\s*:?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:mt|metros?)\b/)?.[1];
  if (titleHeight && sourceHeight && Number(titleHeight.replace(",", ".")) !== Number(sourceHeight.replace(",", "."))) return null;

  const titleCapacity = title.match(/\b(\d[\d.,]*)\s*kg\b/)?.[1];
  const sourceCapacity = description.match(/\b(?:capacidad(?:\s+de\s+carga)?\s*:?)?\s*(\d[\d.,]*)\s*kg\b/)?.[1];
  if (titleCapacity && sourceCapacity) {
    const kilograms = (value: string): number => Number(value.replace(/\./g, "").replace(",", "."));
    if (kilograms(titleCapacity) !== kilograms(sourceCapacity)) return null;
  }

  return source;
};
