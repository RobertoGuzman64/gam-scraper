import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";

const loadedSpeed = /\bvelocidad\s+de\s+desplazamiento\s+(?:de\s*)?(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+con\s+carga\s+y\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+sin\s+carga/giu;
const maximumSpeed = /\bvelocidad\s+m[aá]xima\s+de\s+(\d{1,3}(?:[.,]\d)?)\s*km\s*\/\s*h\b/giu;
const electricRoadVehicle = /\b(?:ciclomotor|scooter|motocicleta|cuatriciclo)\s+el[eé]ctric[oa]\b/iu;
const existingSpeed = /\bvelocidad\b/iu;
const industrialCategories = new Set(["carretillas-nuevas", "apiladores-nuevos", "otros-nuevos"]);

const matchesBrand = (record: ProductRecord): boolean => {
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    record.specs["Marca"].trim().toLowerCase() !== brand.toLowerCase()) return false;
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "iu").test(record.title ?? "");
};

const numericSpeed = (value: string): number => Number(value.replace(",", "."));

const pairedSpeed = (text: string): readonly [number, number] | null => {
  const measures = [...text.matchAll(loadedSpeed)].map((match) => [numericSpeed(match[1] ?? ""), numericSpeed(match[2] ?? "")] as const);
  const first = measures[0];
  if (!first || first.some((value) => !Number.isFinite(value) || value < 1 || value > 30) || first[1] < first[0] ||
    measures.some(([loaded, unloaded]) => loaded !== first[0] || unloaded !== first[1])) return null;
  return first;
};

const singleSpeed = (text: string): number | null => {
  const measures = [...text.matchAll(maximumSpeed)].map((match) => numericSpeed(match[1] ?? ""));
  const first = measures[0];
  return first !== undefined && Number.isFinite(first) && first >= 30 && first <= 160 &&
    measures.every((value) => value === first) ? first : null;
};

export const recoverGamOperationalSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || !identifiedGamMachineModel(record) || !matchesBrand(record) ||
    Object.keys(source).some((key) => existingSpeed.test(key))) return source;

  const text = record.longDescription ?? "";
  if (industrialCategories.has(record.categoryKey) && record.condition === "Nuevo") {
    const speeds = pairedSpeed(text);
    if (speeds !== null) {
      const format = (value: number): string => String(value).replace(".", ",");
      return { ...source, "Velocidad de desplazamiento con/sin carga (km/h)": `${format(speeds[0])} / ${format(speeds[1])} km/h` };
    }
  }
  if (record.categoryKey === "maquinaria" && record.condition === "Segunda mano" && electricRoadVehicle.test(text)) {
    const speed = singleSpeed(text);
    if (speed !== null) return { ...source, "Velocidad de desplazamiento (km/h)": `${String(speed).replace(".", ",")} km/h` };
  }
  return source;
};
