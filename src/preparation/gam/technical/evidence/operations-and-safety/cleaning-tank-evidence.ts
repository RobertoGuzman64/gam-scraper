import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "../measurements-and-capacities/measured-machine-specs.js";

const volume = "(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(?:litros?|l)\\b";
const qualifier = "(?:\\s+de\\s+la\\s+[\\p{L}\\p{N}\\s-]{4,60}?)?";
const measure = "(?:es\\s+de|tiene\\s+(?:una\\s+)?capacidad\\s+de|de(?:\\s+hasta)?)";
const solution = new RegExp(`\\b(?:dep[oó]sito|sistema)\\s+de\\s+soluci[oó]n${qualifier}\\s+${measure}\\s+${volume}`, "giu");
const recovery = new RegExp(`\\bdep[oó]sito\\s+de\\s+recuperaci[oó]n\\s+${measure}\\s+${volume}`, "giu");
const paired = new RegExp(`\\bdep[oó]sitos?\\s+de\\s+soluci[oó]n\\s+y\\s+recuperaci[oó]n\\s+de\\s+${volume}`, "giu");
const keySolution = "Depósito de solución";
const keyRecovery = "Depósito de recuperación";

type VolumeEvidence = number | "conflict" | null;

const measuredVolume = (text: string, pattern: RegExp): VolumeEvidence => {
  const values = [...text.matchAll(pattern)].map((match) => Number((match[1] ?? "").replace(",", ".")));
  const first = values[0];
  if (first === undefined) return null;
  return Number.isFinite(first) && first >= 5 && first <= 1000 &&
    values.every((value) => value === first) ? first : "conflict";
};

const verifiedResidualCleaningIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !["limpieza-fregadoras", "limpieza-barredoras"].includes(record.categoryKey)) return false;
  const model = record.reference === "4018" && record.model === "T20" &&
    record.brand?.toLowerCase() === "tennant" && record.specs?.["Marca"] === "Tennant" ? "FCS T20 C" :
    record.reference === "4021" && record.model === "BF M20" && !record.brand &&
      record.specs?.["Modelo"] === "BF M20" ? "BF M20" : null;
  if (model === null || ![record.title, record.shortDescription, record.longDescription].every((text) =>
    typeof text === "string" && text.toLowerCase().includes(model.toLowerCase()) && /tennant/iu.test(text))) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    const slug = model.toLowerCase().replace(/\s+/g, "-");
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash && path.length === 3 &&
      path[0] === "es" && path[2]?.startsWith(`${record.reference}-`) === true &&
      path[2]?.endsWith(slug) === true;
  } catch {
    return false;
  }
};

const matchesSourceIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !["limpieza-fregadoras", "limpieza-barredoras"].includes(record.categoryKey) ||
    record.condition !== "Nuevo" || !identifiedGamMachineModel(record) ||
    !/^(?:BF|FCA|FCS)\s/iu.test(record.model ?? "") ||
    record.brand?.trim().toLowerCase() !== "tennant" ||
    String(record.specs?.["Marca"] ?? "").trim().toLowerCase() !== "tennant" ||
    !/\btennant\b/iu.test(record.title ?? "") ||
    !record.shortDescription?.toLowerCase().includes(record.model?.toLowerCase() ?? "\0")) return false;

  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const model = record.model?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const slug = parts[2]?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" &&
      parts[2]?.split("-")[0] === record.reference &&
      ["tennant", "fregadoras-industriales-nuevas"].includes(parts[1] ?? "") &&
      Boolean(model && slug?.includes(model));
  } catch {
    return false;
  }
};

export const recoverGamCleaningTankSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!(matchesSourceIdentity(record) || verifiedResidualCleaningIdentity(record)) ||
    Object.keys(source).some((key) => /dep[oó]sito\s+(?:de\s+)?(?:soluci[oó]n|recuperaci[oó]n)/iu.test(key))) return source;

  const text = record.longDescription ?? "";
  const common = measuredVolume(text, paired);
  const solutionValue = measuredVolume(text, solution);
  const recoveryValue = measuredVolume(text, recovery);
  if (common === "conflict" || solutionValue === "conflict" || recoveryValue === "conflict") return source;
  const solutionVolume = solutionValue ?? common;
  const recoveryVolume = recoveryValue ?? common;
  if ((solutionValue !== null && common !== null && solutionValue !== common) ||
    (recoveryValue !== null && common !== null && recoveryValue !== common)) return source;
  if (solutionVolume === null && recoveryVolume === null) return source;

  return {
    ...source,
    ...(solutionVolume === null ? {} : { [keySolution]: solutionVolume }),
    ...(recoveryVolume === null ? {} : { [keyRecovery]: recoveryVolume })
  };
};

const additionalHopperPatterns = [
  /\bcapacidad\s+de\s+la\s+tolva\s*\([^)]{1,30}\)\s+es\s+de\s+(\d{2,4})\s*(?:litros?|l)\b/giu,
  /\b(?:su|la)\s+tolva\s+de\s+(\d{2,4})\s*litros?\b/giu,
  /\btolva\s+de\s+residuos\s*,?\s+con\s+una\s+capacidad\s+de\s+(\d{2,4})\s*litros?\b/giu,
  /\btolva\s+de\s+residuos\s+de\s+(\d{2,4})\s*litros?\b/giu,
  /\btolva\s+de\s+acero\s+de\s+gran\s+capacidad\s*,?\s+que\s+puede\s+contener\s+hasta\s+(\d{2,4})\s*litros?\b/giu
] as const;

const verifiedAdditionalHopperIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !["limpieza-barredoras", "limpieza-fregadoras"].includes(record.categoryKey) ||
    record.brand?.toLowerCase() !== "tennant" || record.specs?.["Marca"] !== "Tennant" ||
    !identifiedGamMachineModel(record) ||
    (!/\btennant\b/iu.test(record.title ?? "") && !/\btennant\b/iu.test(record.shortDescription ?? "")) ||
    !/\btennant\b/iu.test(record.longDescription ?? "") ||
    !record.shortDescription?.toLowerCase().includes(record.model?.toLowerCase() ?? "\0")) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const compact = (value: string): string => value.toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" &&
      ["tennant", "barredoras-industriales-nuevas", "fregadoras-industriales-nuevas"].includes(parts[1] ?? "") &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      compact(parts[2]).includes(compact(record.model ?? ""));
  } catch {
    return false;
  }
};

const hopperVolumePatterns = [
  /\b(?:capacidad\s+de\s+(?:la\s+)?tolva|tolva\s+con\s+capacidad)\s+de\s+(\d{2,4})\s*litros?\b/giu,
  /\btolva\s+de\s+(?:(?:alta|gran)\s+capacidad\s+de\s+|residuos\s+de\s+)?(\d{2,4})\s*litros?\b/giu
] as const;

const verifiedSweeperIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    record.categoryKey !== "limpieza-barredoras" || record.brand !== "Tennant" ||
    record.specs?.["Marca"] !== "Tennant" || record.specs?.["Modelo"] !== record.model ||
    !identifiedGamMachineModel(record) || !/^(?:BCS)\s/iu.test(record.model ?? "") ||
    !/\btennant\b/iu.test(record.title ?? "")) return false;
  const short = record.shortDescription ?? "";
  const competingModel = short.match(/\bBCS\s+(?:S\d+|\d+)\b/iu)?.[0];
  if (competingModel && !(record.model ?? "").toLowerCase().startsWith(competingModel.toLowerCase())) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const compact = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash && parts.length === 3 &&
      parts[0] === "es" && ["tennant", "barredoras-industriales-nuevas"].includes(parts[1] ?? "") &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      compact(parts[2]).includes(compact(record.model ?? ""));
  } catch {
    return false;
  }
};

export const recoverGamSweeperHopperCapacity = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!(verifiedSweeperIdentity(record) || verifiedAdditionalHopperIdentity(record) || verifiedResidualCleaningIdentity(record)) || Object.keys(source).some((key) =>
    /\b(?:tolva|dep[oó]sito\s+de\s+residuos)\b/iu.test(key))) return source;
  const description = record.longDescription ?? "";
  const values = [...hopperVolumePatterns, ...additionalHopperPatterns].flatMap((pattern) => [...description.matchAll(pattern)]
    .map((match) => Number(match[1])));
  const volume = values[0];
  if (volume === undefined || !Number.isInteger(volume) || volume < 20 || volume > 2000 ||
    values.some((value) => value !== volume)) return source;
  return { ...source, "Capacidad de la tolva": volume };
};
