import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { fold, numberToken } from "../mapping/attribute-utils.js";
import { gamUnreconciledBasketIssue } from "../reconciliation/gam-basket-dimensions.js";

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const modelToken = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

const fuelTypes = (value: string): Set<string> => {
  const normalized = fold(value);
  const found = new Set<string>();
  if (/\b(?:glp|lpg)\b/u.test(normalized)) found.add("glp");
  if (/\bdiesel\b/u.test(normalized)) found.add("diesel");
  if (/\belectrico\b/u.test(normalized)) found.add("electrico");
  if (/\bgasolina\b/u.test(normalized)) found.add("gasolina");
  return found;
};

const gamMotorIssue = (specs: SpecsMap): string | null => {
  const engine = specs["Tipo motor"];
  const drive = specs.Motorización;
  if (typeof engine !== "string" || typeof drive !== "string") return null;
  const engines = fuelTypes(engine);
  const drives = fuelTypes(drive);
  if (!engines.size || !drives.size || [...drives].some((fuel) => engines.has(fuel))) return null;
  return "Motorización contradictoria: tipo de motor y motorización estructurada incompatibles";
};

const gamBrandIssue = (record: ProductRecord, specs: SpecsMap): string | null => {
  if (!record.model || !record.brand || typeof specs.Marca !== "string" ||
    fold(specs.Marca) !== fold(record.brand) || !record.title ||
    modelToken(record.title).includes(modelToken(record.brand))) return null;
  const match = new RegExp(`(?:^|\\s)([\\p{L}][\\p{L}\\d&-]{2,})\\s+${escapeRegex(record.model)}(?=\\s|$)`, "iu")
    .exec(record.title);
  const candidate = match?.[1];
  if (!candidate || candidate[0] !== candidate[0]?.toUpperCase() ||
    fold(candidate) === fold(record.brand)) return null;
  const actualBrand = modelToken(record.brand);
  const titledBrand = modelToken(candidate);
  if (actualBrand.length === titledBrand.length + 1 &&
    [...actualBrand].some((_, index) => actualBrand.slice(0, index) + actualBrand.slice(index + 1) === titledBrand)) return null;
  let path: string[];
  try {
    path = new URL(record.url).pathname.toLowerCase().split(/[-_/]/u);
  } catch {
    return null;
  }
  const summary = fold(record.shortDescription ?? record.longDescription ?? "");
  if (!path.includes(fold(candidate)) || !summary.includes(fold(candidate))) return null;
  return "Marca contradictoria: título y origen identifican un fabricante distinto de la ficha técnica";
};

const gamModelIssue = (record: ProductRecord, specs: SpecsMap): string | null => {
  if (!record.brand || !record.model || typeof specs.Modelo !== "string" ||
    fold(specs.Modelo) !== fold(record.model) || !record.title) return null;
  const candidate = new RegExp(`(?:^|\\s)${escapeRegex(record.brand)}\\s+([\\p{L}\\d./-]+)`, "iu")
    .exec(record.title)?.[1];
  if (!candidate || !/[a-z]/iu.test(candidate) || !/\d/u.test(candidate) || /kg$/iu.test(candidate)) return null;
  const titledModel = modelToken(candidate);
  const declaredModel = modelToken(record.model);
  if (titledModel.length < 3 || declaredModel.length < 3 ||
    titledModel.startsWith(declaredModel) || declaredModel.startsWith(titledModel)) return null;
  return "Modelo contradictorio: título y especificación identifican variantes diferentes";
};

const kilograms = (value: string): number | null => {
  const match = /^(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*kg$/iu.exec(value.trim());
  return match?.[1] ? numberToken(match[1]) : null;
};

const gamCapacityIssue = (record: ProductRecord, specs: SpecsMap): string | null => {
  const capacity = specs["Capacidad de carga (kg)"];
  if (typeof capacity !== "string" || !record.title || !record.shortDescription) return null;
  const published = kilograms(capacity);
  const titleValues = [...record.title.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*kg\b/giu)]
    .map((match) => match[1] ? numberToken(match[1]) : null);
  if (published === null || titleValues.length !== 1 || titleValues[0] !== published) return null;
  const summaries = [...fold(record.shortDescription).matchAll(/\bcapacidad\s+de\s+carga\s+(?:de|hasta)?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*kg\b/gu)]
    .map((match) => match[1] ? numberToken(match[1]) : null);
  if (summaries.length !== 1 || summaries[0] === null || summaries[0] === published) return null;
  return "Capacidad contradictoria: título y ficha técnica discrepan del resumen de carga nominal";
};

export const preparedTechnicalConsistencyIssues = (record: ProductRecord, specs: SpecsMap): readonly string[] => {
  if (record.providerId === "gomariz") {
    const platform = specs["Altura plataforma"];
    const work = specs["Altura de trabajo"];
    const measurement = (value: string): number | null => {
      const match = /^(\d+(?:[.,]\d+)?)\s*m$/iu.exec(value.trim());
      return match?.[1] ? Number(match[1].replace(",", ".")) : null;
    };
    const platformHeight = typeof platform === "string" ? measurement(platform) : null;
    const workingHeight = typeof work === "string" ? measurement(work) : null;
    return platformHeight !== null && workingHeight !== null &&
      platformHeight >= workingHeight
      ? ["Alturas contradictorias: la plataforma no puede superar la altura de trabajo"] : [];
  }
  if (record.providerId !== "gam") return [];
  const issues = [
    gamMotorIssue(specs),
    gamBrandIssue(record, specs),
    gamModelIssue(record, specs),
    gamCapacityIssue(record, specs),
    gamUnreconciledBasketIssue(record, specs)
  ];
  return issues.filter((issue): issue is string => issue !== null);
};
