import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { verifiedGamElectricalIdentity } from "../identity/electrical-identity-evidence.js";

const clearBraking = /\b(?:frenad[oa]|frenos?)\s+regenerativ[oa]s?\b/iu;
const uncertainBraking = /\b(?:sin|no\s+(?:incluye|dispone\s+de|incorpora|tiene|cuenta\s+con)|carece\s+de|opci[oó]n|opcional(?:es)?|version(?:es)?|puede\s+(?:incluir|incorporar|equiparse\s+con))\b[^.!?;\n]{0,80}\b(?:frenad[oa]|frenos?)\s+regenerativ[oa]s?\b/iu;
const uncertainBrakingSuffix = /\b(?:frenad[oa]|frenos?)\s+regenerativ[oa]s?\b[^.!?;\n]{0,30}\b(?:opcional(?:es)?|no\s+incluid[oa]s?)\b/iu;

export const hasGamSourceRegenerativeBraking = (record: ProductRecord): boolean =>
  verifiedGamElectricalIdentity(record) &&
  ["carretillas-nuevas", "apiladores-nuevos", "marcas-nuevas"].includes(record.categoryKey) &&
  clearBraking.test(record.longDescription ?? "") &&
  !uncertainBraking.test(record.longDescription ?? "") &&
  !uncertainBrakingSuffix.test(record.longDescription ?? "");

export const recoverGamSourceRegenerativeBraking = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!hasGamSourceRegenerativeBraking(record) ||
    Object.keys(specs).some((key) => /^frenado regenerativo$/iu.test(key.trim()))) return specs;
  return { ...specs, "Frenado regenerativo": true };
};
