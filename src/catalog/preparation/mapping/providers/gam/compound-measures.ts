import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, numberToken } from "../../attribute-utils.js";

export const gamCompoundMeasure = (attribute: Attribute, candidate: Candidate): number | null => {
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
    if (!motors?.[1] || !motors[2]) return null;
    const count = Number(motors[1]);
    const power = numberToken(motors[2]);
    return count >= 2 && count <= 8 && power !== null && power > 0
      ? Number((count * power).toPrecision(15)) : null;
  }
  return null;
};
