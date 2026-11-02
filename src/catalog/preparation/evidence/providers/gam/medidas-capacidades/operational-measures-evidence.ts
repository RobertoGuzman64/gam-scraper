import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { identifiedGamMachineModel } from "./measured-machine-specs.js";
import { verifiedGamSourceVariant } from "../identidad/source-variant-identity.js";

const loadedSpeed = /\bvelocidad\s+de\s+desplazamiento\s+(?:de\s*)?(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+con\s+carga\s+y\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+sin\s+carga/giu;
const maximumSpeed = /\bvelocidad\s+m[aá]xima\s+de\s+(\d{1,3}(?:[.,]\d)?)\s*km\s*\/\s*h\b/giu;
const electricRoadVehicle = /\b(?:ciclomotor|scooter|motocicleta|cuatriciclo)\s+el[eé]ctric[oa]\b/iu;
const explicitTravelSpeed = /\bvelocidad\s+(?:(?:de\s+)?(?:desplazamiento|traslaci[oó]n)\s*(?:(?:de\s+)?hasta\s+|de\s+|:\s*hasta\s+)|m[aá]xima\s+de\s+desplazamiento\s+de\s+hasta\s+)(\d{1,3}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\b/giu;
const allKilometresPerHour = /\b(\d{1,3}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\b/giu;
const loadQualifier = /^\s*(?:con|sin)\s+carga\b/iu;
const speedWithLoad = /\b(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+con\s+carga\s+y\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+sin\s+carga\b/giu;
const speedWithoutLoad = /\b(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+sin\s+carga\s+y\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\s+con\s+carga\b/giu;
const verifiedTravelSpeed = /\bvelocidad(?:es)?(?:\s+de\s+(?:desplazamiento|traslaci[oó]n|propulsi[oó]n|trabajo))?\s+(?:(?:m[aá]xima\s+)?(?:de\s+)?hasta\s+|de\s+)(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\b|\balcanzando\s+velocidades\s+de\s+hasta\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\b/giu;
const verifiedBicycleSpeed = /\bvelocidad\s+limitada\s+a\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*km\s*\/\s*h\b/giu;
const existingSpeed = /\bvelocidad\b/iu;
const industrialCategories = new Set(["carretillas-nuevas", "apiladores-nuevos", "otros-nuevos"]);
const isolatedTravelCategories = new Set(["carretillas-nuevas", "limpieza-barredoras", "elevacion-nueva"]);

const matchesBrand = (record: ProductRecord): boolean => {
  const brand = record.brand?.trim();
  if (!brand || typeof record.specs?.["Marca"] !== "string" ||
    record.specs["Marca"].trim().toLowerCase() !== brand.toLowerCase()) return false;
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "iu").test(record.title ?? "");
};

const numericSpeed = (value: string): number => Number(value.replace(",", "."));

const verifiedTravelIdentity = (record: ProductRecord): boolean => {
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model || typeof record.specs?.["Marca"] !== "string" ||
    record.specs["Marca"].trim().toLowerCase() !== brand.toLowerCase()) return false;
  const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  if (!normalize(record.title ?? "").includes(normalize(brand)) ||
    !normalize(record.longDescription ?? "").includes(normalize(brand))) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalize(parts[2]).includes(normalize(model));
  } catch {
    return false;
  }
};

const isolatedTravelSpeed = (text: string): number | null => {
  const matches = [...text.matchAll(explicitTravelSpeed)];
  if (matches.length === 0) return null;
  const measures = [...text.matchAll(allKilometresPerHour)];
  if (measures.length !== matches.length || matches.some((match) =>
    loadQualifier.test(text.slice((match.index ?? 0) + match[0].length)))) return null;
  const values = matches.map((match) => numericSpeed(match[1] ?? ""));
  const first = values[0];
  return first !== undefined && Number.isFinite(first) && first >= 1 && first <= 30 &&
    values.every((value) => value === first) ? first : null;
};

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

const newPairedSpeed = (text: string): readonly [number, number] | null => {
  const pairs = [
    ...[...text.matchAll(speedWithLoad)].map((match) => [numericSpeed(match[1] ?? ""), numericSpeed(match[2] ?? "")] as const),
    ...[...text.matchAll(speedWithoutLoad)].map((match) => [numericSpeed(match[2] ?? ""), numericSpeed(match[1] ?? "")] as const)
  ];
  const first = pairs[0];
  if (!first || first[0] < 1 || first[1] > 30 || first[1] < first[0] ||
    pairs.some(([loaded, unloaded]) => loaded !== first[0] || unloaded !== first[1])) return null;
  const speeds = [...text.matchAll(allKilometresPerHour)].map((match) => numericSpeed(match[1] ?? ""));
  return speeds.every((value) => value === first[0] || value === first[1]) ? first : null;
};

const newSingleSpeed = (text: string, pattern: RegExp): number | null => {
  const matches = [...text.matchAll(pattern)];
  const speeds = [...text.matchAll(allKilometresPerHour)].map((match) => numericSpeed(match[1] ?? ""));
  const values = matches.map((match) => numericSpeed(match[1] ?? match[2] ?? ""));
  const first = values[0];
  if (first === undefined || !Number.isFinite(first) || first < 1 || first > 30 ||
    values.some((value) => value !== first) || speeds.some((value) => value !== first)) return null;
  return matches.some((match) => loadQualifier.test(text.slice((match.index ?? 0) + match[0].length))) ? null : first;
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
  if (record.condition === "Nuevo" && isolatedTravelCategories.has(record.categoryKey) && verifiedTravelIdentity(record)) {
    const speed = isolatedTravelSpeed(text);
    if (speed !== null) return { ...source, "Velocidad de desplazamiento (km/h)": `${String(speed).replace(".", ",")} km/h` };
  }
  if (verifiedGamSourceVariant(record) && record.condition === "Nuevo") {
    if (industrialCategories.has(record.categoryKey)) {
      const pair = newPairedSpeed(text);
      if (pair) {
        const format = (value: number): string => String(value).replace(".", ",");
        return { ...source, "Velocidad de desplazamiento con/sin carga (km/h)": `${format(pair[0])} / ${format(pair[1])} km/h` };
      }
    }
    const compatibleCleaningTitle = record.categoryKey === "limpieza-fregadoras" ?
      /\bfregadora\b/iu.test(record.title ?? "") && !/\bbarredora\b/iu.test(record.title ?? "") : record.categoryKey === "limpieza-barredoras" ?
      /\bbarredora\b/iu.test(record.title ?? "") : true;
    if (compatibleCleaningTitle && ["carretillas-nuevas", "apiladores-nuevos", "otros-nuevos", "limpieza-fregadoras", "limpieza-barredoras"].includes(record.categoryKey)) {
      const speed = newSingleSpeed(text, verifiedTravelSpeed);
      if (speed !== null) return { ...source, "Velocidad de desplazamiento (km/h)": `${String(speed).replace(".", ",")} km/h` };
    }
  }
  if (verifiedGamSourceVariant(record) && record.categoryKey === "maquinaria" &&
    record.condition === "Segunda mano" && /\bbicicleta\s+el[eé]ctrica\b/iu.test(text)) {
    const speed = newSingleSpeed(text, verifiedBicycleSpeed);
    if (speed !== null) return { ...source, "Velocidad limitada (km/h)": `${String(speed).replace(".", ",")} km/h` };
  }
  return source;
};
