import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "../measurements/measured-machine-specs.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

const cleaningCategories = new Set(["limpieza-fregadoras", "limpieza-barredoras"]);
const vacuumCategory = "marcas-nuevas";
const soundLevel = /\bnivel\s+(?:de\s+ruido|sonoro|ac[uú]stico|de\s+sonido)\b[^.!?;\n]{0,90}?\b(\d{2,3}(?:[.,]\d{1,2})?)\s*(dB(?:\s*\(\s*A\s*\)|A)?)(?![a-z])/giu;
const bareVacuumSound = /\bcon\s+tan\s+solo\s+(\d{2,3}(?:[.,]\d{1,2})?)\s*(dBA)\b/giu;
const anySoundMeasure = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*dB(?:\s*\(\s*A\s*\)|A)?(?![a-z])/giu;
const existingSound = /\b(?:sonor[oa]|sonido|ruido|ac[uú]stic[oa])\b/iu;
const conditionalMode = /\b(?:modo\s+(?:eco|quiet)|quiet[- ]mode|versi[oó]n)\b/iu;

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const hasOwnIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !(cleaningCategories.has(record.categoryKey) ||
    (record.categoryKey === vacuumCategory && /\baspiradora\b/iu.test(record.title ?? ""))) ||
    !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalize(brand) !== normalize(record.specs["Marca"]) ||
    !normalize(record.title ?? "").includes(normalize(brand)) ||
    !normalize(record.longDescription ?? "").includes(normalize(brand))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      (record.categoryKey !== vacuumCategory ||
        ["tennant", "aspiradoras-industriales-nuevas"].includes(parts[1] ?? "")) &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

const acousticValue = (description: string, vacuum: boolean): string | null => {
  const matches = [...description.matchAll(soundLevel)];
  if (vacuum && matches.length === 0 && /\bnivel\s+de\s+ruido\b/iu.test(description)) {
    const bare = [...description.matchAll(bareVacuumSound)];
    if (bare.length === 1 && bare[0]) matches.push(bare[0]);
  }
  if (matches.length === 0) return null;
  const measures = [...description.matchAll(anySoundMeasure)];
  if (measures.length !== matches.length) return null;
  const values = matches.map((match) => {
    const literal = match[1];
    const unit = match[2];
    if (!literal || !unit) return null;
    const numeric = Number(literal.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 40 || numeric > 100) return null;
    const before = description.slice(Math.max(0, (match.index ?? 0) - 80), match.index);
    const after = description.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 40);
    if (conditionalMode.test(before) || conditionalMode.test(after)) return null;
    return `${literal} ${/^dB\s*\(\s*A\s*\)$/iu.test(unit) ? "dB(A)" : /^dBA$/iu.test(unit) ? "dBA" : "dB"}`;
  });
  const first = values[0];
  return first && values.every((value) => value === first) ? first : null;
};

export const recoverGamAcousticSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!hasOwnIdentity(record) || Object.keys(source).some((key) => existingSound.test(key))) return source;
  const value = acousticValue(record.longDescription ?? "", record.categoryKey === vacuumCategory);
  return value === null ? source : { ...source, "Nivel sonoro": value };
};

const handlingCategories = new Set(["carretillas-nuevas", "apiladores-nuevos", "marcas-nuevas"]);
const handlingSound = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*(dB(?:\s*\(\s*A\s*\)|A)?)(?![a-z])/giu;
const handlingSoundContext = /\b(?:nivel\s+(?:sonoro|ac[uú]stico|de\s+(?:ruido|presi[oó]n\s+sonora))|silencios[ao]|produce\s+solo)\b/iu;
const handlingSoundMode = /\b(?:modo\s+(?:eco|quiet)|quiet[- ]mode|versi[oó]n\s+(?:de\s+)?(?:disco|cil[ií]ndric[oa]|di[eé]sel|glp|lpg))\b/iu;
const handlingSoundLimit = /\b(?:inferior|menor)\s+a\s*$/iu;

const handlingAcousticValue = (description: string): string | null => {
  const measurements = [...description.matchAll(handlingSound)];
  if (measurements.length !== 1) return null;
  const measure = measurements[0];
  if (!measure || !measure[1] || !measure[2]) return null;
  const value = Number(measure[1].replace(",", "."));
  if (!Number.isFinite(value) || value < 40 || value > 100) return null;
  const previous = description.slice(Math.max(0, measure.index - 170), measure.index);
  const following = description.slice(measure.index + measure[0].length);
  const sentenceStart = Math.max(previous.lastIndexOf("."), previous.lastIndexOf("!"));
  const sentence = previous.slice(sentenceStart + 1);
  const sentenceEnd = following.search(/[.!?]/u);
  const tail = sentenceEnd === -1 ? following : following.slice(0, sentenceEnd);
  if (!handlingSoundContext.test(previous) || handlingSoundMode.test(sentence + tail)) return null;
  const limit = /\b(?:inferior|menor)\s+a\s*$/iu.test(sentence);
  const qualifier = /\b(?:inferior|menor)\s+a\s*$/iu.test(previous.slice(-45));
  if (limit !== qualifier || (limit && !handlingSoundLimit.test(sentence))) return null;
  const unit = /^dB\s*\(\s*A\s*\)$/iu.test(measure[2]) ? "dB(A)" :
    /^dBA$/iu.test(measure[2]) ? "dBA" : "dB";
  return `${limit ? "< " : ""}${measure[1]} ${unit}`;
};

const exactHandlingModelPath = (record: ProductRecord): boolean => {
  try {
    const parts = new URL(record.url).pathname.split("/").filter(Boolean);
    return normalize(parts[2] ?? "").endsWith(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

export const recoverGamHandlingAcousticSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.condition !== "Nuevo" || !handlingCategories.has(record.categoryKey) ||
    normalize(record.brand ?? "") !== "hyster" || !verifiedGamSourceVariant(record) ||
    !exactHandlingModelPath(record) ||
    (record.categoryKey === "marcas-nuevas" && !/\bapilador(?:a)?\b/iu.test(record.title ?? "")) ||
    Object.keys(source).some((key) => existingSound.test(key))) return source;
  const value = handlingAcousticValue(record.longDescription ?? "");
  return value === null ? source : { ...source, "Nivel sonoro": value };
};
