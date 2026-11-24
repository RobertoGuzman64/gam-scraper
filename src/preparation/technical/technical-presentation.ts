import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { editorialHasImplausibleWeight } from "../editorial/core/editorial-facts.js";

const identityFields = new Set(["marca", "modelo", "referencia", "numero de serie", "nº de serie", "nro de serie", "motor", "tipo motor"]);

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("es");

const normalizeValue = (key: string, value: SpecValue): SpecValue => {
  if (typeof value !== "string") return value;
  const name = fold(key);
  if (identityFields.has(name)) return value;
  const text = fold(value);
  const repeatedForkUnit = name === "horquillas" ?
    /^(\d{2,4}\s*mm\s*[x×]\s*\d{2,4}\s*mm\s*[x×]\s*\d{1,4}\s*mm)\s+mm$/iu.exec(value.trim()) : null;
  if (repeatedForkUnit?.[1]) return repeatedForkUnit[1];
  if (text === "si") return "Sí";
  if (text === "no") return "No";
  if (!/^tipo(?: de)? mastil$/u.test(name)) return value;
  if (text === "simple" || text === "simplex") return "Simple";
  if (text === "duplex") return "Dúplex";
  if (text === "triplex") return "Tríplex";
  if (text === "cuadruplex") return "Cuádruplex";
  return value;
};

export const normalizeTechnicalPresentation = (specs: SpecsMap): SpecsMap => {
  let normalized: Record<string, SpecValue> | null = null;
  for (const [key, value] of Object.entries(specs)) {
    const formatted = normalizeValue(key, value);
    if (formatted === value) continue;
    normalized ??= { ...specs };
    normalized[key] = formatted;
  }
  return normalized ?? specs;
};

export const rejectImplausibleTechnicalWeight = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (specs.Peso === undefined || specs.Peso !== record.specs?.Peso || !editorialHasImplausibleWeight(record)) return specs;
  const safe = { ...specs };
  delete safe.Peso;
  return safe;
};
