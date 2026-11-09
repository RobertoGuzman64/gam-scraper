import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../shared/classification/mapping/attribute-types.js";
import { fold } from "../../shared/classification/mapping/attribute-utils.js";

const sourceFamily = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || fold(record.brand ?? "") !== "yale") return null;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" ? parts[1] ?? null : null;
  } catch {
    return null;
  }
};

const confirmedModel = (record: ProductRecord): boolean => {
  const model = fold(record.model ?? "").replace(/\s*\(pedestrian\)$/, "");
  if (!model || typeof record.specs?.["Modelo"] !== "string" ||
    fold(record.specs["Modelo"]).replace(/\s*\(pedestrian\)$/, "") !== model) return false;
  const boundary = new RegExp(`(?:^|[^a-z0-9])${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`);
  return [record.title, record.longDescription].every((value) => typeof value === "string" && boundary.test(fold(value)));
};

export const gamCrossedBatteryValue = (value: string): string | null => {
  const match = value.trim().match(/^([1-9]\d*)\s*V\s*\/\s*([1-9]\d*)\s*Ah\s*\(\s*V\s*\/\s*Ah\s*\)$/i);
  return match?.[1] && match[2] ? `${match[1]} V / ${match[2]} Ah` : null;
};

export const gamMislabelledStacker = (record: ProductRecord): { readonly height: number; readonly weight: number; readonly battery: string } | null => {
  if (sourceFamily(record) !== "apiladores-yale" || !confirmedModel(record) ||
    !/^Apilador el[eé]ctrico a pie Yale MC(?:12|15)$/i.test(record.title ?? "")) return null;
  const specs = record.specs ?? {};
  const model = fold(record.model ?? "");
  if (model !== "mc12 (pedestrian)" && model !== "mc15 (pedestrian)") return null;
  const height = typeof specs["Centro de carga"] === "string" ? specs["Centro de carga"].match(/^([1-9]\d{3})\s*mm$/i) : null;
  const weight = typeof specs["Capacidad de la batería"] === "string" ? specs["Capacidad de la batería"].match(/^([1-9]\d{3})$/) : null;
  const battery = typeof specs["Radio de giro"] === "string" ? gamCrossedBatteryValue(specs["Radio de giro"]) : null;
  const load = typeof specs["Capacidad de carga (kg)"] === "string" ? specs["Capacidad de carga (kg)"].match(/^([1-9]\d{3})\s*kg$/i) : null;
  if (!height?.[1] || !weight?.[1] || !battery || !load?.[1] ||
    specs["Peso"] !== undefined || specs["Peso (kg)"] !== undefined ||
    specs["Altura de elevación (mm)"] !== undefined || specs["Batería (V / Ah)"] !== undefined ||
    Number(height[1]) !== 5076 || battery !== "24 V / 400 Ah" ||
    Number(weight[1]) !== (model === "mc12 (pedestrian)" ? 2280 : 2360) ||
    Number(load[1]) !== (model === "mc12 (pedestrian)" ? 1200 : 1500)) return null;
  return { height: Number(height[1]), weight: Number(weight[1]), battery };
};

const mislabelledPalletBattery = (record: ProductRecord): string | null => {
  if (sourceFamily(record) !== "transpaletas-yale" || !confirmedModel(record) ||
    !/\btranspaleta el[eé]ctrica\b/i.test(record.title ?? "")) return null;
  const raw = record.specs?.["Altura Plataforma"];
  if (typeof raw !== "string" || !/^24\s*V\s*\/\s*\d[\d\s-]*\s*Ah\b/i.test(raw)) return null;
  if (!/\(\s*V\s*\/\s*Ah\s*\)\s*metros?$/i.test(raw)) return null;
  return raw.replace(/\s+metros?$/i, "");
};

export const gamPalletBatteryForCrossedSpecs = (record: ProductRecord): string | null => {
  const battery = mislabelledPalletBattery(record);
  if (battery === null) return null;
  const capacity = record.specs?.["Capacidad de la batería"];
  const weight = record.specs?.["Peso"];
  const duplicatedWeight = typeof capacity === "string" && typeof weight === "string" &&
    /^[1-9]\d{2,4}$/.test(capacity) && weight.toUpperCase() === `${capacity} KG`;
  return capacity === undefined || duplicatedWeight ? battery : null;
};

const matchesSourceReference = (record: ProductRecord): boolean => {
  if (!record.reference) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && !url.search && !url.hash &&
      parts.length === 3 && parts[0] === "es" && parts[2]?.startsWith(`${record.reference}-`) === true;
  } catch {
    return false;
  }
};

export const recoverGamCrossedTechnicalSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!matchesSourceReference(record)) return source;
  const stacker = gamMislabelledStacker(record);
  if (stacker !== null) {
    const { "Centro de carga": _center, "Radio de giro": _turning, "Capacidad de la batería": _capacity, ...remaining } = source;
    return {
      ...remaining,
      "Altura de elevación (mm)": `${stacker.height} mm`,
      Peso: `${stacker.weight} kg`,
      "Batería (V / Ah)": stacker.battery
    };
  }
  if (source["Batería (V / Ah)"] !== undefined) return source;
  const battery = gamPalletBatteryForCrossedSpecs(record);
  if (battery === null) return source;
  const { "Altura Plataforma": _height, "Capacidad de la batería": _capacity, ...remaining } = source;
  return { ...remaining, "Batería (V / Ah)": gamCrossedBatteryValue(battery) ?? battery };
};

export const applyGamCrossedSpecifications = (
  record: ProductRecord, attribute: Attribute, candidates: Candidate[]
): void => {
  const stacker = gamMislabelledStacker(record);
  if (stacker) {
    if (attribute.name === "Altura de elevación" && attribute.unit_option === "mm" &&
      record.specs?.["Altura de elevación (mm)"] === undefined) {
      candidates.push({ key: attribute.name, value: stacker.height });
    }
    if ((attribute.name === "Peso" || attribute.name === "Peso operativo") && attribute.unit_option === "kg" &&
      record.specs?.["Peso"] === undefined) {
      candidates.push({ key: attribute.name, value: stacker.weight });
    }
    if (attribute.name === "Batería (V / Ah)" && attribute.type === "TEXT" && attribute.unit_option === "V / Ah" &&
      record.specs?.["Batería (V / Ah)"] === undefined) {
      candidates.push({ key: attribute.name, value: stacker.battery });
    }
  }
  const palletBattery = gamPalletBatteryForCrossedSpecs(record);
  if (!palletBattery) return;
  if (attribute.name === "Batería (V / Ah)" && attribute.type === "TEXT" && attribute.unit_option === "V / Ah" &&
    record.specs?.["Batería (V / Ah)"] === undefined) {
    const value = gamCrossedBatteryValue(palletBattery);
    if (value !== null) candidates.push({ key: attribute.name, value });
  }
};

export const gamMislabelledSpecKey = (record: ProductRecord, attribute: Attribute, rawKey: string): boolean => {
  if (gamMislabelledStacker(record)) {
    if (attribute.name === "Centro de carga" && attribute.unit_option === "mm" && rawKey === "Centro de carga") return true;
    if (attribute.name === "Radio de giro" && attribute.unit_option === "mm" && rawKey === "Radio de giro") return true;
  }
  return attribute.name === "Altura de plataforma" && attribute.unit_option === "m" &&
    rawKey === "Altura Plataforma" && mislabelledPalletBattery(record) !== null;
};
