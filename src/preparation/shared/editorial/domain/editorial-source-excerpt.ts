import { containsEditorialBrandModel } from "./editorial-identity-match.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyOf } from "./editorial-families.js";
import { resolveEditorialSource } from "./editorial-source.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

const identity = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

const originalExcerpt = (record: ProductRecord, general: string): string | null => {
  const prefixed = /^ref\.\s*([\p{L}\d/-]+)\s+(.+)$/iu.exec(general);
  if (prefixed?.[1] && prefixed[2]) {
    const article = record.specs?.["Artículo No."];
    if (typeof article === "string" && identity(article) !== identity(prefixed[1])) return null;
    return prefixed[2];
  }
  const structured = /^(marca:\s*([\p{L}\d]+)\s+modelo:\s*([\p{L}\d./_+-]+)\s+tipo:\s*.+?)(?=\s+(?:configuraci[oó]n|categor[ií]a|mma|motor)\s*:|$)/iu.exec(general);
  if (structured?.[1]) {
    return identity(structured[2] ?? "") === identity(record.brand ?? "") &&
      identity(structured[3] ?? "") === identity(record.model ?? "") ? structured[1] : null;
  }
  const state = fold(String(record.specs?.Estado ?? ""));
  if (record.condition !== "Nuevo" || !["nuevo", "nueva"].includes(state)) return null;
  return /^nuev[oa]\s*!{1,3}\s+(.+)$/iu.exec(general)?.[1] ?? null;
};

const subtype = (value: string): string | null => {
  const subtypes: readonly [string, RegExp][] = [
    ["tijera", /\btijera\b|\bscissor lift\b/u],
    ["articulada", /\barticulada\b|\barticulated boom\b/u],
    ["telescopica", /\btelescopica\b/u],
    ["vertical", /\bvertical\b/u],
    ["unipersonal", /\bunipersonal\b/u]
  ];
  const matches = subtypes.filter(([, pattern]) => pattern.test(value));
  return matches.length === 1 ? matches[0]?.[0] ?? null : null;
};

const load = (value: string): number => Number(value.replace(/\./gu, "").replace(",", "."));

export const resolveVerifiedSourceEditorialExcerpt = (record: ProductRecord): string | null => {
  if (record.shortDescription?.trim() || !verifiedEditorialIdentity(record) || !resolveEditorialSource(record) ||
    !record.brand || !record.model || !record.longDescription) return null;
  const excerpt = originalExcerpt(record, record.longDescription.trim());
  const source = excerpt?.split(/\s+(?:horas?|hours?|houras)\s*:?\s*\d|\s+(?:a[nñ]o\s+de\s+fabricaci[oó]n|year\s+of\s+manufacture)\b/iu)[0]?.trim();
  if (!source || source.length < 25 || !containsEditorialBrandModel(source, record.brand, record.model)) return null;
  const family = editorialFamilyOf(record.title ?? "");
  if (!family || editorialFamilyOf(source) !== family) return null;
  const title = fold(record.title ?? "");
  const statement = fold(source);
  const electric = /\belectric[oa]s?\b/iu;
  const diesel = /\bdiesel\b/iu;
  if (electric.test(title) && diesel.test(statement) || diesel.test(title) && electric.test(statement)) return null;
  const titleSubtype = subtype(title);
  const sourceSubtype = subtype(statement);
  if (titleSubtype && sourceSubtype && titleSubtype !== sourceSubtype) return null;
  if (["simplex", "duplex", "triplex"].filter((mast) => new RegExp(`\\b${mast}\\b`, "u").test(statement)).length > 1) return null;
  const titleHeight = /\b(\d{1,2}(?:[.,]\d+)?)\s*(?:mt|metros?)\b/u.exec(title)?.[1];
  const sourceHeight = /\b(?:altura\s+(?:de\s+)?(?:trabajo|elevacion)|working height)\s*:?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:mt|metros?)\b/u.exec(statement)?.[1];
  if (titleHeight && sourceHeight && Number(titleHeight.replace(",", ".")) !== Number(sourceHeight.replace(",", "."))) {
    const declared = record.specs?.["Altura de trabajo"];
    const published = typeof declared === "string" ? /^(\d{1,2}(?:[.,]\d+)?)\s*(?:m|mt|metros?)$/iu.exec(declared.trim())?.[1] : null;
    const titleMetres = Number(titleHeight.replace(",", "."));
    const workingMetres = Number(sourceHeight.replace(",", "."));
    const platformHeight = family === "plataforma-tijera" && titleSubtype === "tijera" && sourceSubtype === "tijera" &&
      electric.test(title) && electric.test(statement) && !/\baltura\s+(?:de\s+)?trabajo\b/u.test(title) &&
      workingMetres - titleMetres === 2 && published && Number(published.replace(",", ".")) === workingMetres;
    if (!platformHeight) return null;
  }
  const titleLoad = /\b(\d[\d.,]*)\s*kg\b/u.exec(title)?.[1];
  const sourceLoad = /\b(?:capacidad(?:\s+de\s+carga)?\s*:?)?\s*(\d[\d.,]*)\s*kg\b/u.exec(statement)?.[1];
  if (titleLoad && sourceLoad && load(titleLoad) !== load(sourceLoad)) return null;
  const declaredCapacity = record.specs?.["Capacidad máxima de elevación"];
  const technicalLoad = typeof declaredCapacity === "string" ? /^(\d[\d.,]*)\s*kg$/iu.exec(declaredCapacity.trim())?.[1] : null;
  if (sourceLoad && technicalLoad && load(sourceLoad) !== load(technicalLoad)) return null;
  const mast = fold(String(record.specs?.["Tipo de mástil"] ?? ""));
  const sourcedMast = ["simplex", "duplex", "triplex"].find((value) =>
    new RegExp(`\\b${value}\\b`, "u").test(statement));
  if (mast && sourcedMast && !mast.includes(sourcedMast) &&
    !(sourcedMast === "triplex" && mast.includes("triple"))) return null;
  const structuredHeight = record.specs?.["Altura de trabajo"];
  const heightValue = typeof structuredHeight === "string" ?
    /^(\d{1,2}(?:[.,]\d+)?)\s*(?:m|mt|metros?)$/iu.exec(structuredHeight.trim())?.[1] : null;
  if (sourceHeight && heightValue &&
    Number(sourceHeight.replace(",", ".")) !== Number(heightValue.replace(",", "."))) return null;
  return source;
};
