import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

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
  if (!matchesSourceIdentity(record) ||
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
