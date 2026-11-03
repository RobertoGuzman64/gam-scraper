import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../../mapping/attribute-utils.js";
import { validMercaelevaTechnicalSource } from "../../../mapping/providers/mercaeleva/technical.js";

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");
const fuelKey = /^(?:tipo (?:de )?motor|motor|motorizacion|(?:tipo de )?combustible|propulsion)$/u;
const energy = /\b(?:electric[oa]|diesel|glp|gasolina|hibrid[oa]|bifuel)\b/gu;
const declaration = /\b(?:carretilla(?:\s+elevadora)?|transpalet(?:a)?|apilador)\s+(electric[oa]|diesel)\b/gu;
const conditional = /\b(?:sin|opcional(?:es)?|opcion|alternativ[oa]s?|puede|podria|no\s+(?:incluye|dispone|tiene|es))\b/u;
const sourceArticle = /^\s*ref\.?\s*([a-z0-9]+)\b/iu;
const capacity = /\b(\d{1,3}(?:[. ]\d{3})+|\d{3,5})\s*kg\b/gu;

const declaredFuel = (raw: string): "Eléctrico" | "Diesel" | null => {
  const text = fold(raw);
  if (conditional.test(text)) return null;
  const claims = [...text.matchAll(declaration)].map((match) => match[1]);
  const energies = [...text.matchAll(energy)].map((match) => match[0]);
  if (claims.length !== 1 || energies.length !== 1 || claims[0] !== energies[0]) return null;
  return claims[0] === "diesel" ? "Diesel" : "Eléctrico";
};

const sourceIdentity = (record: ProductRecord): boolean => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference || !record.brand || !record.model ||
    !record.title || !record.longDescription || !record.specs ||
    typeof record.specs.Marca !== "string" || typeof record.specs.Modelo !== "string" ||
    compact(record.specs.Marca) !== compact(record.brand) ||
    compact(record.specs.Modelo) !== compact(record.model) ||
    record.specs.Estado !== "Usado") return false;

  const article = record.specs["Artículo No."];
  const recorded = sourceArticle.exec(record.longDescription);
  if (typeof article !== "string" || !recorded?.[1] ||
    compact(recorded[1]) !== compact(article)) return false;

  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.search || url.hash || path.length !== 4 ||
      path[0] !== "es" || path[1] !== "for-sale" || path[2] !== "machine") return false;
    const slug = path[3];
    if (!slug || !slug.endsWith(`-${record.reference}`) ||
      compact(slug.slice(0, -record.reference.length - 1)) !== compact(`${record.brand}${record.model}`)) return false;
  } catch {
    return false;
  }

  const name = compact(`${record.brand}${record.model}`);
  return compact(record.title).includes(name) && compact(record.longDescription).includes(name);
};

const consistentCapacity = (record: ProductRecord): boolean => {
  const value = record.specs?.["Capacidad máxima de elevación"];
  if (value === undefined) return true;
  if (typeof value !== "string") return false;
  const specMatch = /^(\d{1,3}(?:[. ]\d{3})+|\d{3,5})\s*kg$/iu.exec(value.trim());
  const stated = specMatch?.[1] ? numberToken(specMatch[1]) : null;
  if (stated === null) return false;
  for (const text of [record.title ?? "", String(record.specs?.["Título adicional"] ?? ""), record.longDescription ?? ""]) {
    const amounts = [...fold(text).matchAll(capacity)].map((match) => match[1] ? numberToken(match[1]) : null);
    if (amounts.length !== 1 || amounts[0] !== stated) return false;
  }
  return true;
};

export const recoverMercaelevaSourceFuel = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!sourceIdentity(record) || !consistentCapacity(record) ||
    Object.keys(specs).some((key) => fuelKey.test(fold(key))) ||
    Object.keys(record.specs ?? {}).some((key) => fuelKey.test(fold(key)))) return specs;
  const additional = record.specs?.["Título adicional"];
  if (typeof additional !== "string") return specs;
  const titleFuel = declaredFuel(record.title ?? "");
  if (!titleFuel || declaredFuel(additional) !== titleFuel ||
    declaredFuel(record.longDescription ?? "") !== titleFuel) return specs;
  return { ...specs, "Tipo de motor": titleFuel };
};
