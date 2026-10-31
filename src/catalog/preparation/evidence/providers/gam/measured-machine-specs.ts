import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";

const radiusCategories = new Set(["carretillas-nuevas", "apiladores-nuevos", "otros-nuevos", "limpieza-fregadoras"]);
const turningRadius = /\bradio\s+de\s+giro\s*(?:de\s+|:\s*)?(\d{1,3}(?:\.\d{3})|\d{3,4})\s*mm\b/giu;
const enginePower = /\bpotencia\s+(?:m[aá]xima\s+)?de\s+(\d{2,3})\s*kW\b/giu;
const engineBrands = ["kubota", "mercedes-benz", "mtu"] as const;

export const identifiedGamMachineModel = (record: ProductRecord): boolean => {
  const model = record.model?.trim();
  if (!model || typeof record.specs?.["Modelo"] !== "string" ||
    record.specs["Modelo"].trim().toLowerCase() !== model.toLowerCase()) return false;
  const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "iu");
  return [record.title, record.longDescription].every((text) => typeof text === "string" && boundary.test(text));
};

const singleMeasuredValue = (text: string, pattern: RegExp, minimum: number, maximum: number): number | null => {
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return null;
  const values = matches.map((match) => Number((match[1] ?? "").replace(/\./g, "")));
  const value = values[0];
  return value !== undefined && Number.isInteger(value) && value >= minimum && value <= maximum &&
    values.every((candidate) => candidate === value) ? value : null;
};

const conflictingEngineBrand = (record: ProductRecord): boolean => {
  const sourceMotor = record.specs?.["Tipo motor"];
  if (typeof sourceMotor !== "string") return false;
  const source = engineBrands.filter((brand) => sourceMotor.toLowerCase().includes(brand));
  const description = engineBrands.filter((brand) => (record.longDescription ?? "").toLowerCase().includes(brand));
  return source.length > 0 && description.length > 0 && !description.some((brand) => source.includes(brand));
};

export const recoverGamExplicitMachineSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || !identifiedGamMachineModel(record)) return source;

  const text = record.longDescription ?? "";
  let result: SpecsMap = source;
  if (radiusCategories.has(record.categoryKey) && !Object.keys(source).some((key) => /\bradio\s+(?:de\s+)?giro\b/iu.test(key))) {
    const radius = singleMeasuredValue(text, turningRadius, 500, 10000);
    if (radius !== null) result = { ...result, "Radio de giro (mm)": `${radius} mm` };
  }
  if (record.categoryKey === "carretillas-nuevas" && record.condition === "Nuevo" &&
    !Object.keys(source).some((key) => /\bpotencia\b/iu.test(key)) && !conflictingEngineBrand(record)) {
    const power = singleMeasuredValue(text, enginePower, 10, 400);
    if (power !== null) result = { ...result, "Potencia (kW)": `${power} kW` };
  }
  return result;
};
