import type { ProductRecord } from "../../contracts/catalog.js";
import type { Attribute, Candidate } from "../classification/attribute-types.js";
import { basketDimensions, fold, numberToken } from "../classification/attribute-utils.js";
import { manainSourceFamily, manainSourceDescriptionContradictsFamily, type ManainFamily } from "./source.js";
import { manainHorizontalReach } from "./domain-source.js";
import { editorialQuantityOf, formatEditorialQuantity } from "../editorial/measurements/editorial-measurements.js";
import { parseBatteryConfiguration } from "../../catalog/normalization/spec-parsers.js";
import { SPEC_KEY_NORMALIZATION } from "../../catalog/normalization/spec-rules.js";

const manainGeometryCandidate = (record: ProductRecord, family: ManainFamily, attribute: Attribute,
  keys: ReadonlySet<string>): Candidate | null => {
  if (!["Alcance horizontal", "Alcance máximo horizontal", "Extensión de plataforma", "Dimensiones de la cesta"].includes(attribute.name) ||
    manainSourceDescriptionContradictsFamily(record, family)) return null;
  if (Object.keys(record.specs ?? {}).some((key) => keys.has(fold(key)) ||
    keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key)))) return null;
  if (attribute.type === "NUMBER" && attribute.unit_option === "m") {
    if ((attribute.name === "Alcance horizontal" && family.startsWith("elevacion-")) ||
      (attribute.name === "Alcance máximo horizontal" && family === "manipulacion-manipulador")) {
      const reach = manainHorizontalReach(record);
      if (reach === null) return null;
      const lateralKeys = ["Alcance lateral", "Alcance Lateral"];
      if (lateralKeys.some((key) => record.specs?.[key] !== undefined) &&
        editorialQuantityOf(record.specs, lateralKeys, "m") !== reach) return null;
      return { key: attribute.name, value: reach };
    }
    if (attribute.name === "Extensión de plataforma" &&
      (family === "elevacion-tijera" || family === "elevacion-unipersonal" || family === "elevacion-mastil")) {
      const extension = editorialQuantityOf(record.specs, ["Longitud extensión"], "m");
      const length = editorialQuantityOf(record.specs, ["Longitud plataforma", "Longitud de plataforma"], "m");
      return extension !== null && length !== null && extension >= 0.1 && extension <= Math.min(length, 5)
        ? { key: attribute.name, value: extension } : null;
    }
  }
  if (attribute.name === "Dimensiones de la cesta" && attribute.type === "TEXT" &&
    attribute.unit_option === "m" && family.startsWith("elevacion-")) {
    if (family === "elevacion-camion-cesta" && ["Longitud cesta", "Ancho cesta", "Alto cesta"].some((key) => record.specs?.[key] !== undefined)) {
      if (["Longitud plataforma", "Longitud de plataforma", "Ancho plataforma", "Anchura de plataforma"].some((key) => record.specs?.[key] !== undefined) ||
        Object.keys(record.specs ?? {}).some((key) => (SPEC_KEY_NORMALIZATION[fold(key)] ?? key) === "Dimensiones cesta (mm)")) return null;
      const dimensions = ["Longitud cesta", "Ancho cesta", "Alto cesta"].map((key) => editorialQuantityOf(record.specs, [key], "m"));
      if (!dimensions.every((value): value is number => value !== null && value >= 0.4 && value <= 6)) return null;
      const formatted = basketDimensions(`${dimensions.map(formatEditorialQuantity).join(" x ")} m`);
      return formatted === null ? null : { key: attribute.name, value: formatted };
    }
    const length = editorialQuantityOf(record.specs, ["Longitud plataforma", "Longitud de plataforma"], "m");
    const width = editorialQuantityOf(record.specs, ["Ancho plataforma", "Anchura de plataforma"], "m");
    if (length === null || width === null || length < 0.4 || length > 12 || width < 0.4 || width > 6) return null;
    if (Object.keys(record.specs ?? {}).some((key) =>
      (SPEC_KEY_NORMALIZATION[fold(key)] ?? key) === "Dimensiones cesta (mm)")) return null;
    const dimensions = basketDimensions(`${formatEditorialQuantity(length)} x ${formatEditorialQuantity(width)} m`);
    return dimensions === null ? null : { key: attribute.name, value: dimensions };
  }
  return null;
};

const manainConfigurationCandidate = (record: ProductRecord, family: ManainFamily, attribute: Attribute,
  keys: ReadonlySet<string>): Candidate | null => {
  if (!["Tipo de tracción", "Longitud de horquillas"].includes(attribute.name) ||
    manainSourceDescriptionContradictsFamily(record, family) || Object.keys(record.specs ?? {}).some((key) =>
    keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key)))) return null;
  if (attribute.name === "Tipo de tracción" && attribute.type === "SELECT" &&
    attribute.unit_option.split(/\s+\/\s+/).includes("Ruedas") &&
    ["elevacion-tijera", "elevacion-brazo-articulado", "elevacion-brazo-telescopico", "movimiento-tierra-dumper"].includes(family)) {
    const traction = record.specs?.["Tracción"];
    const description = fold(`${record.title ?? ""} ${record.shortDescription ?? ""} ${record.longDescription ?? ""}`);
    if (typeof traction === "string" && /^4\s*[x×]\s*[24]$/u.test(fold(traction)) &&
      !/\b(?:orugas?|cadenas?|camion(?:es)?|manual(?:es)?)\b/u.test(description)) {
      return { key: "Tracción", value: "Ruedas" };
    }
  }
  if (attribute.name === "Longitud de horquillas" && attribute.type === "NUMBER" && attribute.unit_option === "mm" &&
    family.startsWith("manipulacion-")) {
    const raw = record.specs?.["Largo horquillas"];
    if (typeof raw !== "string" || !/^\d{3,4}\s*mm$/iu.test(raw.trim())) return null;
    const length = editorialQuantityOf(record.specs, ["Largo horquillas"], "mm");
    if (length !== null && length >= 400 && length <= 4000) return { key: "Largo horquillas", value: length };
  }
  return null;
};

export const applyManainAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): void => {
  const family = manainSourceFamily(record);
  if (!family) return;
  const geometry = manainGeometryCandidate(record, family, attribute, keys);
  if (geometry) candidates.push(geometry);
  const configuration = manainConfigurationCandidate(record, family, attribute, keys);
  if (configuration) candidates.push(configuration);
  if (attribute.name === "Elevación libre") keys.add(fold("Elevación libre (mm)"));
  if (attribute.name === "Altura de trabajo") keys.add(fold("Altura trabajo"));
  if (attribute.name === "Ancho de la máquina" && family === "movimiento-tierra-miniexcavadora") keys.add(fold("Ancho"));
  if (attribute.name === "Peso operativo" && family === "movimiento-tierra-miniexcavadora") keys.add(fold("Peso"));
  if (attribute.name === "Capacidad de la cesta" && family.startsWith("elevacion-")) keys.add(fold("Capacidad carga"));
  if (attribute.name === "Capacidad de carga" && !family.startsWith("elevacion-")) keys.add(fold("Capacidad carga"));
  if (family === "manipulacion-manipulador") {
    if (attribute.name === "Capacidad máxima") keys.add(fold("Capacidad carga"));
    if (attribute.name === "Altura máxima de elevación") keys.add(fold("Altura de elevacion max"));
  }
  if (attribute.name === "Capacidad del depósito" && family === "energia-grupo-electrogeno") keys.add(fold("Capacidad depósito"));
  if (!manainSourceDescriptionContradictsFamily(record, family) && attribute.type === "NUMBER" && attribute.unit_option === "mm") {
    if (attribute.name === "Altura mástil replegado" && ["manipulacion-carretilla", "manipulacion-retractil", "manipulacion-apilador"].includes(family)) {
      const raw = record.specs?.["Mastil replegado"];
      if (typeof raw === "string" && /^\d+(?:[.,]\d{1,2})?\s*(?:m|mm)$/iu.test(raw.trim())) keys.add(fold("Mastil replegado"));
    }
    if (attribute.name === "Ancho de la máquina" && ["movimiento-tierra-minicargadora", "movimiento-tierra-rodillo-compactador"].includes(family)) {
      const raw = record.specs?.Ancho;
      if (typeof raw === "string" && /^\d{3,4}\s*mm$/iu.test(raw.trim())) keys.add(fold("Ancho"));
    }
  }
  if (attribute.name === "Batería (V / Ah)" && attribute.type === "TEXT" && attribute.unit_option === "V / Ah" &&
    family.startsWith("manipulacion-") && !manainSourceDescriptionContradictsFamily(record, family) &&
    record.specs?.Motor === "Eléctrico" && !Object.keys(record.specs ?? {}).some((key) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key)) ||
      (key !== "Voltios" && /voltaje|voltios|capacidad (?:de la |de )?bateria|tension nominal de bateria/u.test(fold(key))))) {
    const raw = record.specs?.Bateria;
    const pair = typeof raw === "string" ? /^(?:litio\s+)?([1-9]\d*)\s*v\s*\/?\s*([1-9]\d*)\s*ah$/iu.exec(raw.trim()) : null;
    const voltage = record.specs?.Voltios;
    const explicitPair = voltage === undefined && pair?.[1] && pair[2] ? `${pair[1]} V / ${pair[2]} Ah` :
      typeof voltage === "string" && /^\d+\s*v$/iu.test(voltage.trim()) && typeof raw === "string" && /^\d+\s*ah$/iu.test(raw.trim())
        ? `${voltage.trim()} / ${raw.trim()}` : null;
    const configuration = parseBatteryConfiguration(explicitPair);
    if (configuration !== null) candidates.push({ key: attribute.name, value: configuration });
  }
  const rawMotor = record.specs?.Motor;
  if (typeof rawMotor !== "string") return;
  const motor = fold(rawMotor);
  if (attribute.name === "Motorización / Energía" && motor === "electrico" && attribute.unit_option === "Eléctrico") {
    candidates.push({ key: "Motor", value: "Eléctrico" });
  }
  if (attribute.name === "Combustible" && family === "energia-grupo-electrogeno" &&
    ["diesel", "gasolina", "electrico", "glp"].includes(motor)) {
    const allowed = motor === "diesel" ? "Diésel" : motor === "electrico" ? "Eléctrico" : motor === "glp" ? "GLP" : "Gasolina";
    candidates.push({ key: "Motor", value: allowed });
  }
};

export const isManainUnmeasuredNumeric = (record: ProductRecord, attribute: Attribute, value: string | number | boolean): boolean => {
  if (record.providerId !== "manain" || typeof value !== "string" ||
    (attribute.type !== "NUMBER" && attribute.type !== "DECIMAL")) return false;
  const normalized = fold(value);
  if (attribute.name === "Elevación libre" && attribute.unit_option === "mm") {
    return normalized === "si";
  }
  return (attribute.name === "Peso" || attribute.name === "Peso operativo") && attribute.unit_option === "kg" &&
    normalized === "kg";
};

export const convertManainCandidate = (
  record: ProductRecord, attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (record.providerId !== "manain" || typeof candidate.value !== "string") return fallback;
  if ((attribute.name === "Peso" || attribute.name === "Peso operativo") && attribute.unit_option === "kg" &&
    candidate.key === "Peso") {
    const found = /^(\d+)\.(\d{2})00\s*kg$/i.exec(candidate.value.trim());
    if (found?.[1] && found[2]) return numberToken(`${found[1]}.${found[2]}`);
  }
  if (!manainSourceFamily(record)) return fallback;
  if (attribute.name === "Horas de uso" && (candidate.key === "Horas" || candidate.key === "Horas de uso")) {
    const found = /^(\d+)\.0{4}$/.exec(candidate.value.trim());
    if (found?.[1]) return numberToken(found[1]);
  }
  if (manainSourceFamily(record) !== "energia-grupo-electrogeno") return fallback;
  if (attribute.name === "Potencia" && /kVA/.test(attribute.unit_option) && candidate.key === "Potencia") {
    const found = /^([\d., ]+)\s*kva(?:\s+kva)?$/i.exec(candidate.value.trim());
    return found?.[1] ? numberToken(found[1]) : fallback;
  }
  if (attribute.name === "Capacidad del depósito" && ["Capacidad depósito", "Capacidad del depósito"].includes(candidate.key)) {
    const found = /^([\d., ]+)\s*(?:l|litros?)$/i.exec(candidate.value.trim());
    return found?.[1] ? numberToken(found[1]) : fallback;
  }
  return fallback;
};
