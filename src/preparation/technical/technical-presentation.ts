import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { SPEC_ANGULAR_FIELDS } from "../../catalog/normalization/spec-rules.js";
import { normalizeSpecKey, reconcileSourceBatteryConfiguration, reconcileSourceFreeLiftAvailability } from "../../catalog/normalization/normalize-specs.js";
import { parseBatteryConfiguration, parseExplicitAngularPresentation, parseExplicitPowerPresentation, parseDimension, normalizeBatteryChemistryLabel, normalizeEnergyLabel, parseExplicitPercentagePresentation, normalizeMastLabel, normalizeWheelTractionLabel, parseExplicitVoltagePresentation, parseMeasuredLength, parseNumber, parseNumberArray, parseExplicitLengthAlternatives } from "../../catalog/normalization/spec-parsers.js";
import type { TechnicalRecoveryObservation } from "../provenance/technical-recovery-observation.js";
import { basketDimensions, numberToken, fold as foldAttribute } from "../classification/attribute-utils.js";
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
  return normalizeMastLabel(value);
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
    return parseExplicitPercentagePresentation(value, canonical === "Estado baterías" ? 100 : undefined) ?? value;
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
        const alternatives = parseExplicitLengthAlternatives(value) ?? value;
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
    if (canonical === "Tracción") return normalizeWheelTractionLabel(value);
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

const directPowerFields = new Set(["potencia", "potencia absorbida", "potencia motor (kw)", "potencia motor (cv)",
  "potencia (kw)", "potencia (cv)", "potencia de traccion (kw)", "potencia de elevacion (kw)"]);
const reconcileOriginalBatteryConfiguration = (specs: SpecsMap, originalSpecs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const result = reconcileSourceBatteryConfiguration(specs, originalSpecs);
  if (result.rename) observe?.(specs, result.specs, "src/preparation/technical/technical-presentation.ts", { spec: result.rename.from });
  return result.specs;
};

export const normalizeOriginalEnergyPresentation = (specs: SpecsMap, originalSpecs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const reconciled = reconcileOriginalBatteryConfiguration(specs, originalSpecs, observe);
  return normalizeDirectOriginalPresentation(reconciled, originalSpecs, (key, value) => {
    if (/^(?:motor|tipo de motor|tipo motor|motorizacion|combustible)$/u.test(key)) return normalizeEnergyLabel(value);
    if (/^(?:voltios|voltaje|voltaje de la bateria|voltaje del cargador|tension nominal de bateria)$/u.test(key)) {
      return parseExplicitVoltagePresentation(value) ?? value;
    }
    if (/^(?:bateria|baterias|bateria \(v \/ ah\))$/u.test(key)) return parseBatteryConfiguration(value) ?? value;
    if (key === "tipo de bateria" || key === "tipo bateria") return normalizeBatteryChemistryLabel(value);
    if (!directPowerFields.has(key)) return value;
    const declaredUnit = key.endsWith("(kw)") ? "kW" : key.endsWith("(cv)") ? "CV" : undefined;
    const formatted = parseExplicitPowerPresentation(value, declaredUnit);
    return formatted && (key !== "potencia absorbida" || !formatted.includes(" x ")) ? formatted : value;
  });
};

export const normalizeOriginalRotationPresentation = (specs: SpecsMap, originalSpecs: SpecsMap): SpecsMap =>
  normalizeDirectOriginalPresentation(specs, originalSpecs, (key, value) => {
    const canonical = normalizeSpecKey(key);
    if (SPEC_ANGULAR_FIELDS.has(canonical)) return parseExplicitAngularPresentation(value) ?? value;
    if (!["RPM cepillo", "RPM del cepillo"].includes(canonical)) return value;
    const scalar = /^(\d+(?:,\d+|\.\d{1,2})?)\s*(?:rpm)?$/iu.exec(value.trim());
    if (!scalar?.[1] || parseNumber(value, "rpm") === null) return value;
    return `${scalar[1].replace(".", ",")} rpm`;
  });

const platformHeightKeys = new Set(["Altura plataforma (mm)", "Altura plataforma (m)", "Altura de plataforma"]);

const reconcileOriginalPlatformMeasure = (specs: SpecsMap, originalSpecs: SpecsMap,
  field: string, matches: (key: string) => boolean, accepts: (key: string) => boolean,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const fields = Object.keys(specs).filter(matches);
  const originalFields = Object.keys(originalSpecs).filter(matches);
  const key = fields[0];
  if (fields.length !== 1 || originalFields.length !== 1 || key === undefined || originalFields[0] !== key || !accepts(key)) return specs;
  const raw = originalSpecs[key];
  const value = specs[key];
  const explicitMetres = /^\d+(?:[.,]\d+)?\s*(?:m|metros?)$/iu;
  if (typeof raw !== "string" || typeof value !== "string" || !explicitMetres.test(raw.trim()) ||
    !explicitMetres.test(value.trim())) return specs;
  const measure = parseMeasuredLength(raw, key, "m");
  if (measure === null || measure <= 0 || parseMeasuredLength(value, key, "m") !== measure) return specs;
  const { [key]: removed, ...remaining } = specs;
  const result = { ...remaining, [field]: value };
  observe?.(specs, result, "src/preparation/technical/technical-presentation.ts", { spec: key });
  return result;
};

export const normalizeOriginalPlatformHeightPresentation = (specs: SpecsMap, originalSpecs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap =>
  reconcileOriginalPlatformMeasure(specs, originalSpecs, "Altura de plataforma",
    (key) => platformHeightKeys.has(normalizeSpecKey(key)), (key) => fold(key) === "altura plataforma", observe);

const platformAxisFields = ["Longitud de plataforma", "Anchura de plataforma", "Extensión de plataforma"] as const;

export const normalizeOriginalPlatformAxisPresentation = (specs: SpecsMap, originalSpecs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap =>
  platformAxisFields.reduce<SpecsMap>((result, field) => reconcileOriginalPlatformMeasure(result, originalSpecs, field,
    (key) => normalizeSpecKey(key) === field, (key) => key !== field && !/\((?:mm|cm)\)\s*$/iu.test(key), observe), specs);

const normalizeOriginalTotalWidthPresentation = (specs: SpecsMap, originalSpecs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap =>
  reconcileOriginalPlatformMeasure(specs, originalSpecs, "Anchura total",
    (key) => normalizeSpecKey(key) === "Anchura (mm)", (key) => fold(key) === "ancho total", observe);

const conditionedGeometryFields = [
  ["Altura barandilla bajada", "Altura con barandillas bajadas"],
  ["Altura articulacion", "Altura de articulación"],
  ["Altura transporte", "Altura de transporte"]
] as const;

const normalizeOriginalConditionedGeometry = (specs: SpecsMap, originalSpecs: SpecsMap,
  observe?: TechnicalRecoveryObservation): SpecsMap =>
  conditionedGeometryFields.reduce<SpecsMap>((result, [canonical, field]) =>
    reconcileOriginalPlatformMeasure(result, originalSpecs, field, (key) => normalizeSpecKey(key) === canonical,
      (key) => fold(key) === fold(canonical), observe), specs);

export const normalizeOriginalTechnicalPresentation = (specs: SpecsMap, originalSpecs: SpecsMap, observe?: TechnicalRecoveryObservation): SpecsMap => {
  const availability = reconcileSourceFreeLiftAvailability(specs, originalSpecs);
  const source = availability.rename?.from;
  const reconciled = source && typeof originalSpecs[source] === "string" ? availability.specs : specs;
  if (source && reconciled !== specs) observe?.(specs, reconciled, "src/preparation/technical/technical-presentation.ts", { spec: source });
  const mass = normalizeOriginalMassPresentation(reconciled, originalSpecs);
  const length = normalizeOriginalLengthPresentation(mass, originalSpecs);
  const elevation = normalizeOriginalPlatformHeightPresentation(length, originalSpecs, observe);
  const axes = normalizeOriginalPlatformAxisPresentation(elevation, originalSpecs, observe);
  const width = normalizeOriginalTotalWidthPresentation(axes, originalSpecs, observe);
  const geometry = normalizeOriginalConditionedGeometry(width, originalSpecs, observe);
  const energy = normalizeOriginalEnergyPresentation(geometry, originalSpecs, observe);
  const travel = normalizeOriginalTravelPresentation(energy, originalSpecs);
  return normalizeOriginalRotationPresentation(normalizeOriginalPercentagePresentation(travel, originalSpecs), originalSpecs);
};

export const rejectImplausibleTechnicalWeight = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (specs.Peso === undefined || specs.Peso !== record.specs?.Peso || !editorialHasImplausibleWeight(record)) return specs;
  const safe = { ...specs };
  delete safe.Peso;
  return safe;
};

export const reconcileOriginalMassCapacityPresentation = (original: ProductRecord, specs: SpecsMap,
  sourceKey: string, field: "Capacidad de carga" | "Capacidad de la cesta" | "Capacidad máxima de elevación", mechanism: string,
  observe?: TechnicalRecoveryObservation): SpecsMap => {
  const raw = original.specs?.[sourceKey];
  const value = specs[sourceKey];
  if (typeof raw !== "string" || typeof value !== "string" ||
    !/^\d[\d.,]*\s*kg$/iu.test(raw.trim()) || !/^\d[\d.,]*\s*kg$/iu.test(value.trim())) return specs;
  const literal = /^(\d[\d.,]*)\s*kg$/iu.exec(raw.trim())?.[1];
  const mass = parseNumber(raw, "kg");
  if (!literal || mass === null || mass <= 0 || mass !== numberToken(literal) || mass !== parseNumber(value, "kg")) return specs;
  const otherCapacity = (key: string): boolean => key !== sourceKey &&
    /^(?:capacidad|carga maxima)(?:\s|$)/u.test(foldAttribute(key)) &&
    !/\b(?:bateria|deposito|tolva)\b/u.test(foldAttribute(key));
  if ([...Object.keys(original.specs ?? {}), ...Object.keys(specs)].some(otherCapacity) ||
    Object.keys(specs).some((key) => key !== sourceKey && normalizeSpecKey(key) === normalizeSpecKey(field))) return specs;
  const { [sourceKey]: removed, ...remaining } = specs;
  const result = { ...remaining, [field]: value };
  observe?.(specs, result, mechanism, { spec: sourceKey });
  return result;
};
