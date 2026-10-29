import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute } from "../../attribute-types.js";
import { fold, scalar } from "../../attribute-utils.js";
import { gamBasketDimensionsFromDescription, gamBasketDimensionsFromRepeatedFragments } from "./basket.js";
import { gamElevationIdentityConflict } from "../../../evidence/providers/gam/elevation-identity.js";
import { gamHandlingModelEvidence, relevantGamHandlingRecord } from "./handling.js";

const singleSpec = (record: ProductRecord, keys: readonly string[]): string | null => {
  const matching = Object.entries(record.specs ?? {}).filter(([key]) => keys.includes(fold(key)));
  if (matching.length !== 1 || !matching[0]) return null;
  const value = scalar(matching[0][1]);
  return typeof value === "string" ? value.trim() : null;
};

const unrepresentableBasket = (record: ProductRecord): boolean => {
  if (gamElevationIdentityConflict(record)) return false;
  const raw = singleSpec(record, ["dimensiones cesta", "dimensiones de la cesta"]);
  if (!raw || gamBasketDimensionsFromDescription(record, raw) !== null ||
    gamBasketDimensionsFromRepeatedFragments(raw) !== null) return false;
  const dimensionText = raw.match(/^(\d[\d x×]*)\s+metros?$/i)?.[1];
  if (!dimensionText) return false;
  const sections = dimensionText.split(/[x×]/i).map((part) => part.trim());
  const fragmented = sections.length === 2 && sections.every((part) => /^\d+(?:\s+\d+)*$/.test(part)) &&
    sections.some((part) => /\d+\s+\d+/.test(part));
  const impossibleMetres = sections.length === 3 && sections.every((part) => /^\d{3,4}$/.test(part) && Number(part) >= 100);
  if (!fragmented && !impossibleMetres) return false;
  const prose = [record.shortDescription, record.longDescription].filter((value): value is string => typeof value === "string");
  if (prose.some((value) => /\b(?:cesta\s+(?:(?:tiene|con)\s+)?dimensiones|dimensiones\s+de\s+(?:la\s+)?cesta)\s+(?:de\s+)?\d/i.test(fold(value)))) {
    return false;
  }
  return true;
};

const confirmedHandling = (record: ProductRecord): boolean =>
  record.categoryKey === "carretillas-nuevas" && relevantGamHandlingRecord(record) &&
  gamHandlingModelEvidence(record, record.title ?? "") &&
  gamHandlingModelEvidence(record, record.shortDescription ?? "");

const unrepresentableLiftHeight = (record: ProductRecord): boolean => {
  if (!confirmedHandling(record)) return false;
  const raw = singleSpec(record, ["altura de elevacion (mm)", "altura de elevacion (m)", "altura elevacion (industr.)"]);
  if (!raw) return false;
  if (/^#VALUE!\s*mm$/i.test(raw)) return true;
  if (record.condition !== "Nuevo" || !/^\d{4}\s*\/\s*\d{4}\s*mm$/i.test(raw)) return false;
  const mast = singleSpec(record, ["tipo mastil"]);
  const retracted = singleSpec(record, ["altura de replegado"]);
  return mast !== null && /\bduplex\b/i.test(fold(mast)) && /\btriplex\b/i.test(fold(mast)) &&
    mast.split("/").length > 1 && retracted !== null && /^\d{4}\s*\/\s*\d{4}\s*mm$/i.test(retracted);
};

const unrepresentableMast = (record: ProductRecord): boolean => {
  if (!confirmedHandling(record) || record.condition !== "Nuevo") return false;
  const mast = singleSpec(record, ["tipo mastil"]);
  const height = singleSpec(record, ["altura elevacion (industr.)", "altura de elevacion (mm)"]);
  return mast !== null && height !== null && /^\d{4}\s*\/\s*\d{4}\s*mm$/i.test(height) &&
    /\bduplex\b/i.test(fold(mast)) && /\btriplex\b/i.test(fold(mast)) && mast.split("/").length > 1;
};

const unrepresentableTurretRotation = (record: ProductRecord): boolean => {
  if (gamElevationIdentityConflict(record)) return false;
  const raw = singleSpec(record, ["rotacion de torreta"]);
  return raw !== null && /^(\d{1,3})\s*[°º]\s*\+\s*\1\s*[°º]$/.test(raw) &&
    Number(raw.match(/^\d+/)?.[0] ?? 0) > 0 && Number(raw.match(/^\d+/)?.[0] ?? 0) <= 360;
};

const unrepresentableTurningRadius = (record: ProductRecord): boolean => {
  if (record.categoryKey !== "carretillas-nuevas" || record.condition !== "Nuevo" ||
    fold(record.brand ?? "") !== "yale" || fold(String(record.specs?.["Marca"] ?? "")) !== "yale") return false;
  const model = typeof record.specs?.["Modelo"] === "string" ? fold(record.specs["Modelo"]) : "";
  if (!/^erp[\d.]/.test(model) || fold(record.model ?? "") !== model ||
    !fold(record.title ?? "").includes(model) || !fold(record.shortDescription ?? "").includes(model) ||
    !fold(record.longDescription ?? "").includes(model)) return false;
  const motor = record.specs?.["Motorización"] ?? record.specs?.["Tipo motor"];
  if (typeof motor !== "string" || fold(motor) !== "electrico") return false;
  try {
    const url = new URL(record.url);
    const route = url.pathname.split("/").filter(Boolean)[1];
    if (url.hostname !== "online.gamrentals.com" ||
      !["carretillas-elevadoras-electricas-yale", "yale"].includes(route ?? "")) return false;
  } catch { return false; }
  const raw = singleSpec(record, ["radio de giro"]);
  const values = raw?.match(/^(\d{1,4}(?:[.,]\d+)?)\s*\/\s*(\d{1,4}(?:[.,]\d+)?)$/);
  if (!values?.[1] || !values[2]) return false;
  const first = Number(values[1].replace(",", "."));
  const second = Number(values[2].replace(",", "."));
  return first > 0 && second > 0 && first !== second;
};

const unrepresentableLoadCentre = (record: ProductRecord): boolean => {
  if (record.categoryKey !== "carretillas-nuevas" || record.condition !== "Nuevo" ||
    !gamHandlingModelEvidence(record, record.title ?? "") ||
    !gamHandlingModelEvidence(record, record.shortDescription ?? "") ||
    !gamHandlingModelEvidence(record, record.longDescription ?? "")) return false;
  let route = "";
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com") return false;
    route = url.pathname.split("/").filter(Boolean)[1] ?? "";
  } catch { return false; }
  if (route !== "carretillas-elevadoras-diesel-hyster") return false;
  const raw = singleSpec(record, ["centro de carga", "centro de carga (mm)"]);
  const matched = raw?.match(/^(\d{3,4})\s*[-–]\s*(\d{3,4})\s*mm$/i);
  if (!matched?.[1] || !matched[2]) return false;
  const first = Number(matched[1]);
  const second = Number(matched[2]);
  if (first < 300 || second > 2500 || first === second) return false;
  return ![record.shortDescription, record.longDescription].some((value) =>
    typeof value === "string" && /\bcentro\s+de\s+carga\s+(?:de\s+)?\d/.test(fold(value)));
};

const unrepresentableLoadCapacity = (record: ProductRecord): boolean => {
  if (record.categoryKey !== "marcas-nuevas" || record.condition !== "Nuevo" ||
    fold(record.brand ?? "") !== "logitrans" || fold(String(record.specs?.["Marca"] ?? "")) !== "logitrans") return false;
  let route = "";
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com" || url.pathname.split("/").filter(Boolean)[0] !== "es") return false;
    route = url.pathname.split("/").filter(Boolean)[1] ?? "";
  } catch { return false; }
  if (route !== "transpaletas-logitrans") return false;
  const model = typeof record.specs?.["Modelo"] === "string" ? fold(record.specs["Modelo"]) : "";
  if (!model || model !== fold(record.model ?? "") ||
    !fold(record.title ?? "").includes(model) || !fold(record.shortDescription ?? "").includes(model) ||
    !/\btranspaleta\b/.test(fold(record.title ?? ""))) return false;
  const raw = singleSpec(record, ["capacidad de carga (kg)"]);
  const measures = raw?.match(/^((?:\d{3,4}\s*[/–-]\s*){1,3}\d{3,4})\s*kg$/i);
  if (!measures?.[1]) return false;
  const options = measures[1].split(/\s*[/–-]\s*/).map(Number);
  if (options.some((value) => value < 100 || value > 5000) || new Set(options).size !== options.length) return false;
  if (Object.keys(record.specs ?? {}).some((key) => fold(key) === "capacidad de carga")) return false;
  for (const paragraph of [record.shortDescription, record.longDescription]) {
    if (!paragraph) continue;
    const text = fold(paragraph);
    const mentioned = [...text.matchAll(/\bcapacidad\s+(?:nominal\s+)?de\s+carga\s+(?:de\s+)?([\d\s/–-]+)\s*kg\b/g)];
    for (const match of mentioned) {
      const declared = match[1]?.trim().split(/\s*[/–-]\s*/).map(Number) ?? [];
      if (declared.length !== options.length || declared.some((value, index) => value !== options[index])) return false;
    }
  }
  return true;
};

const unrepresentableOrderPickerVariant = (record: ProductRecord, attribute: Attribute): boolean => {
  if (record.condition !== "Nuevo" || !["Peso", "Peso operativo", "Altura de plataforma"].includes(attribute.name) ||
    !["hyster", "yale"].includes(fold(record.brand ?? "")) ||
    !["carretillas-nuevas", "marcas-nuevas"].includes(record.categoryKey)) return false;
  let family = "";
  try {
    const url = new URL(record.url);
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || segments[0] !== "es") return false;
    family = segments[1] ?? "";
  } catch { return false; }
  if (!["recogepedidos-hyster", "recogepedidos-yale"].includes(family) &&
    !(family === "yale" && fold(record.brand ?? "") === "yale" &&
      /\b(?:recogepedidos|preparapedidos)\b/.test(fold(record.title ?? "")))) return false;
  if (!gamHandlingModelEvidence(record, record.title ?? "") ||
    !gamHandlingModelEvidence(record, record.shortDescription ?? "") ||
    !gamHandlingModelEvidence(record, record.longDescription ?? "") ||
    fold(String(record.specs?.["Modelo"] ?? "")) !== fold(record.model ?? "")) return false;
  const specs = record.specs ?? {};
  const weight = singleSpec(record, ["peso"]);
  const height = singleSpec(record, ["altura plataforma"]);
  if (!weight || !height) return false;
  const weightOptions = weight.match(/^([1-9]\d{2,4}(?:\s*\/\s*[1-9]\d{2,4}){1,3})\s*kg$/i)?.[1];
  const platformOptions = height.match(/^\s*-\s*\/\s*\d{3,4}(?:\s*\/\s*\d{3,4})?\s*m{0,4}\s*metros?$/i);
  if (!weightOptions || !platformOptions) return false;
  const values = weightOptions.split(/\s*\/\s*/).map(Number);
  if (new Set(values).size !== values.length || values.some((value) => value < 250 || value > 5000)) return false;
  if ([record.shortDescription, record.longDescription].some((text) =>
    typeof text === "string" && /\bpeso\s+(?:operativo\s+)?(?:de\s+)?\d/iu.test(fold(text)))) return false;
  if (attribute.name === "Altura de plataforma") {
    return attribute.unit_option === "m" && specs["Altura de plataforma"] === undefined &&
      specs["Altura plataforma (mm)"] === undefined && specs["Altura plataforma (m)"] === undefined;
  }
  return attribute.unit_option === "kg" && specs["Peso (kg)"] === undefined;
};

const gamSourceFamily = (record: ProductRecord): string | null => {
  try {
    const parsed = new URL(record.url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parsed.hostname === "online.gamrentals.com" && parts[0] === "es" ? parts[1] ?? null : null;
  } catch {
    return null;
  }
};

const unrepresentableTecnacarLoad = (record: ProductRecord): boolean => {
  if (record.condition !== "Nuevo" || !["marcas-nuevas", "otros-nuevos"].includes(record.categoryKey) ||
    fold(record.brand ?? "") !== "tecna" || fold(String(record.specs?.["Marca"] ?? "")) !== "tecna" ||
    !["tractores-electricos-de-carga-tecnacar", "tractores-arrastre-nuevos"].includes(gamSourceFamily(record) ?? "") ||
    record.specs?.["Capacidad de carga (kg)"] !== "1500 / 2000 KG" ||
    record.specs?.["Capacidad de carga"] !== undefined) return false;
  const model = fold(record.model ?? "").replace(/[^a-z0-9]/g, "");
  const published = fold(String(record.specs?.["Modelo"] ?? "")).replace(/[^a-z0-9]/g, "");
  if (!/^vca4(?:12|15|20|25)$/.test(model) || published !== model) return false;
  return [record.title, record.shortDescription].every((part) =>
    fold(part ?? "").replace(/[^a-z0-9]/g, "").includes(model)) &&
    /\btractor\s+electrico\s+de\s+arrastre\b/.test(fold(record.shortDescription ?? ""));
};

const unrepresentableYalePlatform = (record: ProductRecord): boolean =>
  record.condition === "Nuevo" && record.categoryKey === "marcas-nuevas" &&
  fold(record.brand ?? "") === "yale" && fold(String(record.specs?.["Marca"] ?? "")) === "yale" &&
  fold(record.model ?? "") === "ms20xd" && fold(String(record.specs?.["Modelo"] ?? "")) === "ms20xd" &&
  gamSourceFamily(record) === "apiladores-yale" &&
  [record.title, record.shortDescription, record.longDescription].every((part) =>
    fold(part ?? "").includes("ms20xd")) &&
  record.specs?.["Altura Plataforma"] === "4.8mm metros" &&
  record.specs?.["Altura de plataforma"] === undefined &&
  record.specs?.["Altura plataforma (mm)"] === undefined &&
  record.specs?.["Altura plataforma (m)"] === undefined;

export const gamConfirmedAbsentScalar = (record: ProductRecord, attribute: Attribute): boolean => {
  if (record.providerId !== "gam") return false;
  if (unrepresentableOrderPickerVariant(record, attribute)) return true;
  if (attribute.name === "Capacidad de carga" && attribute.type === "NUMBER" && attribute.unit_option === "kg" &&
    unrepresentableTecnacarLoad(record)) return true;
  if (attribute.name === "Altura de plataforma" && attribute.type === "NUMBER" && attribute.unit_option === "m" &&
    unrepresentableYalePlatform(record)) return true;
  if (attribute.name === "Radio de giro" && attribute.type === "NUMBER" && attribute.unit_option === "mm") {
    return unrepresentableTurningRadius(record);
  }
  if (attribute.name === "Centro de carga" && attribute.type === "NUMBER" && attribute.unit_option === "mm") {
    return unrepresentableLoadCentre(record);
  }
  if (attribute.name === "Capacidad de carga" && attribute.type === "NUMBER" && attribute.unit_option === "kg") {
    return unrepresentableLoadCapacity(record);
  }
  if (attribute.name === "Dimensiones de la cesta") return unrepresentableBasket(record);
  if (attribute.name === "Rotación de torreta" && attribute.type === "NUMBER" && attribute.unit_option === "grados") {
    return unrepresentableTurretRotation(record);
  }
  if (attribute.name === "Altura de elevación" && attribute.type === "NUMBER" && attribute.unit_option === "mm") {
    return unrepresentableLiftHeight(record);
  }
  if (attribute.name === "Tipo de mástil" && attribute.type === "SELECT") return unrepresentableMast(record);
  return false;
};
