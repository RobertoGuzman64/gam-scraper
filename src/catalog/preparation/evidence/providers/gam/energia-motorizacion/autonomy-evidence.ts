import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "../medidas-capacidades/measured-machine-specs.js";
import { verifiedGamSourceVariant } from "../identidad/source-variant-identity.js";

const autonomy = /\bautonom[ií]a\s+(?:m[aá]xima\s+|indicada\s+)?(?:de\s+|:\s*)?(?:hasta\s+)?(\d{1,3}(?:[.,]\d)?)\s*(km|kil[oó]metros?|horas?|h)\b/giu;
const reverseAutonomy = /\bhasta\s+(\d{1,3}(?:[.,]\d)?)\s*(km|kil[oó]metros?|horas?|h)\s+de\s+autonom[ií]a\b/giu;
const alternativeRange = /\b(?:o|u)\s+\d{1,3}\s+(?:horas?|km)(?!\/h)\b/iu;
const existingAutonomy = /\bautonom[ií]a\b/iu;
const electricVehicle = /\b(?:ciclomotor|scooter|motocicleta|bicicleta)\s+el[eé]ctric[oa]\b/iu;
const electricForklift = /\bcarretilla\s+retr[aá]ctil\s+el[eé]ctrica\b/iu;
const approximateAutonomy = /\bautonom[ií]a\s+(?:entorno\s+a|de\s+aproximadamente|aproximada\s+de)\s+(\d{1,2}(?:[.,]\d)?)\s+horas?\b/giu;
const anyHourlyAutonomy = /\bautonom[ií]a\s+(?:(?:de|hasta|entorno|aproximada|aproximadamente|m[aá]xima|indicada|en|a)\s+){0,4}(\d{1,3}(?:[.,]\d)?)\s+horas?\b/giu;
const autonomyRange = /\bautonom[ií]a\s+(?:de\s+)?\d{1,3}(?:[.,]\d)?\s*(?:a|[–-]|\/)\s*\d{1,3}(?:[.,]\d)?\s+horas?\b/iu;

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
      results.push({ value: Number((match[1] ?? "").replace(",", ".")), unit });
    }
  }
  return results;
};

export const recoverGamAutonomySpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const verifiedApproximateCrane = record.categoryKey === "otros-nuevos" && record.condition === "Nuevo" &&
    normalize(record.brand ?? "") === "ormig" && verifiedGamSourceVariant(record);
  if ((!verifiedIdentity(record) && !verifiedApproximateCrane) ||
    Object.keys(source).some((key) => existingAutonomy.test(key))) return source;
  const description = record.longDescription ?? "";
  const eligible = record.categoryKey === "maquinaria" && record.condition === "Segunda mano" && electricVehicle.test(description) ||
    record.categoryKey === "manutencion" && record.condition === "Segunda mano" && electricForklift.test(description) ||
    ["limpieza-barredoras", "limpieza-fregadoras"].includes(record.categoryKey) && record.condition === "Nuevo";
  if (!eligible && verifiedApproximateCrane) {
    const measures = [...description.matchAll(approximateAutonomy)]
      .map((match) => Number((match[1] ?? "").replace(",", ".")));
    const first = measures[0];
    if (first !== undefined && Number.isFinite(first) && first >= 1 && first <= 24 &&
      measures.every((value) => value === first) &&
      [...description.matchAll(anyHourlyAutonomy)].every((match) => Number((match[1] ?? "").replace(",", ".")) === first) &&
      !autonomyRange.test(description) && !alternativeRange.test(description)) {
      return { ...source, "Autonomía aproximada (h)": `${String(first).replace(".", ",")} h` };
    }
  }
  if (!eligible || alternativeRange.test(description)) return source;
  const measures = measuresOf(description);
  const first = measures[0];
  if (!first || !Number.isFinite(first.value) || first.value * 2 !== Math.round(first.value * 2) || first.value < 1 ||
    first.value > (first.unit === "km" ? 500 : 24) ||
    measures.some((item) => item.value !== first.value || item.unit !== first.unit)) return source;
  return { ...source, [`Autonomía máxima (${first.unit})`]: `${String(first.value).replace(".", ",")} ${first.unit}` };
};
