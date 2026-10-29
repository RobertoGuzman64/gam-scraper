import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold } from "../../attribute-utils.js";

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

const batteryValue = (value: string): string | null => {
  const match = value.trim().match(/^([1-9]\d*)\s*V\s*\/\s*([1-9]\d*)\s*Ah\s*\(\s*V\s*\/\s*Ah\s*\)$/i);
  return match?.[1] && match[2] ? `${match[1]} V / ${match[2]} Ah` : null;
};

const mislabelledStacker = (record: ProductRecord): { readonly height: number; readonly weight: number; readonly battery: string } | null => {
  if (sourceFamily(record) !== "apiladores-yale" || !confirmedModel(record) ||
    !/^Apilador el[eé]ctrico a pie Yale MC(?:12|15)$/i.test(record.title ?? "")) return null;
  const specs = record.specs ?? {};
  const model = fold(record.model ?? "");
  if (model !== "mc12 (pedestrian)" && model !== "mc15 (pedestrian)") return null;
  const height = typeof specs["Centro de carga"] === "string" ? specs["Centro de carga"].match(/^([1-9]\d{3})\s*mm$/i) : null;
  const weight = typeof specs["Capacidad de la batería"] === "string" ? specs["Capacidad de la batería"].match(/^([1-9]\d{3})$/) : null;
  const battery = typeof specs["Radio de giro"] === "string" ? batteryValue(specs["Radio de giro"]) : null;
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

export const applyGamCrossedSpecifications = (
  record: ProductRecord, attribute: Attribute, candidates: Candidate[]
): void => {
  const stacker = mislabelledStacker(record);
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
  const palletBattery = mislabelledPalletBattery(record);
  if (!palletBattery) return;
  const capacity = record.specs?.["Capacidad de la batería"];
  const weight = record.specs?.["Peso"];
  const duplicatedWeight = typeof capacity === "string" && typeof weight === "string" &&
    /^[1-9]\d{2,4}$/.test(capacity) && weight.toUpperCase() === `${capacity} KG`;
  if (attribute.name === "Batería (V / Ah)" && attribute.type === "TEXT" && attribute.unit_option === "V / Ah" &&
    record.specs?.["Batería (V / Ah)"] === undefined && (capacity === undefined || duplicatedWeight)) {
    const value = batteryValue(palletBattery);
    if (value !== null) candidates.push({ key: attribute.name, value });
  }
};

export const gamMislabelledSpecKey = (record: ProductRecord, attribute: Attribute, rawKey: string): boolean => {
  if (mislabelledStacker(record)) {
    if (attribute.name === "Centro de carga" && attribute.unit_option === "mm" && rawKey === "Centro de carga") return true;
    if (attribute.name === "Radio de giro" && attribute.unit_option === "mm" && rawKey === "Radio de giro") return true;
  }
  return attribute.name === "Altura de plataforma" && attribute.unit_option === "m" &&
    rawKey === "Altura Plataforma" && mislabelledPalletBattery(record) !== null;
};
