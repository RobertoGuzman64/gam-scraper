import type { ProductRecord } from "../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../classification/attribute-types.js";
import { parseDimension, parseMeasuredLength } from "../../../catalog/normalization/spec-parsers.js";
import { SPEC_KEY_NORMALIZATION } from "../../../catalog/normalization/spec-rules.js";
import { isGamUnitUrl } from "../../../catalog/normalization/gam/unit-url.js";
import { fold, numberToken } from "../../classification/attribute-utils.js";

export const relevantGamHandlingRecord = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["manutencion", "carretillas-nuevas", "apiladores-nuevos", "marcas-nuevas"].includes(record.categoryKey)) return false;
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com" || url.pathname.split("/").filter(Boolean)[0] !== "es") return false;
  } catch {
    return false;
  }
  return /\b(?:carretillas?|apilador(?:es)?|apiladoras?|transpaletas?|recogepedidos|preparapedidos)\b/.test(fold(record.title ?? ""));
};

const descriptionParts = (record: ProductRecord): readonly string[] =>
  [record.shortDescription, record.longDescription].filter((value): value is string => Boolean(value?.trim()));

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const gamHandlingModelEvidence = (record: ProductRecord, text: string): boolean => {
  const identified = record.model?.trim() || identityFromTitle(record)?.model;
  if (!identified) return false;
  const model = fold(identified);
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(model)}(?![a-z0-9])`);
  return pattern.test(fold(text));
};

const confirmedDescriptions = (record: ProductRecord): readonly string[] =>
  descriptionParts(record).filter((part) => gamHandlingModelEvidence(record, part));

const mastNames: Readonly<Record<string, string>> = {
  "simple": "Simple",
  "duplex": "Dúplex",
  "triplex": "Tríplex",
  "cuadruplex": "Cuádruplex"
};

export const normalizeGamMast = (value: string | number | boolean | null): string | null => {
  if (typeof value !== "string") return null;
  return mastNames[fold(value)] ?? null;
};

const mastFromDescription = (record: ProductRecord): string | null => {
  const text = fold(confirmedDescriptions(record).join(" "));
  if (/\b(?:opciones?|versiones?|configuraciones?|disponibles?|gama)\b.{0,95}\bmastiles?\b|\bmastiles?\b.{0,100}\b(?:opciones?|versiones?|configuraciones?|disponibles?|gama|hasta|puede)\b/.test(text)) return null;
  const types = [...text.matchAll(/\b(?:simple|duplex|triplex|cuadruplex)\b/g)].map((match) => mastNames[match[0]]);
  const attached = [...text.matchAll(/\b(?:monta|incorpora|equipad[oa]\s+con|con)\s+(?:un\s+)?mastil\s+(simple|duplex|triplex|cuadruplex)\b/g)]
    .map((match) => mastNames[match[1] ?? ""]);
  const stages: Readonly<Record<string, string>> = { "1": "Simple", "2": "Dúplex", "3": "Tríplex", "4": "Cuádruplex" };
  const attachedStages = [...text.matchAll(/\b(?:monta|incorpora|equipad[oa]\s+con|con)\s+(?:un\s+)?mastil\s+de\s+([1-4])\s+etapas?\b/g)]
    .map((match) => stages[match[1] ?? ""]);
  const selected = [...attached, ...attachedStages].filter((value): value is string => Boolean(value));
  if (selected.length === 0 || new Set([...types, ...selected]).size !== 1) return null;
  return selected[0] ?? null;
};

const hasAdjacentAlternative = (text: string, end: number): boolean =>
  /^(?:\s*[/,-]\s*|\s+(?:o|u|y|a|hasta)\s+)\d[\d.,]*(?:\s*(?:mm|cm|metros?|m|kg|kilogramos?|toneladas?|t))?\b/.test(text.slice(end, end + 45));

const liftHeight = (record: ProductRecord): number | null => {
  const parts = confirmedDescriptions(record);
  if (parts.length === 0) return null;
  const values = new Set<number>();
  for (const part of parts) {
    const text = fold(part);
    for (const match of text.matchAll(/\b(?:altura\s+(?:maxima\s+)?de\s+elevacion|una\s+elevacion)\s+(?:de\s+)?(hasta\s+)?(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g)) {
      const preceding = text.slice(Math.max(0, (match.index ?? 0) - 18), match.index ?? 0);
      if (match[1] || /\b(?:hasta|desde|entre)\s*$/.test(preceding) || hasAdjacentAlternative(text, (match.index ?? 0) + match[0].length)) return null;
      const numeric = match[2];
      const unit = match[3];
      if (!numeric || !unit) return null;
      const height = parseMeasuredLength(`${numeric} ${unit}`, "", "mm");
      if (height === null || height < 100 || height > 16000) return null;
      values.add(height);
    }
  }
  return values.size === 1 ? [...values][0] ?? null : null;
};

const loadCapacity = (record: ProductRecord): number | null => {
  const parts = confirmedDescriptions(record);
  if (parts.length === 0) return null;
  const values = new Set<number>();
  for (const part of parts) {
    const text = fold(part);
    for (const match of text.matchAll(/\bcapacidad\s+(?:nominal\s+)?de\s+carga\s+(?:de\s+)?(hasta\s+)?(\d[\d.,]*)\s*(kg|kilogramos?|toneladas?|t)\b/g)) {
      if (match[1]) continue;
      if (hasAdjacentAlternative(text, (match.index ?? 0) + match[0].length)) return null;
      const numeric = match[2];
      const unit = match[3];
      if (!numeric || !unit) return null;
      const parsed = numberToken(numeric);
      if (parsed === null) return null;
      const capacity = parsed * (unit === "t" || unit.startsWith("tonelada") ? 1000 : 1);
      if (capacity < 50 || capacity > 100000) return null;
      values.add(capacity);
    }
  }
  return values.size === 1 ? [...values][0] ?? null : null;
};

const identityFromTitle = (record: ProductRecord): { readonly brand: string; readonly model: string } | null => {
  if (!record.title) return null;
  const suffix = /\b([a-z]{3,})\s+([a-z0-9.-]*\d[a-z0-9.-]*)\s*$/i.exec(record.title);
  const brand = suffix?.[1];
  const model = suffix?.[2];
  if (!brand || !model || !/[a-z]/i.test(model)) return null;
  const evidence = new RegExp(`\\b${escapeRegExp(brand)}\\s+${escapeRegExp(model)}\\b`, "i");
  return descriptionParts(record).some((part) => evidence.test(part)) ? { brand: brand.toUpperCase(), model } : null;
};

const brandFromTitle = (record: ProductRecord): string | null => {
  if (!record.model) return record.brand ? null : identityFromTitle(record)?.brand ?? null;
  if (!record.title) return null;
  const suffix = new RegExp(`\\b([a-z][a-z0-9-]{2,})\\s+${escapeRegExp(record.model)}\\s*$`, "i").exec(record.title);
  const brand = suffix?.[1];
  if (!brand) return null;
  const evidence = new RegExp(`\\b${escapeRegExp(brand)}\\s+${escapeRegExp(record.model)}\\b`, "i");
  return descriptionParts(record).some((part) => evidence.test(part)) ? brand.toUpperCase() : null;
};

const modelFromTitle = (record: ProductRecord): string | null => {
  if (!record.brand) return record.model ? null : identityFromTitle(record)?.model ?? null;
  if (!record.title) return null;
  const suffix = new RegExp(`\\b${escapeRegExp(record.brand)}\\s+([a-z0-9][a-z0-9.-]+)\\s*$`, "i").exec(record.title);
  const model = suffix?.[1];
  if (!model || !/[a-z]/i.test(model) || !/\d/.test(model)) return null;
  const evidence = new RegExp(`\\b${escapeRegExp(record.brand)}\\s+${escapeRegExp(model)}\\b`, "i");
  return descriptionParts(record).some((part) => evidence.test(part)) ? model : null;
};

const electricEnergy = (record: ProductRecord): string | null => {
  const title = fold(record.title ?? "");
  const motorSpecs = [record.specs?.["Motorización"], record.specs?.["Tipo motor"]]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .map(fold);
  if (/\belectric[oa]\b/.test(title)) {
    if (/\b(?:diesel|glp|gasolina|hibrid[oa]|manual)\b/.test(title)) return null;
    return motorSpecs.length > 0 && motorSpecs.every((value) => value === "electrico") ? "Eléctrico" : null;
  }
  if (motorSpecs.length === 0 || motorSpecs.some((value) => value !== "electrico")) return null;
  const sourceText = fold(`${title} ${record.shortDescription ?? ""} ${record.longDescription ?? ""}`);
  if (/\b(?:diesel|glp|gasolina|hibrid[oa]|manual)\b/.test(sourceText)) return null;
  if (record.categoryKey !== "carretillas-nuevas" || fold(record.brand ?? "") !== "yale" ||
    fold(String(record.specs?.["Motorización"] ?? "")) !== "electrico" ||
    record.specs?.["Tipo motor"] !== undefined ||
    !/\bcarretilla trilateral\b/.test(title) ||
    !gamHandlingModelEvidence(record, title) || confirmedDescriptions(record).length === 0) return null;
  const url = new URL(record.url);
  return url.pathname.split("/").filter(Boolean)[1] === "carretillas-trilaterales-yale" ? "Eléctrico" : null;
};

const declaredForkLength = (record: ProductRecord): number | null => {
  const specs = record.specs ?? {};
  if (["Largo horquillas", "Ancho horquillas", "Anchura de horquillas", "Grosor horquillas", "Grosor de horquillas"]
    .some((key) => specs[key] !== undefined)) return null;
  const matching = Object.entries(specs).filter(([key]) =>
    SPEC_KEY_NORMALIZATION[fold(key)] === "Dimensiones horquillas (mm)");
  const raw = matching.length === 1 ? matching[0]?.[1] : undefined;
  if (typeof raw !== "string" || !/^\d{3,4}(?:\s*[x×]\s*\d{2,3}\s*[x×]\s*\d{2,3})?\s*mm$/iu.test(raw.trim())) return null;
  const dimensions = parseDimension(raw);
  if (!dimensions || dimensions.largo === null || dimensions.largo < 400 || dimensions.largo > 4000) return null;
  if (dimensions.ancho === null && dimensions.grosor === null) return dimensions.largo;
  if (dimensions.ancho === null || dimensions.grosor === null || dimensions.ancho < 50 || dimensions.ancho > 400 ||
    dimensions.grosor < 10 || dimensions.grosor > 150 || dimensions.grosor > dimensions.ancho) return null;
  return dimensions.largo;
};

const declaredSideShift = (record: ProductRecord, attribute: Attribute): string | null => {
  if (record.condition !== "Segunda mano" || record.categoryKey !== "manutencion" || !isGamUnitUrl(record) ||
    !/\bcarretilla\b/u.test(fold(record.title ?? "")) || !attribute.unit_option.split(/\s+\/\s+/u).includes("Desplazador lateral")) return null;
  const specs = record.specs ?? {};
  const declared = Object.entries(specs).filter(([key]) => fold(key) === "desplazador lateral");
  if (declared.length !== 1 || typeof declared[0]?.[1] !== "string" || fold(declared[0][1]) !== "si" ||
    Object.keys(specs).some((key) => /\b(?:pinza|posicionador|desplazamiento lateral)\b/u.test(fold(key))) ||
    /\b(?:pinza|posicionador|sin desplazador|sin desplazamiento lateral|no dispone de desplazador)\b/u.test(fold(`${record.title ?? ""} ${record.shortDescription ?? ""} ${record.longDescription ?? ""}`))) return null;
  return "Desplazador lateral";
};

export const gamHandlingCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (!relevantGamHandlingRecord(record)) return null;
  let value: string | number | null = null;
  if (attribute.name === "Implementos incluidos" && attribute.type === "SELECT") value = declaredSideShift(record, attribute);
  if (attribute.name === "Longitud de horquillas" && attribute.type === "NUMBER" && attribute.unit_option === "mm") value = declaredForkLength(record);
  if (attribute.name === "Tipo de mástil" && attribute.type === "SELECT") value = mastFromDescription(record);
  if (attribute.name === "Altura de elevación" && attribute.type === "NUMBER" && attribute.unit_option === "mm") value = liftHeight(record);
  if (attribute.name === "Capacidad de carga" && attribute.type === "NUMBER" && attribute.unit_option === "kg") value = loadCapacity(record);
  if (attribute.name === "Marca" && attribute.type === "TEXT") value = brandFromTitle(record);
  if (attribute.name === "Modelo" && attribute.type === "TEXT") value = modelFromTitle(record);
  if (attribute.name === "Motorización / Energía" && attribute.type === "SELECT" && fold(attribute.unit_option) === "electrico") value = electricEnergy(record);
  return value === null ? null : { key: attribute.name, value };
};
