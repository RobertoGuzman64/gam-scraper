import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { SPEC_KEY_NORMALIZATION } from "../../../../normalization/spec-rules.js";
import type { AliasOutcome, Attribute, Candidate } from "../../attribute-types.js";
import { fold, basketDimensions, numberToken, scalar } from "../../attribute-utils.js";
import { gamWorkingHeightFromDescription } from "./working-height.js";
import { gamBasketDimensionsFromDescription, gamBasketDimensionsFromRepeatedFragments } from "./basket.js";
import { gamElevationIdentityConflict } from "./elevation-identity.js";
import { gamCleaningCandidate, gamCleaningCorrectedWidth, gamCleaningWidthConflicts } from "./cleaning.js";
import { gamHandlingCandidate, normalizeGamMast } from "./handling.js";
import { gamHandlingAmbiguousCapacity, gamHandlingAttributeConflicts } from "./handling-integrity.js";
import { gamHandlingReconciledCapacity } from "./capacity-evidence.js";
import { gamElevationCandidate, gamElevationHeightConflicts } from "./elevation.js";
import { gamSpecializedCandidate } from "./specialized.js";
import { gamGeneratorCandidate, isGamGenerator } from "./generator.js";

export const gamUnspecifiedTurningRadius = (record: ProductRecord): boolean => {
  if (record.categoryKey !== "carretillas-nuevas" || record.condition !== "Nuevo" ||
    fold(record.brand ?? "") !== "yale") return false;
  const raw = record.specs?.["Radio de giro"];
  const model = record.specs?.["Modelo"];
  if (typeof raw !== "string" || typeof model !== "string") return false;
  const values = raw.trim().match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!values?.[1] || !values[2]) return false;
  const first = Number(values[1]);
  const second = Number(values[2]);
  if (first < 1000 || first > 10000 || second < 1000 || second > 10000 ||
    Math.abs(first - second) < 1 || Math.max(first, second) / Math.min(first, second) > 1.2) return false;
  let route = "";
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com") return false;
    route = url.pathname.split("/").filter(Boolean)[1] ?? "";
  } catch { return false; }
  if (route !== "carretillas-elevadoras-electricas-yale") return false;
  const normalizedModel = fold(model);
  if (record.model?.trim() && fold(record.model) !== normalizedModel) return false;
  const matcher = new RegExp(`(?:^|[^a-z0-9])${normalizedModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`);
  return [record.title, record.shortDescription, record.longDescription].every((text) =>
    typeof text === "string" && matcher.test(fold(text)));
};

export const applyGamAliasesDetailed = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): AliasOutcome => {
  if (attribute.name === "Dimensiones de la cesta") keys.add(fold("Dimensiones Cesta"));
  if (attribute.name === "Batería (V / Ah)" && attribute.type === "TEXT" && attribute.unit_option === "V / Ah" &&
    !Object.keys(record.specs ?? {}).some((key) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key)))) {
    const published = record.specs?.["Capacidad de la batería"];
    const raw = published === undefined ? null : scalar(published);
    if (typeof raw === "string") {
      const match = raw.trim().match(/^([1-9]\d*)\s*V\s*\/\s*([1-9]\d*)\s*Ah\s*\(\s*V\s*\/\s*Ah\s*\)$/i);
      if (match?.[1] && match[2]) candidates.push({ key: attribute.name, value: `${match[1]} V / ${match[2]} Ah` });
    }
  }
  if (record.providerId === "gam" && attribute.name === "Motorización / Energía" &&
    attribute.type === "SELECT" && fold(attribute.unit_option) === "electrico") {
    const motor = record.specs?.["Tipo motor"];
    const hasDirectValue = Object.keys(record.specs ?? {}).some((key) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key)));
    let trustedSource = false;
    try {
      const url = new URL(record.url);
      trustedSource = url.hostname === "online.gamrentals.com" && url.pathname.startsWith("/es/");
    } catch { trustedSource = false; }
    if (trustedSource && typeof motor === "string" && fold(motor) === "electrico" &&
      record.specs?.["Motorización"] === undefined && !hasDirectValue &&
      !/\b(?:diesel|glp|gasolina|hibrid[oa]|manual)\b/.test(fold(`${record.title ?? ""} ${record.shortDescription ?? ""}`))) {
      candidates.push({ key: attribute.name, value: "Eléctrico" });
    }
  }
  if (["Centro de carga", "Elevación libre", "Radio de giro"].includes(attribute.name)) {
    keys.add(fold(`${attribute.name} (mm)`));
  }
  if (attribute.name === "Elevación libre") {
    const observed = Object.entries(record.specs ?? {}).filter(([key]) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))
    ).map(([, spec]) => scalar(spec));
    const denied = observed.some((value) => typeof value === "string" && fold(value) === "no");
    const measured = observed.some((value) => typeof value === "number" && value > 0 ||
      typeof value === "string" && /^[1-9]\d*(?:[.,]\d+)?\s*(?:mm|cm|m)?$/i.test(value.trim()));
    if (denied && measured) return "contradiction";
  }
  let family = "";
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.hostname === "online.gamrentals.com" && path[0] === "es") family = path[1] ?? "";
  } catch { family = ""; }
  if (gamElevationIdentityConflict(record)) {
    if (attribute.name === "Modelo") return "rejected";
    if (["Altura de trabajo", "Altura de plataforma", "Alcance horizontal", "Altura de elevación"].includes(attribute.name)) {
      return "rejected";
    }
    if (["Capacidad de la cesta", "Dimensiones de la cesta", "Pendiente superable"].includes(attribute.name)) {
      const published = Object.keys(record.specs ?? {}).some((key) =>
        keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))
      );
      if (published || gamElevationCandidate(record, attribute)) return "rejected";
    }
  }
  if (family && attribute.name === "Altura de trabajo" && attribute.type === "NUMBER") {
    const hasDirectValue = Object.entries(record.specs ?? {}).some(([key, value]) =>
      (keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))) && scalar(value) !== null
    );
    if (!hasDirectValue) {
      const height = gamWorkingHeightFromDescription(record);
      if (height !== null) candidates.push({ key: "Altura de trabajo", value: height });
    }
  }
  if (attribute.name === "Ancho de trabajo" && gamCleaningWidthConflicts(record)) return "contradiction";
  if (["Alimentación", "Tipo de conductor", "Ancho de trabajo"].includes(attribute.name)) {
    const hasDirectValue = Object.entries(record.specs ?? {}).some(([key, value]) =>
      (keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))) && scalar(value) !== null
    );
    if (!hasDirectValue) {
      const candidate = gamCleaningCandidate(record, attribute);
      if (candidate) candidates.push(candidate);
    }
  }
  if (["Altura de plataforma", "Alcance horizontal", "Capacidad de la cesta", "Tipo de tracción"].includes(attribute.name)) {
    const hasDirectValue = Object.entries(record.specs ?? {}).some(([key]) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))
    );
    if (!hasDirectValue) {
      const candidate = gamElevationCandidate(record, attribute);
      if (candidate) candidates.push(candidate);
    }
  }
  if (attribute.name === "Altura de elevación" && attribute.unit_option === "mm") {
    if (gamElevationHeightConflicts(record)) return "contradiction";
    keys.add(fold("Altura Elevación (Industr.)"));
  }
  if (gamHandlingAttributeConflicts(record, attribute)) return "contradiction";
  if (attribute.name === "Capacidad de carga" && gamHandlingAmbiguousCapacity(record)) return "rejected";
  if (attribute.name === "Potencia" && isGamGenerator(record)) {
    keys.delete(fold("Potencia (kW)"));
    const generatorPower = gamGeneratorCandidate(record, attribute);
    if (!generatorPower) return "rejected";
    candidates.push(generatorPower);
  }
  if (["Tipo de mástil", "Altura de elevación", "Capacidad de carga", "Marca", "Modelo", "Motorización / Energía"].includes(attribute.name)) {
    const hasDirectValue = Object.entries(record.specs ?? {}).some(([key]) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))
    );
    if (!hasDirectValue) {
      const candidate = gamHandlingCandidate(record, attribute);
      if (candidate) candidates.push(candidate);
    }
  }
  if (["Capacidad máxima", "Altura máxima de elevación", "Motorización / Energía", "Marca", "Modelo"].includes(attribute.name)) {
    const hasDirectValue = Object.entries(record.specs ?? {}).some(([key]) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))
    );
    const missingIdentity = attribute.name === "Marca" && !record.brand?.trim() ||
      attribute.name === "Modelo" && !record.model?.trim();
    if (!hasDirectValue || missingIdentity) {
      const candidate = gamSpecializedCandidate(record, attribute);
      if (candidate) candidates.push(candidate);
    }
  }
  if (family === "manipuladores-frontales-segunda-mano") {
    if (attribute.name === "Capacidad máxima") keys.add(fold("Capacidad de carga (kg)"));
    if (attribute.name === "Altura máxima de elevación") keys.add(fold("Altura de elevación (m)"));
  }
  return "accepted";
};

export const applyGamAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): boolean =>
  applyGamAliasesDetailed(record, attribute, keys, candidates) === "accepted";

export const isGamUnmeasuredNumeric = (attribute: Attribute, value: string | number | boolean): boolean => {
  if (typeof value !== "string") return false;
  const normalized = fold(value);
  if (attribute.name === "Horas de uso") return normalized === "na horas" || normalized === "horometro sustituido horas" ||
    /^na\s+[a-z]\d{8,20}\s+horas$/.test(normalized);
  if (attribute.name === "Elevación libre") return normalized === "si" || normalized === "no";
  return false;
};

export const convertGamCandidate = (
  record: ProductRecord, attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (attribute.name === "Tipo de mástil" && attribute.type === "SELECT") return normalizeGamMast(fallback);
  if (attribute.name === "Capacidad de carga" && attribute.type === "NUMBER" && attribute.unit_option === "kg") {
    return gamHandlingReconciledCapacity(record) ?? fallback;
  }
  if (attribute.name === "Ancho de trabajo" && attribute.unit_option === "mm" && typeof fallback === "number") {
    return gamCleaningCorrectedWidth(record) ?? Math.round(fallback * 1000) / 1000;
  }
  if (attribute.name === "Centro de carga" && attribute.unit_option === "mm" &&
    fallback === null && typeof candidate.value === "string") {
    const duplicatedUnit = candidate.value.trim().match(/^([\d.,\s]+)\s*mm\s+mm$/i);
    if (duplicatedUnit?.[1]) return numberToken(duplicatedUnit[1]);
  }
  if (attribute.name === "Dimensiones de la cesta") {
    const normalized = basketDimensions(candidate.value);
    if (normalized !== null || typeof candidate.value !== "string") return normalized;
    return gamBasketDimensionsFromDescription(record, candidate.value) ?? gamBasketDimensionsFromRepeatedFragments(candidate.value);
  }
  if (attribute.name === "Rotación de torreta" && attribute.type === "NUMBER" && attribute.unit_option === "grados" &&
    typeof candidate.value === "string") {
    const angle = candidate.value.trim().match(/^(\d+(?:[.,]\d+)?)\s*[°º]$/);
    return angle?.[1] ? numberToken(angle[1]) : fallback;
  }
  return fallback;
};
