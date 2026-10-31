import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const autonomy = /\bautonom[ií]a\s+(?:m[aá]xima\s+|indicada\s+)?(?:de\s+|:\s*)?(?:hasta\s+)?(\d{1,3})\s*(km|kil[oó]metros?|horas?|h)\b/giu;
const reverseAutonomy = /\bhasta\s+(\d{1,3})\s*(km|kil[oó]metros?|horas?|h)\s+de\s+autonom[ií]a\b/giu;
const alternativeRange = /\b(?:o|u)\s+\d{1,3}\s+(?:horas?|km)(?!\/h)\b/iu;
const existingAutonomy = /\bautonom[ií]a\b/iu;
const electricVehicle = /\b(?:ciclomotor|scooter|motocicleta|bicicleta)\s+el[eé]ctric[oa]\b/iu;
const electricForklift = /\bcarretilla\s+retr[aá]ctil\s+el[eé]ctrica\b/iu;

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const verifiedIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalize(record.specs["Marca"]) !== normalize(brand) ||
    !normalize(record.title ?? "").includes(normalize(brand)) ||
    !normalize(record.longDescription ?? "").includes(normalize(brand))) return false;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && path[0] === "es" &&
      path[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(path[2]).endsWith(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

type Measure = { readonly value: number; readonly unit: "km" | "h" };

const measuresOf = (description: string): readonly Measure[] => {
  const results: Measure[] = [];
  for (const pattern of [autonomy, reverseAutonomy]) {
    for (const match of description.matchAll(pattern)) {
      const unit = /^(?:km|kil[oó]metros?)$/iu.test(match[2] ?? "") ? "km" : "h";
      results.push({ value: Number(match[1]), unit });
    }
  }
  return results;
};

export const recoverGamAutonomySpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedIdentity(record) || Object.keys(source).some((key) => existingAutonomy.test(key))) return source;
  const description = record.longDescription ?? "";
  const eligible = record.categoryKey === "maquinaria" && record.condition === "Segunda mano" && electricVehicle.test(description) ||
    record.categoryKey === "manutencion" && record.condition === "Segunda mano" && electricForklift.test(description) ||
    ["limpieza-barredoras", "limpieza-fregadoras"].includes(record.categoryKey) && record.condition === "Nuevo";
  if (!eligible || alternativeRange.test(description)) return source;
  const measures = measuresOf(description);
  const first = measures[0];
  if (!first || !Number.isInteger(first.value) || first.value < 1 ||
    first.value > (first.unit === "km" ? 500 : 24) ||
    measures.some((item) => item.value !== first.value || item.unit !== first.unit)) return source;
  return { ...source, [`Autonomía máxima (${first.unit})`]: `${first.value} ${first.unit}` };
};
