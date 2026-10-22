import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { SPEC_KEY_NORMALIZATION } from "../../../../normalization/spec-rules.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, basketDimensions, scalar } from "../../attribute-utils.js";
import { gamWorkingHeightFromDescription } from "./working-height.js";
import { gamCleaningCandidate } from "./cleaning.js";
import { gamHandlingCandidate, normalizeGamMast } from "./handling.js";
import { gamElevationCandidate } from "./elevation.js";
import { gamSpecializedCandidate } from "./specialized.js";

export const applyGamAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): boolean => {
  if (attribute.name === "Dimensiones de la cesta") keys.add(fold("Dimensiones Cesta"));
  let family = "";
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.hostname === "online.gamrentals.com" && path[0] === "es") family = path[1] ?? "";
  } catch { family = ""; }
  if (family && attribute.name === "Altura de trabajo" && attribute.type === "NUMBER") {
    const hasDirectValue = Object.entries(record.specs ?? {}).some(([key, value]) =>
      (keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))) && scalar(value) !== null
    );
    if (!hasDirectValue) {
      const height = gamWorkingHeightFromDescription(record);
      if (height !== null) candidates.push({ key: "Altura de trabajo", value: height });
      else {
        const candidate = gamElevationCandidate(record, attribute);
        if (candidate) candidates.push(candidate);
      }
    }
  }
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
    keys.add(fold("Altura Elevación (Industr.)"));
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
  if (["Capacidad máxima", "Altura máxima de elevación", "Motorización / Energía"].includes(attribute.name)) {
    const hasDirectValue = Object.entries(record.specs ?? {}).some(([key]) =>
      keys.has(fold(key)) || keys.has(fold(SPEC_KEY_NORMALIZATION[fold(key)] ?? key))
    );
    if (!hasDirectValue) {
      const candidate = gamSpecializedCandidate(record, attribute);
      if (candidate) candidates.push(candidate);
    }
  }
  if (family === "manipuladores-frontales-segunda-mano") {
    if (attribute.name === "Capacidad máxima") keys.add(fold("Capacidad de carga (kg)"));
    if (attribute.name === "Altura máxima de elevación") keys.add(fold("Altura de elevación (m)"));
  }
  return true;
};

export const convertGamCandidate = (
  attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (attribute.name === "Tipo de mástil" && attribute.type === "SELECT") return normalizeGamMast(fallback);
  return attribute.name === "Dimensiones de la cesta" && fold(candidate.key) === fold("Dimensiones Cesta")
    ? basketDimensions(candidate.value) : fallback;
};
