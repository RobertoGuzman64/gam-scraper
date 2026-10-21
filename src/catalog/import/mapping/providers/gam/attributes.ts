import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, basketDimensions } from "../../attribute-utils.js";

export const applyGamAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): boolean => {
  if (attribute.name === "Dimensiones de la cesta") keys.add(fold("Dimensiones Cesta"));
  let family = "";
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.hostname === "online.gamrentals.com" && path[0] === "es") family = path[1] ?? "";
  } catch { family = ""; }
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
