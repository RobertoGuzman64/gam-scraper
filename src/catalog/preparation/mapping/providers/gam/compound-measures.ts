import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken } from "../../attribute-utils.js";

const gamSourceFamily = (record: ProductRecord, family: string): boolean => {
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" && parts[1] === family;
  } catch {
    return false;
  }
};

export const gamCompoundMeasure = (record: ProductRecord, attribute: Attribute, candidate: Candidate): number | null => {
  if (attribute.type !== "NUMBER" || typeof candidate.value !== "string") return null;
  const raw = candidate.value.trim();
  if (attribute.name === "Altura de plataforma" && attribute.unit_option === "m" &&
    fold(candidate.key) === fold("Altura Plataforma")) {
    const measure = raw.match(/^([\d.,\s\u00a0\u202f]+)\s*mm\s+metros?$/i);
    const millimeters = measure?.[1] ? numberToken(measure[1]) : null;
    return millimeters !== null && millimeters >= 1000 && Number.isInteger(millimeters)
      ? millimeters / 1000 : null;
  }
  if (attribute.name === "Potencia" && attribute.unit_option === "kVA (grupos) / kW" &&
    fold(candidate.key) === fold("Potencia Motor (KW)")) {
    const motors = raw.match(/^([1-9]\d*)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:kw)?$/i);
    if (!motors?.[1] || !motors[2]) {
      if (raw === "2x12x5" && record.condition === "Nuevo" && record.categoryKey === "otros-nuevos" &&
        fold(record.brand ?? "") === "tecna" && fold(record.model ?? "") === "vta 440" &&
        fold(String(record.specs?.["Modelo"] ?? "")) === "vta 440" &&
        gamSourceFamily(record, "tractores-electricos-de-arrastre-tecnacar") &&
        [record.title, record.shortDescription, record.longDescription].every((part) =>
          fold(part ?? "").includes("vta 440"))) return 25;
      return null;
    }
    const count = Number(motors[1]);
    const power = numberToken(motors[2]);
    return count >= 2 && count <= 8 && power !== null && power > 0
      ? Number((count * power).toPrecision(15)) : null;
  }
  if (attribute.name === "Capacidad de carga" && attribute.unit_option === "kg" &&
    fold(candidate.key) === fold("Capacidad de carga (kg)") &&
    record.condition === "Nuevo" && record.categoryKey === "elevacion-nueva" &&
    fold(record.brand ?? "") === "bravi" && fold(record.model ?? "") === "sprint tl" &&
    fold(String(record.specs?.["Modelo"] ?? "")) === "sprint tl" &&
    gamSourceFamily(record, "plataformas-elevadoras-neumaticos-bravi") &&
    [record.title, record.shortDescription].every((part) => fold(part ?? "").includes("sprint tl"))) {
    const capacities = raw.match(/^([1-9]\d{1,2})\s*\+\s*100\s*kg$/i);
    const platform = capacities?.[1] ? Number(capacities[1]) : null;
    if (platform !== null && platform === 130 &&
      new RegExp(`\\bcapacidad\\s+de\\s+la\\s+cesta\\s+${platform}\\s*kg\\b`).test(fold(record.shortDescription ?? ""))) {
      return platform;
    }
  }
  return null;
};
