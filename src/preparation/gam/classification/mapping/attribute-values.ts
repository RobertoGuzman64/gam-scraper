import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../../shared/classification/mapping/attribute-types.js";
import { fold, basketDimensions, numberToken } from "../../../shared/classification/mapping/attribute-utils.js";
import { gamBasketDimensionsFromDescription, gamBasketDimensionsFromRepeatedFragments } from "../../technical/measurements/basket.js";
import { gamCleaningCorrectedWidth } from "./cleaning.js";
import { normalizeGamMast } from "./handling.js";
import { gamHandlingReconciledCapacity } from "../../technical/measurements/capacity-evidence.js";
import { gamCompoundMeasure } from "../../technical/measurements/compound-measures.js";

export const isGamUnmeasuredNumeric = (attribute: Attribute, value: string | number | boolean): boolean => {
  if (typeof value !== "string") return false;
  const normalized = fold(value);
  if (attribute.name === "Horas de uso") return normalized === "na horas" || normalized === "horometro sustituido horas" ||
    normalized === "horometro sustituido" ||
    /^na\s+[a-z]\d{8,20}\s+horas$/.test(normalized);
  if (attribute.name === "Elevación libre") return normalized === "si" || normalized === "no";
  return false;
};

export const convertGamCandidate = (
  record: ProductRecord, attribute: Attribute, candidate: Candidate, fallback: string | number | boolean | null
): string | number | boolean | null => {
  if (attribute.name === "Tipo de mástil" && attribute.type === "SELECT") return normalizeGamMast(fallback);
  if (attribute.name === "Capacidad de carga" && attribute.type === "NUMBER" && attribute.unit_option === "kg") {
    return gamHandlingReconciledCapacity(record) ?? fallback ?? gamCompoundMeasure(record, attribute, candidate);
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
  return fallback ?? gamCompoundMeasure(record, attribute, candidate);
};
