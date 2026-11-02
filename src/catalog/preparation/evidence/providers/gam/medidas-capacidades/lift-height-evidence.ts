import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";
import { verifiedGamSourceVariant } from "../identidad/source-variant-identity.js";

const maximumLiftHeight = /\baltura\s+(?:m[aá]xima\s+)?de\s+elevaci[oó]n\s+de\s+(?:hasta\s+)?(\d{1,2}(?:[.,]\d{3})|\d{1,5}(?:[.,]\d{1,2})?)\s*(mm|metros?|m)\b/giu;
const identifiedLiftHeight = /\baltura\s+de\s+elevaci[oó]n\s+(?:de\s+hasta\s+|de\s+|hasta\s+)?(\d{1,5}(?:[.,]\d{1,2})?)\s*(mm|metros?|m)\b/giu;
const existingLiftHeight = /\baltura\s+(?:m[aá]xima\s+)?(?:de\s+)?elevaci[oó]n\b/iu;
const categoryBrands: Readonly<Record<string, readonly string[]>> = {
  "apiladores-nuevos": ["yale"],
  "carretillas-nuevas": ["hyster"],
  "marcas-nuevas": ["hyster"]
};

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const hasSourceIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !identifiedGamMachineModel(record)) return false;
  const brand = normalize(record.brand ?? "");
  const model = normalize(record.model ?? "");
  if (!brand || !model || !categoryBrands[record.categoryKey]?.includes(brand) ||
    normalize(String(record.specs?.["Marca"] ?? "")) !== brand ||
    ![record.title, record.longDescription].every((part) => normalize(part ?? "").includes(brand))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(model);
  } catch {
    return false;
  }
};

const heightInMillimetres = (raw: string, unit: string): number | null => {
  if (unit.toLowerCase() === "mm") {
    if (!/^\d{1,5}$|^\d{1,2}[.,]\d{3}$/.test(raw)) return null;
    return Number(raw.replace(/[.,]/g, ""));
  }
  const metres = Number(raw.replace(",", "."));
  return Number.isFinite(metres) ? metres * 1000 : null;
};

export const recoverGamMaximumLiftHeightSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (Object.keys(source).some((key) => existingLiftHeight.test(key))) return source;
  const identifiedSource = hasSourceIdentity(record);
  const verifiedAdditional = verifiedGamSourceVariant(record) && (
    (record.condition === "Segunda mano" && ["elevacion", "manutencion"].includes(record.categoryKey)) ||
    (record.condition === "Nuevo" && ["carretillas-nuevas", "marcas-nuevas"].includes(record.categoryKey))
  );
  if (!identifiedSource && !verifiedAdditional) return source;
  const pattern = identifiedSource ? maximumLiftHeight : identifiedLiftHeight;
  const measures = [...(record.longDescription ?? "").matchAll(pattern)]
    .map((match) => heightInMillimetres(match[1] ?? "", match[2] ?? ""));
  const value = measures[0];
  if (value === undefined || value === null || !Number.isInteger(value) || value < (verifiedAdditional ? 100 : 150) || value > 14000 ||
    measures.some((measure) => measure !== value)) return source;
  return { ...source, "Altura de elevación (mm)": `${value} mm` };
};
