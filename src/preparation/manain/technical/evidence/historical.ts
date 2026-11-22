import type { SpecsMap } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/category-utils.js";
import type { ManainStocklistProduct } from "../../source/stocklist.js";

export type ManainHistoricalTechnicalEntry = {
  readonly reference: string;
  readonly brand: string;
  readonly model: string;
  readonly year: string;
  readonly sourceUrl: string;
  readonly technicalSheetUrl: string;
  readonly scrapedAt: string;
  readonly specs: Readonly<Record<string, string>>;
};

export type ManainHistoricalTechnicalEvidence = {
  readonly version: 1;
  readonly providerId: "manain";
  readonly legacyRecordSha256: string;
  readonly entries: readonly ManainHistoricalTechnicalEntry[];
};

const technicalFields = new Set([
  "Motor", "Peso", "Altura trabajo", "Altura replegada", "Longitud plataforma", "Ancho plataforma",
  "Capacidad carga", "Tracción", "Longitud total", "Ancho total", "Alcance horizontal max.",
  "Alcance horizontal", "Altura articulacion", "Altura barandilla bajada", "Longitud extensión",
  "Trabajo negativo", "Trabajo en negativo", "Longitud transporte", "Longitud sin horquillas",
  "Altura de elevacion max", "Alcance maximo", "Peso operativo", "Peso maquina",
  "Peso de la maquina", "Peso carretilla en vacio", "Peso sin carga", "Alto", "Largo", "Ancho",
  "Anchura", "Anchura total", "Altura", "Altura total", "Altura elevacion", "Altura max. replegada",
  "Potencia", "Potencia absorbida", "Capacidad depósito", "Voltios", "Largo horquillas",
  "Ancho horquillas", "Grosor horquillas", "Altura transporte", "Tipo mastil", "Stage",
  "Tipo brazo", "Ancho cesta", "Longitud cesta", "Alto cesta", "Ancho con ejes", "Marca motor",
  "Polos", "Longitud", "Mastil replegado"
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const exact = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validUrl = (value: unknown, prefix: string): value is string => {
  if (!nonBlank(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["manain.com", "www.manain.com"].includes(url.hostname) &&
      url.pathname.startsWith(prefix) && url.pathname.length > prefix.length;
  } catch {
    return false;
  }
};

const validTechnicalSpecs = (value: unknown): value is Readonly<Record<string, string>> =>
  isRecord(value) && Object.keys(value).length > 0 &&
  Object.entries(value).every(([field, spec]) => technicalFields.has(field) && nonBlank(spec));

const parseEntry = (value: unknown): ManainHistoricalTechnicalEntry => {
  if (!isRecord(value) || !exact(value, ["reference", "brand", "model", "year", "sourceUrl",
    "technicalSheetUrl", "scrapedAt", "specs"]) ||
    !nonBlank(value.reference) || !nonBlank(value.brand) || !nonBlank(value.model) ||
    !nonBlank(value.year) || !/^\d{4}$/u.test(value.year) ||
    !validUrl(value.sourceUrl, "/producto/") || !validUrl(value.technicalSheetUrl, "/ficha-tecnica/") ||
    !nonBlank(value.scrapedAt) || !Number.isFinite(Date.parse(value.scrapedAt)) ||
    !validTechnicalSpecs(value.specs)) {
    throw new Error("Manain: evidencia técnica histórica inválida");
  }
  return {
    reference: value.reference, brand: value.brand, model: value.model, year: value.year,
    sourceUrl: value.sourceUrl, technicalSheetUrl: value.technicalSheetUrl,
    scrapedAt: value.scrapedAt, specs: value.specs
  };
};

export const parseManainHistoricalTechnicalEvidence = (value: unknown): ManainHistoricalTechnicalEvidence => {
  if (!isRecord(value) || !exact(value, ["version", "providerId", "legacyRecordSha256", "entries"]) ||
    value.version !== 1 || value.providerId !== "manain" ||
    typeof value.legacyRecordSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.legacyRecordSha256) ||
    !Array.isArray(value.entries) || value.entries.length === 0) {
    throw new Error("Manain: paquete de evidencia histórica inválido");
  }
  const entries = value.entries.map(parseEntry);
  const references = entries.map((entry) => entry.reference);
  if (new Set(references).size !== references.length || references.some((reference, index) => index > 0 &&
    reference <= references[index - 1]!)) {
    throw new Error("Manain: identidades históricas duplicadas o desordenadas");
  }
  return { version: 1, providerId: "manain", legacyRecordSha256: value.legacyRecordSha256, entries };
};

export const matchingManainHistoricalSpecs = (
  current: ManainStocklistProduct, historical: ManainHistoricalTechnicalEntry | undefined
): SpecsMap | null => {
  if (!historical || historical.reference !== current.referencia || historical.brand !== current.marca ||
    historical.model !== current.modelo || historical.year !== String(current.anio)) return null;
  const family = fold(current.familia);
  const motor = fold(historical.specs.Motor ?? "");
  if (motor && (/\bdiesel\b/u.test(family) && motor !== "diesel" ||
    /\belectric[oa]\b/u.test(family) && motor !== "electrico")) return null;
  return historical.specs;
};
