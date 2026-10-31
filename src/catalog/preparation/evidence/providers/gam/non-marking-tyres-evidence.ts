import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const nonMarkingTyres = /\b(?:ruedas|neum[aá]ticos)\s+(?:(?:maciz[oa]s?|s[oó]lid[oa]s?)\s+)?(?:no\s+marcantes?|anti[- ]?huellas?)\b/iu;
const existingTyres = /\b(?:neum[aá]ticos?|ruedas?|rodadura)\b/iu;
const conflictingTyres = /\b(?:ruedas|neum[aá]ticos)\s+(?:(?:maciz[oa]s?|s[oó]lid[oa]s?)\s+)?marcantes?\b/iu;
const deniedNonMarking = /\b(?:sin|no\s+(?:incluye|lleva|monta|tiene|incorpora|utiliza|dispone\s+de))\s+(?:ruedas|neum[aá]ticos)\s+(?:(?:maciz[oa]s?|s[oó]lid[oa]s?)\s+)?(?:no\s+marcantes?|anti[- ]?huellas?)\b/iu;
const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const identifiedXcmgVariant = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "elevacion-nueva" || record.brand !== "XCMG" ||
    record.specs?.["Marca"] !== "XCMG" || !identifiedGamMachineModel(record) ||
    /\borugas?\b/iu.test(`${record.title ?? ""} ${record.shortDescription ?? ""}`)) return false;
  const model = normalize(record.model ?? "");
  if (!model || ![record.title, record.shortDescription, record.longDescription]
    .every((text) => normalize(text ?? "").includes(model))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(model);
  } catch {
    return false;
  }
};

export const recoverGamNonMarkingTyresSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const description = record.longDescription ?? "";
  if (!identifiedXcmgVariant(record) || Object.keys(source).some((key) => existingTyres.test(key)) ||
    !nonMarkingTyres.test(description) || conflictingTyres.test(description) || deniedNonMarking.test(description)) return source;
  return { ...source, "Neumáticos": "No marcantes" };
};


const forkliftTyres = /\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?(superel[aá]stic[oa]s?|maciz[oa]s?)\b/giu;
const alternativeForkliftTyres = /\b(?:superel[aá]stic[oa]s?|maciz[oa]s?)\s*(?:\/|o|y)\s*(?:superel[aá]stic[oa]s?|maciz[oa]s?)\b/iu;
const optionalForkliftTyres = /\b(?:opcional(?:es)?|alternativ(?:a|o)s?|no\s+(?:incluye|dispone\s+de|monta|utiliza|lleva)|sin)\s+(?:\w+\s+){0,5}(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?(?:superel[aá]stic[oa]s?|maciz[oa]s?)\b|\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?(?:superel[aá]stic[oa]s?|maciz[oa]s?)\s+(?:opcionales?|alternativ[oa]s?)\b/iu;

const identifiedHysterElectricForklift = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "carretillas-nuevas" || record.brand !== "HYSTER" ||
    record.specs?.["Marca"] !== "HYSTER" || !identifiedGamMachineModel(record)) return false;
  const model = normalize(record.model ?? "");
  if (!model || ![record.title, record.longDescription].every((text) =>
    normalize(text ?? "").includes(model) && normalize(text ?? "").includes("hyster"))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      parts[1] === "carretillas-elevadoras-electricas-hyster" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(model);
  } catch {
    return false;
  }
};

export const recoverGamHysterForkliftTyresSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const description = record.longDescription ?? "";
  if (!identifiedHysterElectricForklift(record) ||
    Object.keys(source).some((key) => existingTyres.test(key)) ||
    alternativeForkliftTyres.test(description) || optionalForkliftTyres.test(description)) return source;
  const matches = [...description.matchAll(forkliftTyres)].map((match) =>
    normalize(match[1] ?? "").startsWith("superelast") ? "Superelásticos" : "Macizos");
  const first = matches[0];
  if (!first || matches.some((value) => value !== first)) return source;
  return { ...source, "Neumáticos": first };
};
