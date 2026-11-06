import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "../measurements-and-capacities/measured-machine-specs.js";

const wheelbase = /\b(?:batalla|distancia\s+entre\s+ejes)\s*(?::|de)?\s*(\d{1,2}(?:\.\d{3})|\d{3,5})\s*mm\b/giu;
const existingWheelbase = /\bbatalla\b|\bdistancia\s+entre\s+ejes\b/iu;
const eligibleCategories = new Set(["carretillas-nuevas", "elevacion-nueva"]);

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const verifiedIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !eligibleCategories.has(record.categoryKey) || !identifiedGamMachineModel(record)) return false;
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    normalize(record.specs["Marca"]) !== normalize(brand) ||
    !normalize(record.title ?? "").includes(normalize(brand)) ||
    !normalize(record.longDescription ?? "").includes(normalize(brand))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(record.model ?? ""));
  } catch {
    return false;
  }
};

export const recoverGamWheelbaseSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedIdentity(record) || Object.keys(source).some((key) => existingWheelbase.test(key))) return source;
  const values = [...(record.longDescription ?? "").matchAll(wheelbase)]
    .map((match) => Number((match[1] ?? "").replace(".", "")));
  const value = values[0];
  if (value === undefined || !Number.isInteger(value) || value < 500 || value > 7500 ||
    values.some((candidate) => candidate !== value)) return source;
  return { ...source, "Distancia entre ejes (mm)": `${value} mm` };
};
