import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../identity/source-variant-identity.js";

const yaleReferences = new Set(["5988", "5989", "5990", "5993", "5994", "5995", "5996", "5997"]);
const hysterReferences = new Set(["2093", "2095", "2058", "2060", "2064"]);
const existingTyres = /\b(?:neum[aá]ticos?|ruedas?|rodadura)\b/iu;
const size = "(\\d[\\d.,×x-]*PR)";
const yaleAxles = new RegExp(`\\bconfiguraci[oó]n est[aá]ndar, dispone de neum[aá]ticos delanteros de ${size} y traseros de ${size}\\b`, "giu");
const yaleSharedAxles = new RegExp(`\\bconfiguraci[oó]n est[aá]ndar, dispone de neum[aá]ticos delanteros y traseros de ${size}\\b`, "giu");
const hysterTyres = /\bruedas?\s+(?:(?:neum[aá]ticas?\s+dobles?|dobles?\s+neum[aá]ticas?)|neum[aá]ticas?(?:\s+industriales?\s+de\s+gran\s+dimensi[oó]n)?)\s+(?:de\s+)?(\d{1,2}\.\d{2}[-x]\d{2}(?:[- ]\d{2}PR)?)\b/giu;

const singleValue = (description: string, pattern: RegExp): string | null => {
  const values = [...description.matchAll(pattern)].map((match) => match[1]);
  const first = values[0];
  return first && values.length === 1 ? first : null;
};

export const recoverGamVerifiedTyreDimensions = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.condition !== "Nuevo" || record.categoryKey !== "carretillas-nuevas" || !record.reference ||
    !verifiedGamSourceVariant(record) || Object.keys(source).some((key) => existingTyres.test(key))) return source;

  const description = record.longDescription ?? "";
  if (record.brand === "YALE" && yaleReferences.has(record.reference)) {
    const frontRear = [...description.matchAll(yaleAxles)];
    const shared = [...description.matchAll(yaleSharedAxles)];
    if (frontRear.length === 1 && shared.length === 0 && frontRear[0]?.[1] && frontRear[0]?.[2]) {
      return { ...source, "Neumáticos": `Delanteros ${frontRear[0][1]}; traseros ${frontRear[0][2]} (configuración estándar)` };
    }
    if (shared.length === 1 && frontRear.length === 0 && shared[0]?.[1]) {
      return { ...source, "Neumáticos": `Delanteros y traseros ${shared[0][1]} (configuración estándar)` };
    }
  }
  if (record.brand === "HYSTER" && hysterReferences.has(record.reference)) {
    const value = singleValue(description, hysterTyres);
    if (value !== null) return { ...source, "Neumáticos": `${value} (ruedas neumáticas)` };
  }
  return source;
};
