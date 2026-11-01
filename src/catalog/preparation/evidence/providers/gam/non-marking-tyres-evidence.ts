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
    record.specs?.["Marca"] !== "XCMG" ||
    /\borugas?\b/iu.test(`${record.title ?? ""} ${record.shortDescription ?? ""}`)) return false;
  const model = normalize(record.model ?? "");
  const identifiedLithium = typeof record.model === "string" && /^XG\d{4}AC-LI$/iu.test(record.model) &&
    record.specs?.["Modelo"] === record.model &&
    /bater[ií]a de litio/iu.test(record.title ?? "") &&
    new RegExp(`(?:^|[^a-z0-9])${record.model}(?![a-z0-9])`, "iu")
      .test(record.shortDescription ?? "") &&
    [record.title, record.longDescription].every((text) =>
      normalize(text ?? "").includes(normalize(record.model?.slice(0, -3) ?? "")));
  if (!model || !(identifiedGamMachineModel(record) &&
    [record.title, record.shortDescription, record.longDescription]
      .every((text) => normalize(text ?? "").includes(model))) && !identifiedLithium) return false;
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

const yaleSuperelasticTyres = /\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?superel[aá]stic[oa]s?\b/giu;
const alternativeYaleTyres = /\b(?:alternativas?|opciones?|configuraciones|a\s+elegir\s+entre)\b[^.!?]{0,110}\b(?:ruedas|neum[aá]ticos)\b|\b(?:ruedas|neum[aá]ticos)\b[^.!?]{0,100}\b(?:alternativas?|opciones?|configuraciones|opcionales?)\b/iu;
const otherYaleTyres = /\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?(?:industriales?|radiales?|maciz[oa]s?|de\s+poliuretano|sin\s+huella|no\s+marcantes?)\b/iu;
const deniedYaleTyres = /\b(?:sin|no\s+(?:incluye|lleva|monta|utiliza|incorpora|dispone\s+de))\s+(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?superel[aá]stic[oa]s?\b/iu;

export const recoverGamYaleSuperelasticTyresSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || record.categoryKey !== "carretillas-nuevas" ||
    record.brand !== "YALE" || record.specs?.["Marca"] !== "YALE" ||
    Object.keys(source).some((key) => existingTyres.test(key)) ||
    !identifiedGamMachineModel(record)) return source;
  const model = normalize(record.model ?? "");
  if (!model || ![record.title, record.shortDescription, record.longDescription].every((part) =>
    normalize(part ?? "").includes(model)) || ![record.title, record.longDescription].every((part) =>
    normalize(part ?? "").includes("yale")) ||
    !/carretilla\s+elevadora\s+el[eé]ctrica\b/iu.test(record.title ?? "")) return source;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || url.search || url.hash || parts.length !== 3 ||
      parts[0] !== "es" || !["yale", "carretillas-elevadoras-electricas-yale"].includes(parts[1] ?? "") ||
      !parts[2]?.startsWith(`${record.reference}-`) || !normalize(parts[2]).includes(model)) return source;
  } catch {
    return source;
  }
  const description = record.longDescription ?? "";
  const matches = [...description.matchAll(yaleSuperelasticTyres)];
  if (matches.length !== 1 || alternativeYaleTyres.test(description) || otherYaleTyres.test(description) ||
    deniedYaleTyres.test(description)) return source;
  return { ...source, "Neumáticos": "Superelásticos" };
};


const declaredSuperelasticTyres = /\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?superel[aá]stic[oa]s?\b/giu;
const alternativeSuperelasticTyres = /\b(?:ruedas|neum[aá]ticos)\b[^.!?]{0,110}\b(?:opcionales?|alternativas?|a elegir|radiales?|neum[aá]tic[oa]s?\s+industriales?)\b|\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?superel[aá]stic[oa]s?\s+o\b/iu;
const conflictingWheelTypes = /\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?(?:maciz[oa]s?|radiales?|industriales?|no\s+marcantes?)\b/iu;

const identifiedSuperelasticForklift = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "carretillas-nuevas" || !record.model ||
    record.specs?.["Modelo"] !== record.model ||
    !["YALE", "HYSTER"].includes(record.brand ?? "") ||
    record.specs?.["Marca"] !== record.brand) return false;
  const model = record.model;
  const suffix = model.match(/^([A-Z]{3}\d{2}[A-Z]{2})\s+\((?:MWB|LWB)\)$/u);
  const coreModel = suffix?.[1] ?? model;
  if (!coreModel || ![record.title, record.shortDescription, record.longDescription].every((part) =>
    normalize(part ?? "").includes(normalize(coreModel))) ||
    ![record.title, record.longDescription].every((part) =>
      normalize(part ?? "").includes(normalize(record.brand ?? "")))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || url.search || url.hash ||
      parts.length !== 3 || parts[0] !== "es" ||
      !parts[2]?.startsWith(`${record.reference}-`) ||
      !normalize(parts[2]).includes(normalize(coreModel))) return false;
    if (record.brand === "YALE") return suffix !== null &&
      parts[1] === "carretillas-elevadoras-electricas-yale" &&
      /carretilla\s+elevadora\s+el[eé]ctrica/iu.test(record.title ?? "");
    if (!identifiedGamMachineModel(record)) return false;
    if (parts[1] === "hyster") return /carretilla\s+retr[aá]ctil/iu.test(record.title ?? "");
    return parts[1] === "carretillas-elevadoras-diesel-hyster" &&
      /carretilla\s+elevadora\s+di[eé]sel/iu.test(record.title ?? "") &&
      record.specs?.["Motorización"] === "Diésel" &&
      !/\b(?:esta\s+carretilla\s+GLP|configurad[oa]\s+para\s+trabajar\s+con\s+GLP)\b/iu
        .test(record.longDescription ?? "");
  } catch {
    return false;
  }
};

export const recoverGamVerifiedSuperelasticTyresSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!identifiedSuperelasticForklift(record) ||
    Object.keys(source).some((key) => existingTyres.test(key))) return source;
  const description = record.longDescription ?? "";
  if ([...description.matchAll(declaredSuperelasticTyres)].length === 0 ||
    alternativeSuperelasticTyres.test(description) || conflictingWheelTypes.test(description) ||
    deniedYaleTyres.test(description)) return source;
  return { ...source, "Neumáticos": "Superelásticos" };
};

const materialTyres = [
  { pattern: /\b(?:ruedas|neum[aá]ticos)\s+(?:de\s+)?superel[aá]stic[oa]s?\b|\bneum[aá]ticos\s*:\s*superel[aá]stic[oa]s?\b/iu, value: "Superelásticos" },
  { pattern: /\bneum[aá]ticos\s+radiales\b/iu, value: "Radiales" },
  { pattern: /\b(?:ruedas\s+(?:de\s+)?bandajes?\s+macizos?|bandajes?\s+macizos?)\b/iu, value: "Bandaje macizo" },
  { pattern: /\bruedas\s+(?:de\s+tracci[oó]n\s+Topthane\s*\/\s*|de\s+)?poliuretano\b|\bruedas\s+de\s+poliuretano\b/iu, value: "Poliuretano" }
] as const;

const materialOptions = /\b(?:opciones?|alternativas?|configuraciones?|versiones?|puede\s+(?:elegir|configurarse|equiparse)|disponibles?|a\s+elegir)\b[^.!?]{0,100}\b(?:ruedas|neum[aá]ticos|bandajes?)\b|\b(?:ruedas|neum[aá]ticos|bandajes?)\b[^.!?]{0,100}\b(?:opciones?|alternativas?|configuraciones?|versiones?|opcionales?|a\s+elegir)\b/iu;
const materialNegation = /\b(?:no\s+(?:incorpora|monta|lleva|utiliza|incluye)|sin)\s+(?:ruedas|neum[aá]ticos|bandajes?)\b/iu;

const verifiedMaterialIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !["carretillas-nuevas", "apiladores-nuevos", "marcas-nuevas"].includes(record.categoryKey) ||
    record.brand !== "HYSTER" || record.specs?.["Marca"] !== record.brand ||
    !identifiedGamMachineModel(record)) return false;
  const model = normalize(record.model ?? "");
  const title = record.title ?? "";
  const short = record.shortDescription ?? "";
  if ((/\bGLP\b/iu.test(title) && /\bdi[eé]sel\b/iu.test(short)) ||
    (/\bdi[eé]sel\b/iu.test(title) && /configurad[oa]\s+para\s+trabajar\s+con\s+GLP/iu.test(record.longDescription ?? ""))) return false;
  if (!model || ![record.title, record.shortDescription, record.longDescription].every((part) =>
    normalize(part ?? "").includes(model)) ||
    ![record.title, record.longDescription].every((part) =>
      normalize(part ?? "").includes("hyster"))) return false;
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

export const recoverGamVerifiedTyreMaterialsSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedMaterialIdentity(record) || Object.keys(source).some((key) => existingTyres.test(key))) return source;
  const text = record.longDescription ?? "";
  if (materialOptions.test(text) || materialNegation.test(text)) return source;
  const matches = materialTyres.filter(({ pattern }) => pattern.test(text));
  const single = matches[0];
  if (!single || matches.length !== 1) return source;
  return { ...source, Neumáticos: single.value };
};
