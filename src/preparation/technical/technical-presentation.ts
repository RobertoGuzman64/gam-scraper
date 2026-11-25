import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { SPEC_ANGULAR_FIELDS } from "../../catalog/normalization/spec-rules.js";
import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import { parseBatteryConfiguration, parseExplicitAngularPresentation, parseDimension, normalizeBatteryChemistryLabel, parseExplicitVoltagePresentation, parseMeasuredLength, parseNumber, parseNumberArray } from "../../catalog/normalization/spec-parsers.js";
import { basketDimensions } from "../classification/attribute-utils.js";
import { editorialHasImplausibleWeight } from "../editorial/core/editorial-facts.js";

const identityFields = new Set(["marca", "modelo", "referencia", "numero de serie", "nº de serie", "nro de serie", "motor", "tipo motor"]);

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("es");

const normalizeBatteryCapacity = (value: string): string =>
  /\s*\(V\s*\/\s*Ah\)$/iu.test(value.trim()) ? parseBatteryConfiguration(value) ?? value : value;

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
  if (normalizeSpecKey(key) === "Horas (h)") {
    const integral = name === "horas" ? /^(0|[1-9]\d*)[.,]0{4}$/u.exec(text) : null;
    const literal = integral?.[1] ?? text;
    if (/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:\s*(?:h|horas?))?$/u.test(literal)) {
      const hours = parseNumber(literal, "h");
      if (hours !== null && Number.isSafeInteger(hours)) return `${hours} h`;
    }
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

const formatExplicitLengthAlternatives = (value: string): string => {
  const match = /^(\d+(?:,\d+|\.\d{1,2})?(?:\s*\/\s*\d+(?:,\d+|\.\d{1,2})?)+)\s*(mm|cm|m)$/iu.exec(value.trim());
  if (!match?.[1] || !match[2]) return value;
  const unit = fold(match[2]);
  const parts = match[1].split("/").map((part) => part.trim());
  const valid = parts.every((part) => {
    const numeric = parseMeasuredLength(`${part} ${unit}`, "", "mm");
    return numeric !== null && numeric > 0;
  });
  return valid ? `${parts.map((part) => part.replace(".", ",")).join(" / ")} ${unit}` : value;
};

export const normalizeOriginalMassPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    const canonical = normalizeSpecKey(key);
    if (!/^(?:peso(?: (?:maquina|de la maquina|operativo|sin carga|carretilla en vacio))?|capacidad de carga(?: \(kg\))?)$/u.test(key) &&
      !["Capacidad de carga (kg)", "Capacidad de arrastre (kg)", "Carga Máxima (kg)", "Peso del rodillo (kg)"].includes(canonical) &&
      key !== "peso del rodillo" && key !== "capacidad") return value;
    const mass = /^(\d+(?:[.,]\d+)?)\s*kg$/iu.exec(value.trim());
    return mass?.[1] ? `${mass[1]} kg` : value;
  });

export const normalizeOriginalPercentagePresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    const canonical = normalizeSpecKey(key);
    if (!["Pendiente superable (%)", "Pendiente superable con carga (%)", "Pendiente superable sin carga (%)",
      "Estado baterías", "Pendiente con carga, nominal 3 min (%)", "Pendiente sin carga, nominal 3 min (%)"].some(
      (field) => fold(field) === fold(canonical))) return value;
    const percent = /^(\d+(?:,\d+|\.\d{1,2})?)\s*%$/u.exec(value.trim());
    const numeric = percent ? parseNumber(value, "%") : null;
    if (!percent?.[1] || numeric === null || (canonical === "Estado baterías" && numeric > 100)) return value;
    return `${percent[1].replace(".", ",")} %`;
  });

const directLengthFields = new Set([
  "altura", "altura de trabajo", "altura de trabajo (m)", "altura almacenaje", "altura plataforma",
  "altura de plataforma", "altura replegada", "altura total", "longitud", "longitud total", "longitud transporte",
  "anchura", "anchura total", "ancho total", "anchura limpieza", "alcance lateral", "alcance horizontal",
  "alcance horizontal (m)", "radio de giro", "radio de giro (exterior)",
  "altura de elevacion (m)", "anchura trabajo"
]);

const directBasketFields = new Set(["dimensiones cesta", "dimensiones de cesta", "dimensiones de la cesta"]);
const directForkFields = new Set(["dimensiones horquillas", "dimensiones de horquillas", "horquillas"]);

const formatDirectGeometry = (key: string, value: string): string => {
  const basket = directBasketFields.has(key);
  if (!basket && !directForkFields.has(key)) return value;
  const parts = /^(\d+(?:,\d+|\.\d{1,2})?)\s*[x×]\s*(\d+(?:,\d+|\.\d{1,2})?)(?:\s*[x×]\s*(\d+(?:,\d+|\.\d{1,2})?))?\s*(mm|cm|m|metros?)$/iu.exec(value.trim());
  if (!parts?.[1] || !parts[2] || !parts[4]) return value;
  if (basket ? basketDimensions(value) === null : parseDimension(value) === null) return value;
  const unit = fold(parts[4]);
  const axes = [parts[1], parts[2], parts[3]].filter((part): part is string => part !== undefined);
  return `${axes.map((part) => part.replace(".", ",")).join(" x ")} ${unit.startsWith("metro") ? "m" : unit}`;
};

export const normalizeOriginalLengthPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    if (key === "radio de giro" || key === "ancho promedio") {
      const integer = /^([1-9]\d*)$/u.exec(value.trim());
      if (integer?.[1] && parseMeasuredLength(integer[1], key, "mm") !== null) return `${integer[1]} mm`;
    }
    if (directLengthFields.has(key) || key === "ancho promedio" || key === "ast (mm)") {
      const explicitUnit = value.trim().match(/(mm|cm|m)$/iu)?.[1];
      const declaredUnit = key.endsWith("(mm)") ? "mm" : key.endsWith("(m)") ? "m" : key === "ancho promedio" ? "mm" : null;
      if (!declaredUnit || explicitUnit && fold(explicitUnit) === declaredUnit) {
        const alternatives = formatExplicitLengthAlternatives(value);
        if (alternatives !== value) return alternatives;
      }
    }
    if (!directLengthFields.has(key)) return formatDirectGeometry(key, value);
    const spelledMetres = /^(\d+(?:,\d+|\.\d{1,2})?)\s+metros?$/iu.exec(value.trim());
    if (spelledMetres?.[1] && parseMeasuredLength(value, key, "m") !== null) {
      return `${spelledMetres[1].replace(".", ",")} m`;
    }
    const compact = /^(\d+(?:,\d+|\.\d{1,2})?)(mm|cm|m)$/iu.exec(value.trim());
    if (compact?.[1] && compact[2] && parseMeasuredLength(value, key, "mm") !== null) {
      return `${compact[1].replace(".", ",")} ${fold(compact[2])}`;
    }
    const measure = /^(\d+)\.(\d{1,2})\s*(m|metros|cm|mm)$/iu.exec(value.trim());
    if (!measure?.[1] || !measure[2] || !measure[3]) return value;
    if (key.endsWith("(m)") && !/^(?:m|metros)$/iu.test(measure[3])) return value;
    return `${measure[1]},${measure[2]} ${measure[3].toLocaleLowerCase("es")}`;
  });

export const normalizeOriginalTravelPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    const canonical = normalizeSpecKey(key);
    if (canonical === "Kilómetros (km)") {
      const literal = /^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)\s*(?:km|kms|kil[oó]metros?)$/iu;
      const distance = literal.test(value.trim()) ? parseNumber(value, "km") : null;
      return distance !== null && Number.isSafeInteger(distance) ? `${distance} km` : value;
    }
    if (canonical !== "Velocidad de desplazamiento con/sin carga (km/h)") return value;
    const pair = /^(\d+(?:,\d+|\.\d{1,2})?)\s*\/\s*(\d+(?:,\d+|\.\d{1,2})?)\s*km\/h$/iu.exec(value.trim());
    if (!pair?.[1] || !pair[2] || parseNumberArray(value, "km/h", true)?.length !== 2) return value;
    return `${pair[1].replace(".", ",")} / ${pair[2].replace(".", ",")} km/h`;
  });

const directPowerFields = new Set(["potencia", "potencia absorbida", "potencia motor (kw)", "potencia motor (cv)"]);
const powerUnits: Readonly<Record<string, string>> = { w: "W", kw: "kW", kva: "kVA", cv: "CV" };

export const normalizeOriginalEnergyPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    if (/^(?:motor|tipo de motor|tipo motor|motorizacion)$/u.test(key) && fold(value) === "diesel") return "Diésel";
    if (/^(?:voltios|voltaje|voltaje de la bateria|voltaje del cargador|tension nominal de bateria)$/u.test(key)) {
      return parseExplicitVoltagePresentation(value) ?? value;
    }
    if (/^(?:bateria|baterias|bateria \(v \/ ah\))$/u.test(key)) return parseBatteryConfiguration(value) ?? value;
    if (key === "tipo de bateria" || key === "tipo bateria") return normalizeBatteryChemistryLabel(value);
    if (!directPowerFields.has(key)) return value;
    const declaredUnit = key.endsWith("(kw)") ? "kW" : key.endsWith("(cv)") ? "CV" : null;
    const scalar = /^(\d+(?:,\d+|\.\d{1,2})?)$/u.exec(value.trim());
    if (declaredUnit && scalar?.[1] && parseNumber(scalar[1], declaredUnit) !== null)
      return `${scalar[1].replace(".", ",")} ${declaredUnit}`;
    const measure = /^(\d+(?:[.,]\d{1,2})?)\s*(w|kw|kva|cv)$/iu.exec(value.trim());
    if (!measure?.[1] || !measure[2]) return value;
    const unit = fold(measure[2]);
    if (key.endsWith("(kw)") && unit !== "kw" || key.endsWith("(cv)") && unit !== "cv") return value;
    const canonicalUnit = powerUnits[unit];
    return canonicalUnit ? `${measure[1].replace(".", ",")} ${canonicalUnit}` : value;
  });

export const normalizeOriginalRotationPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    const canonical = normalizeSpecKey(key);
    if (SPEC_ANGULAR_FIELDS.has(canonical)) return parseExplicitAngularPresentation(value) ?? value;
    if (!["RPM cepillo", "RPM del cepillo"].includes(canonical)) return value;
    const scalar = /^(\d+(?:,\d+|\.\d{1,2})?)\s*(?:rpm)?$/iu.exec(value.trim());
    if (!scalar?.[1] || parseNumber(value, "rpm") === null) return value;
    return `${scalar[1].replace(".", ",")} rpm`;
  });

export const normalizeOriginalTechnicalPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap => {
  const mass = normalizeOriginalMassPresentation(specs, originalSpecs);
  const length = normalizeOriginalLengthPresentation(mass, originalSpecs);
  const energy = normalizeOriginalEnergyPresentation(length, originalSpecs);
  const travel = normalizeOriginalTravelPresentation(energy, originalSpecs);
  return normalizeOriginalRotationPresentation(normalizeOriginalPercentagePresentation(travel, originalSpecs), originalSpecs);
};

export const rejectImplausibleTechnicalWeight = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (specs.Peso === undefined || specs.Peso !== record.specs?.Peso || !editorialHasImplausibleWeight(record)) return specs;
  const safe = { ...specs };
  delete safe.Peso;
  return safe;
};
