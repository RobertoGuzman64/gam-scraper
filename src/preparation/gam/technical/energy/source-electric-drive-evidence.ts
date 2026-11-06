import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { normalizedElectricalIdentity, verifiedGamElectricalIdentity } from "../../identity/evidence/electrical-identity-evidence.js";

const electric = /\bel[eé]ctric[oa]s?\b/iu;
const alternativeFuel = /\b(?:di[eé]sel|gasolina|glp|h[ií]brid[oa]s?)\b/iu;
const conditionalDrive = /\b(?:opci[oó]n|opcional(?:es)?|alternativ[oa]s?|disponible\s+(?:con|en)|puede\s+(?:ser|equiparse|funcionar))\b[^.!?;\n]{0,80}\bel[eé]ctric[oa]s?\b/iu;
const conditionalDriveSuffix = /\bel[eé]ctric[oa]s?\s+(?:es\s+)?(?:opcional(?:es)?|una\s+opci[oó]n|no\s+incluid[oa]s?)\b/iu;
const deniedDrive = /\b(?:no|sin)\s+(?:es\s+|funcionamiento\s+|motorizaci[oó]n\s+)?el[eé]ctric[oa]s?\b/iu;
const existingDriveKey = /(?:motoriz|tipo\s*(?:de\s*)?motor|propulsi[oó]n|combustible)/iu;

const includesIdentity = (text: string, brand: string, model: string): boolean => {
  const normalized = normalizedElectricalIdentity(text);
  return normalized.includes(brand) && normalized.includes(model);
};

export const recoverGamSourceElectricDrive = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!verifiedGamElectricalIdentity(record) ||
    !["elevacion-nueva", "carretillas-nuevas", "apiladores-nuevos", "otros-nuevos", "marcas-nuevas"].includes(record.categoryKey) ||
    Object.keys(specs).some((key) => existingDriveKey.test(key)) ||
    Object.keys(record.specs ?? {}).some((key) => existingDriveKey.test(key))) return specs;

  const brand = normalizedElectricalIdentity(record.brand ?? "");
  const model = normalizedElectricalIdentity(record.model ?? "");
  const title = record.title ?? "";
  const short = record.shortDescription ?? "";
  const long = record.longDescription ?? "";
  const lead = long.slice(0, 350);

  if (![title, short, lead].every((part) =>
    electric.test(part) && includesIdentity(part, brand, model) && !alternativeFuel.test(part)) ||
    alternativeFuel.test(long) || conditionalDrive.test(long) || conditionalDriveSuffix.test(long) || deniedDrive.test(long)) return specs;

  return { ...specs, "Motorización": "Eléctrico" };
};
