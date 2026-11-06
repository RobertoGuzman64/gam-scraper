import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

const normalize = (value: string): string => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const mentionsIdentity = (text: string, brand: string, model: string): boolean => {
  const normalized = normalize(text);
  return normalized.includes(normalize(brand)) && normalized.includes(normalize(model));
};

const sourceFuel = /\bpropulsad[oa]\s+por\s+(?:motor\s+)?glp\b/iu;
const competingFuel = /\b(?:propulsad[oa]\s+por|motor\s+(?:de\s+)?)\s*(?:di[eé]sel|gasolina|el[eé]ctric[oa])\b/iu;
const fuelSpecification = /^(?:motorizaci[oó]n|tipo\s+(?:de\s+)?motor|combustible|propulsi[oó]n)$/iu;

export const recoverGamUsedForkliftFuel = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (record.providerId !== "gam" || record.condition !== "Segunda mano" ||
    record.categoryKey !== "manutencion" || !record.reference ||
    !record.brand || !record.model ||
    Object.keys(specs).some((key) => fuelSpecification.test(key))) return specs;

  let url: URL;
  try {
    url = new URL(record.url);
  } catch {
    return specs;
  }
  const path = url.pathname.split("/").filter(Boolean);
  const slug = path[2];
  if (url.hostname !== "online.gamrentals.com" || url.search || url.hash ||
    path.length !== 3 || path[0] !== "es" ||
    path[1] !== "carretillas-elevadoras-glp-segunda-mano" ||
    !slug?.startsWith(`${record.reference}-`) ||
    !normalize(slug).includes(normalize(record.brand)) ||
    !normalize(slug).includes(normalize(record.model))) return specs;

  if (typeof specs["Marca"] !== "string" || typeof specs["Modelo"] !== "string" ||
    normalize(specs["Marca"]) !== normalize(record.brand) ||
    normalize(specs["Modelo"]) !== normalize(record.model)) return specs;
  const brand = record.brand;
  const model = record.model;
  const title = record.title ?? "";
  const short = record.shortDescription ?? "";
  const long = record.longDescription ?? "";
  if (![title, short, long].every((part) => mentionsIdentity(part, brand, model)) ||
    !/\bglp\b/iu.test(title) || !/\bglp\b/iu.test(short) ||
    !sourceFuel.test(long) || competingFuel.test(long)) return specs;

  return { ...specs, "Motorización": "GLP" };
};
