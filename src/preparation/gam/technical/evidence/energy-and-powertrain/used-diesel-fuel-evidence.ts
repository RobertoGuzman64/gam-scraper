import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { hasGamSourceUnitIdentity } from "../general-evidence/source-unit-identity.js";

const diesel = /\bdi[eé]sel\b/iu;
const alternativeFuel = /\b(?:el[eé]ctric[oa]s?|gasolina|glp|h[ií]brid[oa]s?|bifuel|dual\s*fuel)\b/iu;
const optionalDiesel = /\b(?:opci[oó]n\s+(?:de\s+)?|opcional(?:es)?\s+|alternativ[oa]s?\s+(?:de\s+)?|disponible\s+(?:con|en)\s+(?:versi[oó]n\s+)?)(?:motorizaci[oó]n\s+|motor\s+|propulsi[oó]n\s+)?di[eé]sel\b|\b(?:motorizaci[oó]n\s+|motor\s+)?di[eé]sel\s+(?:opcional(?:es)?|como\s+opci[oó]n)\b/iu;
const deniedDiesel = /\b(?:no|sin)\s+(?:motor\s+|motorizaci[oó]n\s+)?di[eé]sel\b/iu;
const existingFuel = /^(?:motorizaci[oó]n|tipo\s+(?:de\s+)?motor|combustible|propulsi[oó]n)$/iu;

export const recoverGamUsedDieselFuel = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!hasGamSourceUnitIdentity(record, record.longDescription ?? "") ||
    Object.keys(specs).some((key) => existingFuel.test(key)) ||
    Object.keys(record.specs ?? {}).some((key) => existingFuel.test(key))) return specs;

  let category: string;
  try {
    const url = new URL(record.url);
    category = url.pathname.split("/").filter(Boolean)[1] ?? "";
  } catch {
    return specs;
  }
  if (!/^(?:plataformas-elevadoras-(?:articuladas|tijera)|carretillas-elevadoras)-diesel-segunda-mano$/.test(category)) return specs;

  const parts = [record.title ?? "", record.shortDescription ?? "", record.longDescription ?? ""];
  if (!parts.every((part) => diesel.test(part) && !alternativeFuel.test(part) && !optionalDiesel.test(part) && !deniedDiesel.test(part))) return specs;

  return { ...specs, "Motorización": "Diésel" };
};
