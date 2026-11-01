import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "./source-variant-identity.js";

const references = new Set(["4030", "4033", "3996", "4003", "4004", "4012", "6423"]);
const noiseKey = /\b(?:nivel\s+sonoro|nivel\s+de\s+ruido|nivel\s+ac[uú]stico|presi[oó]n\s+sonora)\b/iu;
const s30 = /\bnivel de ruido de tan solo (\d{2,3}) dBA para la versi[oó]n GLP y (\d{2,3}) dBA para la versi[oó]n di[eé]sel\b/giu;
const t1581 = /\bnivel de ruido, de (\d{2,3}) dBA en la versi[oó]n de disco y (\d{2,3}) dBA en la versi[oó]n cil[ií]ndrica\b/giu;
const s16l = /\bnivel ac[uú]stico de tan solo (\d{2,3}) dBA\b/giu;
const cs16 = /\bnivel de ruido de tan solo (\d{2,3}) dBA en modo Eco\b/giu;
const quiet = /\bmodo Quiet-Mode™ reduce el nivel de ruido a solo (\d{2,3}(?:[.,]\d{1,2})?) dBA\b/giu;
const hyster = /\bnivel sonoro en el asiento del conductor es (\d{2,3}(?:[.,]\d{1,2})?) dB\(A\)/giu;
const decibelMeasure = /\b\d{2,3}(?:[.,]\d{1,2})?\s*dB(?:A|\(A\))?/giu;

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const verifiedSeparateIdentity = (record: ProductRecord): boolean => {
  if (record.reference === "4030" && record.brand === "Tennant" &&
    record.model === "BCS S16L Descarga baja" && record.specs?.["Marca"] === "Tennant" &&
    record.specs?.["Modelo"] === record.model &&
    record.url === "https://online.gamrentals.com/es/barredoras-industriales-nuevas/4030-bcs-s16l-descarga-baja") {
    return [record.title, record.shortDescription, record.longDescription].every((part) =>
      normalize(part ?? "").includes("bcss16l") && normalize(part ?? "").includes("descargabaja") &&
      normalize(part ?? "").includes("tennant"));
  }
  if (record.reference === "6423" && record.brand === null && record.model === "J3.0UTL" &&
    record.specs?.["Modelo"] === "J3.0UTL" &&
    record.url === "https://online.gamrentals.com/es/marcas/6423-carretilla-elevadora-electrica-hyster-j30utl") {
    return [record.title, record.shortDescription, record.longDescription].every((part) =>
      normalize(part ?? "").includes("hysterj30utl"));
  }
  return false;
};

const values = (description: string, pattern: RegExp, count: number): readonly string[] | null => {
  const matches = [...description.matchAll(pattern)];
  if (matches.length !== 1) return null;
  const result = matches[0]?.slice(1, count + 1);
  return result?.length === count && result.every((part) => part !== undefined &&
    Number(part.replace(",", ".")) >= 40 && Number(part.replace(",", ".")) <= 100) ? result : null;
};

export const recoverGamVerifiedConditionalAcoustics = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference || !references.has(record.reference) ||
    !["limpieza-barredoras", "limpieza-fregadoras", "carretillas-nuevas"].includes(record.categoryKey) ||
    Object.keys(source).some((key) => noiseKey.test(key)) ||
    !(verifiedGamSourceVariant(record) || verifiedSeparateIdentity(record))) return source;

  const description = record.longDescription ?? "";
  const expectedMeasurements = ["4033", "4012"].includes(record.reference) ? 2 : 1;
  if ([...description.matchAll(decibelMeasure)].length !== expectedMeasurements) return source;
  let result: string | null = null;
  if (record.reference === "4033") {
    const found = values(description, s30, 2);
    if (found) result = `GLP: ${found[0]} dBA; diésel: ${found[1]} dBA`;
  } else if (record.reference === "4012") {
    const found = values(description, t1581, 2);
    if (found) result = `Disco: ${found[0]} dBA; cilíndrica: ${found[1]} dBA`;
  } else if (record.reference === "4030") {
    const found = values(description, s16l, 1);
    if (found) result = `${found[0]} dBA`;
  } else if (record.reference === "3996") {
    const found = values(description, cs16, 1);
    if (found) result = `${found[0]} dBA (modo Eco)`;
  } else if (record.reference === "4003" || record.reference === "4004") {
    const found = values(description, quiet, 1);
    if (found) result = `${found[0]} dBA (modo Quiet-Mode)`;
  } else if (record.reference === "6423") {
    const found = values(description, hyster, 1);
    if (found) result = `${found[0]} dB(A) (asiento del conductor)`;
  }
  return result === null ? source : { ...source, "Nivel sonoro": result };
};
