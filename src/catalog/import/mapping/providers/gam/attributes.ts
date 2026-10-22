import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { SPEC_KEY_NORMALIZATION } from "../../../../normalization/spec-rules.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, basketDimensions, scalar } from "../../attribute-utils.js";
import { gamWorkingHeightFromDescription } from "./working-height.js";

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
): string | number | boolean | null =>
  attribute.name === "Dimensiones de la cesta" && fold(candidate.key) === fold("Dimensiones Cesta")
    ? basketDimensions(candidate.value) : fallback;
