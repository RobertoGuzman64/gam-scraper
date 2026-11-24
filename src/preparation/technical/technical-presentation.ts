import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { editorialHasImplausibleWeight } from "../editorial/core/editorial-facts.js";

const identityFields = new Set(["marca", "modelo", "referencia", "numero de serie", "nº de serie", "nro de serie", "motor", "tipo motor"]);

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("es");

const normalizeBatteryCapacity = (value: string): string => {
  const explicitUnits = /^(?:Li-ion\s+)?\d+(?:[.,]\d+)?\s*V\s*\/\s*\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*Ah$/iu;
  const suffix = /\s*\(V\s*\/\s*Ah\)$/iu;
  const text = value.trim();
  if (!suffix.test(text)) return value;
  const options = text.replace(suffix, "").split(/\s*\|\s*/u);
  if (!options.every((option) => explicitUnits.test(option))) return value;
  return options.map((option) => option.replace(/(\d)\s*V\s*\/\s*/iu, "$1 V / ")
    .replace(/(\d)\s*Ah$/iu, "$1 Ah")
    .replace(/(\d)\s*([-–])\s*(\d)/gu, "$1$2$3")).join(" | ");
};

const normalizeValue = (key: string, value: SpecValue): SpecValue => {
  if (typeof value !== "string") return value;
  const name = fold(key);
  if (identityFields.has(name)) return value;
  const text = fold(value);
  if (name === "capacidad de la bateria") {
    const capacity = normalizeBatteryCapacity(value);
    if (capacity !== value) return capacity;
  }
  if ((name === "certificacion ce" || name === "accesorio de mastil de elevacion") && text === "yes") return "Sí";
  if (name === "numero de ruedas") {
    const integral = /^([1-9]\d*)[.,]0{1,2}$/u.exec(text);
    if (integral?.[1]) return integral[1];
  }
  if (name === "horas") {
    const integral = /^(0|[1-9]\d*)[.,]0{4}$/u.exec(text);
    if (integral?.[1]) return integral[1];
  }
  const repeatedForkUnit = name === "horquillas" ?
    /^(\d{2,4}\s*mm\s*[x×]\s*\d{2,4}\s*mm\s*[x×]\s*\d{1,4}\s*mm)\s+mm$/iu.exec(value.trim()) : null;
  if (repeatedForkUnit?.[1]) return repeatedForkUnit[1];
  if (text === "si") return "Sí";
  if (text === "no") return "No";
  if (!/^tipo(?: de)? mastil$/u.test(name)) return value;
  if (text === "simple" || text === "simplex") return "Simple";
  if (text === "duplex") return "Dúplex";
  if (text === "triplex" || text === "triple") return "Tríplex";
  if (text === "cuadruplex") return "Cuádruplex";
  return value;
};

export const isEmptyTechnicalMeasure = (key: string, value: SpecValue | undefined): boolean => {
  if (typeof value !== "string") return false;
  const name = fold(key);
  const text = fold(value);
  if (/^peso(?: (?:maquina|de la maquina|operativo|sin carga|carretilla en vacio))?$/u.test(name))
    return /^(?:n\/a\s+)?kg$/u.test(text);
  if (/^(?:bateria|capacidad de la bateria)$/u.test(name))
    return /^(?:n\/a\s+)?ah$/u.test(text);
  if (/^(?:longitud extension|longitud de extension|extension de plataforma)$/u.test(name))
    return /^(?:n\/a\s+)?(?:mm|cm|m)$/u.test(text);
  return false;
};

export const normalizeTechnicalPresentation = (specs: SpecsMap): SpecsMap => {
  let normalized: Record<string, SpecValue> | null = null;
  for (const [key, value] of Object.entries(specs)) {
    if (isEmptyTechnicalMeasure(key, value)) {
      normalized ??= { ...specs };
      delete normalized[key];
      continue;
    }
    const formatted = normalizeValue(key, value);
    if (formatted === value) continue;
    normalized ??= { ...specs };
    normalized[key] = formatted;
  }
  return normalized ?? specs;
};

const normalizeDirectOriginalPresentation = (
  specs: SpecsMap, originalSpecs: SpecsMap, format: (key: string, value: string) => string
): SpecsMap => {
  let normalized: Record<string, SpecValue> | null = null;
  for (const [key, value] of Object.entries(specs)) {
    if (typeof value !== "string" || originalSpecs[key] !== value) continue;
    const formatted = format(fold(key), value);
    if (formatted === value) continue;
    normalized ??= { ...specs };
    normalized[key] = formatted;
  }
  return normalized ?? specs;
};

export const normalizeOriginalMassPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    if (!/^(?:peso(?: (?:maquina|de la maquina|operativo|sin carga|carretilla en vacio))?|capacidad de carga(?: \(kg\))?)$/u.test(key)) return value;
    const mass = /^(\d+(?:[.,]\d+)?)\s*kg$/iu.exec(value.trim());
    return mass?.[1] ? `${mass[1]} kg` : value;
  });

const directLengthFields = new Set([
  "altura", "altura de trabajo", "altura de trabajo (m)", "altura almacenaje", "altura plataforma",
  "altura de plataforma", "altura replegada", "altura total", "longitud", "longitud total", "longitud transporte",
  "anchura", "anchura total", "ancho total", "anchura limpieza", "alcance lateral", "alcance horizontal",
  "alcance horizontal (m)", "radio de giro", "radio de giro (exterior)"
]);

export const normalizeOriginalLengthPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    if (!directLengthFields.has(key)) return value;
    const measure = /^(\d+)\.(\d{1,2})\s*(m|metros|cm|mm)$/iu.exec(value.trim());
    if (!measure?.[1] || !measure[2] || !measure[3]) return value;
    if (key.endsWith("(m)") && !/^(?:m|metros)$/iu.test(measure[3])) return value;
    return `${measure[1]},${measure[2]} ${measure[3].toLocaleLowerCase("es")}`;
  });

const directPowerFields = new Set(["potencia", "potencia absorbida", "potencia motor (kw)", "potencia motor (cv)"]);
const powerUnits: Readonly<Record<string, string>> = { w: "W", kw: "kW", kva: "kVA", cv: "CV" };

export const normalizeOriginalEnergyPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    if (/^(?:motor|tipo de motor|tipo motor|motorizacion)$/u.test(key) && fold(value) === "diesel") return "Diésel";
    if (!directPowerFields.has(key)) return value;
    const measure = /^(\d+(?:[.,]\d{1,2})?)\s*(w|kw|kva|cv)$/iu.exec(value.trim());
    if (!measure?.[1] || !measure[2]) return value;
    const unit = fold(measure[2]);
    if (key.endsWith("(kw)") && unit !== "kw" || key.endsWith("(cv)") && unit !== "cv") return value;
    const canonicalUnit = powerUnits[unit];
    return canonicalUnit ? `${measure[1].replace(".", ",")} ${canonicalUnit}` : value;
  });

export const rejectImplausibleTechnicalWeight = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (specs.Peso === undefined || specs.Peso !== record.specs?.Peso || !editorialHasImplausibleWeight(record)) return specs;
  const safe = { ...specs };
  delete safe.Peso;
  return safe;
};
