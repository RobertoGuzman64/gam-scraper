import type { ProductRecord, SpecValue } from "../../../contracts/catalog.js";
import { editorialFamilyOf, resolveConsistentEditorialFamily } from "./editorial-families.js";
import type { EditorialFamily } from "./editorial-families.js";
import { editorialMetricOf, editorialQuantity, editorialQuantityOf } from "../measurements/editorial-measurements.js";
import { resolveEditorialSource } from "./editorial-source.js";
import type { EditorialSource } from "./editorial-source-contract.js";

export type EditorialEnergy = "eléctrica" | "diésel" | "GLP" | "gasolina";

export type EditorialFacts = {
  readonly family: EditorialFamily;
  readonly brand: string;
  readonly model: string;
  readonly workingHeightM: number | null;
  readonly platformHeightM: number | null;
  readonly storedHeightM: number | null;
  readonly lateralReachM: number | null;
  readonly liftingHeightM: number | null;
  readonly loadCapacityKg: number | null;
  readonly trayCapacityKg: number | null;
  readonly weightKg: number | null;
  readonly discDiameterMm: number | null;
  readonly lengthM: number | null;
  readonly widthM: number | null;
  readonly heightM: number | null;
  readonly voltageV: number | null;
  readonly powerKva: number | null;
  readonly gradeabilityPercent: number | null;
  readonly loadCenterMm: number | null;
  readonly turningRadiusM: number | null;
  readonly cleaningWidthM: number | null;
  readonly basketLengthM: number | null;
  readonly basketWidthM: number | null;
  readonly drawbarPullN: number | null;
  readonly mastType: "dúplex" | "tríplex" | "simple" | null;
  readonly year: number | null;
  readonly hours: number | null;
  readonly energy: EditorialEnergy | null;
};

const normalize = (value: string): string => value.trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

const isPlatform = (family: EditorialFamily): boolean => family.startsWith("plataforma-") || family === "camion-cesta";
const isHandling = (family: EditorialFamily): boolean =>
  ["carretilla-elevadora", "carretilla-retractil", "transpaleta", "apilador", "recogepedidos", "manipulador-telescopico", "tractor-arrastre"].includes(family);

const parsedEnergy = (value: SpecValue | undefined): EditorialEnergy | null | false => {
  if (value === undefined) return null;
  if (typeof value !== "string") return false;
  const normalized = normalize(value);
  if (/^(?:electrico|electrica|electricidad|bateria|electrica de bateria)$/u.test(normalized)) return "eléctrica";
  if (/^(?:diesel|gasoil)$/u.test(normalized)) return "diésel";
  if (/^(?:glp|gas licuado|gas licuado del petroleo|lpg)$/u.test(normalized)) return "GLP";
  if (/^gasolina$/u.test(normalized)) return "gasolina";
  return false;
};

const energyOf = (record: ProductRecord, source: EditorialSource): EditorialEnergy | null | false => {
  const specs = record.specs;
  const raw = source.motor ?? specs?.["Tipo motor"] ?? specs?.["Tipo de motor"] ?? specs?.Motorización;
  const energy = parsedEnergy(raw);
  if (energy === false) return false;
  if (energy === null) return null;
  if ([source.motor, specs?.["Tipo motor"], specs?.["Tipo de motor"], specs?.Motorización]
    .some((value) => value !== undefined && parsedEnergy(value) !== energy)) return false;
  const title = normalize(record.title ?? "");
  const declared = [...title.matchAll(/\b(diesel|electrico|electrica|glp|gasolina)\b/gu)].map((match) => match[1]);
  const declaredSet = new Set(declared.map((value) => value === "diesel" ? "diésel" :
    value === "glp" ? "GLP" : value === "gasolina" ? "gasolina" : "eléctrica"));
  if (declaredSet.size > 1 || declaredSet.size > 0 && !declaredSet.has(energy)) return false;
  const description = normalize(record.longDescription ?? "");
  const opposite = energy === "eléctrica" ? /\b(?:diesel|glp|gasolina)\b/u :
    energy === "diésel" ? /\b(?:electricos?|electricas?|glp|gasolina)\b/u :
      energy === "GLP" ? /\b(?:electricos?|electricas?|diesel|gasolina)\b/u :
        /\b(?:electricos?|electricas?|diesel|glp)\b/u;
  return opposite.test(description) ? false : energy;
};

const valid = (value: number | null, min: number, max: number): boolean =>
  value === null || value >= min && value <= max;

const sourceMetric = (value: SpecValue | undefined, unit: "m" | "mm"): number | null => {
  const number = editorialQuantity(value, unit);
  return number === null ? null : unit === "mm" ? number / 1000 : number;
};

const sourceCapacity = (record: ProductRecord, source: EditorialSource, family: EditorialFamily): number | null => {
  if (!isHandling(family) && !isPlatform(family) && family !== "elevador-materiales" && family !== "dumper") return null;
  if (family === "dumper" && source.loadCapacity === undefined) return null;
  if (family === "tractor-arrastre" &&
    (record.specs?.["Capacidad de arrastre (kg)"] !== undefined ||
      record.specs?.["Capacidad de arrastre"] !== undefined)) {
    const towing = editorialQuantityOf(record.specs, ["Capacidad de arrastre (kg)", "Capacidad de arrastre"], "kg");
    const announced = [...(record.title ?? "").matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d{4,5})\s*kg\b/giu)];
    if (announced.length > 1 || announced.length === 1 &&
      editorialQuantity(`${announced[0]?.[1] ?? ""} kg`, "kg") !== towing) return null;
    return towing;
  }
  const capacity = editorialQuantityOf(record.specs, family === "dumper" ?
    ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"] :
    ["Capacidad de carga (kg)", "Capacidad máxima de elevación", "Capacidad de carga", "Capacidad"], "kg");
  if (source.loadCapacity === undefined) return capacity;
  const sourced = editorialQuantity(source.loadCapacity, "kg");
  return sourced !== null && sourced === capacity ? capacity : null;
};

const sourceMillimetres = (value: SpecValue | undefined, min: number, max: number): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d{3,4})\s*mm$/iu.exec(value.trim());
  const number = match?.[1] ? Number(match[1]) : NaN;
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
};

const corroboratedMillimetres = (
  specs: SpecValue | undefined, description: string | null, key: "Centro de carga" | "Radio de giro",
  minimum: number, maximum: number
): number | null => {
  const metres = key === "Radio de giro" ? editorialQuantity(specs, "m") : null;
  const value = metres === null ? sourceMillimetres(specs, minimum, maximum) : metres * 1000;
  if (value === null || value < minimum || value > maximum) return null;
  const term = key === "Centro de carga" ? "centro\\s+(?:de\\s+)?(?:carga|gravedad)" :
    "radio\\s+(?:(?:m[ií]nimo|exterior)\\s+)?(?:de\\s+)?(?:giro|viraje)";
  if (metres === null) {
    const contextual = new RegExp(`\\b${term}\\s+(?:(?:de|es|de\\s+aproximadamente|(?:indicado|declarado)\\s+(?:es\\s+)?de)\\s+)?(\\d{3,4})\\s*mm\\b`, "giu");
    const recorded = [...(description ?? "").matchAll(contextual)].map((item) => Number(item[1]));
    return recorded.some((item) => item !== value) ? null : value;
  }
  const contextual = new RegExp(`\\b${term}\\s+(?:(?:de|es|de\\s+aproximadamente|(?:indicado|declarado)\\s+(?:es\\s+)?de)\\s+)?(\\d{1,4}(?:[.,]\\d{1,3})?)\\s*(mm|m|metros?)\\b`, "giu");
  const recorded = [...(description ?? "").matchAll(contextual)].map((item) => {
    const raw = `${item[1] ?? ""} ${item[2] ?? ""}`;
    const millimetres = editorialQuantity(raw, "mm");
    if (millimetres !== null) return millimetres;
    const measured = editorialQuantity(raw, "m");
    return measured === null ? null : measured * 1000;
  });
  return recorded.some((item) => item === null || Math.abs(item - value) > 0.001) ? null : value;
};

const hasHandlingMeasurements = (family: EditorialFamily): boolean =>
  family === "carretilla-elevadora" || family === "carretilla-retractil";

const verifiedBasketDimensions = (raw: SpecValue | undefined): readonly [number, number] | null => {
  if (typeof raw !== "string") return null;
  const match = /^(\d{1,2}(?:[.,]\d{1,3})?)\s*[x×]\s*(\d{1,2}(?:[.,]\d{1,3})?)\s*(?:m|metros?)$/iu.exec(raw.trim());
  if (!match?.[1] || !match[2]) return null;
  const length = Number(match[1].replace(",", "."));
  const width = Number(match[2].replace(",", "."));
  return length >= 0.5 && length <= 12 && width >= 0.4 && width <= 6 ? [length, width] : null;
};

export const hasPlatformRetractedHeight = (record: ProductRecord, family: EditorialFamily): boolean =>
  isPlatform(family) && record.specs?.["Altura replegada"] !== undefined;

const platformStoredHeight = (record: ProductRecord, workingHeight: number | null): number | null => {
  const height = editorialMetricOf(record.specs, ["Altura almacenaje", "Altura replegada"]);
  return height !== null && height >= 0.5 && height <= 30 &&
    (workingHeight === null || height <= workingHeight) ? height : null;
};

const platformLengthKeys = ["Longitud de plataforma", "Longitud plataforma"];
const platformWidthKeys = ["Anchura de plataforma", "Ancho plataforma", "Anchura plataforma"];

export const hasSeparatePlatformDimensions = (record: ProductRecord): boolean =>
  [...platformLengthKeys, ...platformWidthKeys].some((key) => record.specs?.[key] !== undefined);

const verifiedPlatformDimensions = (record: ProductRecord): readonly [number, number] | null => {
  const combined = record.specs?.["Dimensiones Cesta"];
  if (!hasSeparatePlatformDimensions(record)) return verifiedBasketDimensions(combined);
  const pair = combined === undefined ? null : verifiedBasketDimensions(combined);
  if (combined !== undefined && pair === null) return null;
  const hasLength = platformLengthKeys.some((key) => record.specs?.[key] !== undefined);
  const hasWidth = platformWidthKeys.some((key) => record.specs?.[key] !== undefined);
  const length = hasLength ? editorialMetricOf(record.specs, platformLengthKeys) : pair?.[0] ?? null;
  const width = hasWidth ? editorialMetricOf(record.specs, platformWidthKeys) : pair?.[1] ?? null;
  if (length === null || width === null || length < 0.5 || length > 12 || width < 0.4 || width > 6) return null;
  if (pair && (pair[0] !== length || pair[1] !== width)) return null;
  const exteriorWidth = editorialMetricOf(record.specs, ["Anchura", "Ancho total", "Anchura total", "Ancho"]);
  const exteriorLength = editorialMetricOf(record.specs, ["Longitud", "Longitud total", "Largo"]);
  if (exteriorWidth !== null && width > exteriorWidth || exteriorLength !== null && length > exteriorLength) return null;
  return [length, width];
};

const verifiedMast = (value: SpecValue | undefined): "dúplex" | "tríplex" | "simple" | null => {
  if (typeof value !== "string") return null;
  const normalized = normalize(value);
  if (normalized === "duplex") return "dúplex";
  if (normalized === "triplex") return "tríplex";
  if (normalized === "simplex" || normalized === "simple") return "simple";
  return null;
};

const verifiedMastOf = (record: ProductRecord): EditorialFacts["mastType"] => {
  const primary = record.specs?.["Tipo Mástil"];
  const secondary = record.specs?.["Tipo de mástil"];
  if (primary === undefined) return verifiedMast(secondary);
  const mast = verifiedMast(primary);
  if (secondary === undefined) return mast;
  return mast !== null && mast === verifiedMast(secondary) ? mast : null;
};

const unitYear = (record: ProductRecord): number | null => {
  const year = record.year?.trim();
  if (!year || !/^(?:19|20)\d{2}$/u.test(year)) return null;
  const parsed = Number(year);
  return parsed <= new Date().getUTCFullYear() ? parsed : null;
};

const unitHours = (record: ProductRecord): number | null => {
  const raw = record.horometer?.trim();
  if (!raw) return null;
  const match = /^(\d{1,3}(?:[. ]\d{3})*|\d+)\s*(?:h|horas?)?$/iu.exec(raw);
  if (!match?.[1]) return null;
  const hours = Number(match[1].replace(/[. ]/gu, ""));
  return Number.isSafeInteger(hours) && hours >= 0 && hours <= 200000 ? hours : null;
};

export const editorialWeightIsPlausible = (family: EditorialFamily, weightKg: number): boolean =>
  !(family.startsWith("plataforma-") && weightKg < 100);

export const resolveEditorialFacts = (record: ProductRecord, familyOverride: EditorialFamily | null = null): EditorialFacts | null => {
  const source = resolveEditorialSource(record);
  if (!source) return null;
  const family = resolveConsistentEditorialFamily(source.familyClues, record.title,
    typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
    `${record.subcategory ?? ""} | ${record.categoryName}`, familyOverride);
  const titleFamily = editorialFamilyOf(record.title ?? "");
  if (!family || family === "dumper" && titleFamily !== null && titleFamily !== family) return null;
  const energy = energyOf(record, source);
  if (energy === false) return null;
  const platform = isPlatform(family);
  const telehandler = family === "manipulador-telescopico";
  const work = platform || telehandler ? sourceMetric(source.workingHeight, "m") : null;
  const platformHeight = platform ? editorialMetricOf(record.specs, ["Altura plataforma", "Altura Plataforma"]) : null;
  const storedHeight = hasPlatformRetractedHeight(record, family) ?
    platformStoredHeight(record, work) : platform || telehandler || hasHandlingMeasurements(family) ||
    family === "fregadora" || family === "barredora" || family === "maquina-limpieza" ?
    editorialMetricOf(record.specs, ["Altura almacenaje"]) : null;
  const lateralFamily = family === "plataforma-telescopica" || family === "plataforma-articulada" ||
    family === "plataforma-oruga" || family === "camion-cesta" || telehandler;
  const lateralAliases = lateralFamily ? editorialMetricOf(record.specs, ["Alcance lateral", "Alcance Lateral"]) : null;
  const lateralCandidate = lateralFamily && source.lateralReach !== undefined &&
    sourceMetric(source.lateralReach, "m") === lateralAliases ? lateralAliases :
    lateralFamily && source.lateralReach === undefined ? lateralAliases : null;
  const publishedReach = record.specs?.["Alcance Lateral"] !== undefined && lateralCandidate !== null ?
    [...(record.longDescription ?? "").matchAll(/\balcance\s+(?:lateral|horizontal)\s+(?:de\s+)?(?:hasta\s+)?(\d{1,2}(?:[.,]\d{1,3})?)\s*(?:m|metros?)\b/giu)] : [];
  const lateralConflict = publishedReach.some((item) =>
    editorialQuantity(`${item[1] ?? ""} m`, "m") !== lateralCandidate);
  const lateral = lateralConflict ? null : lateralCandidate;
  const liftingAliases = editorialMetricOf(record.specs,
    ["Altura máxima de elevación", "Altura de elevación (mm)", "Altura de elevación (m)"]);
  const lifting = source.liftingHeight === undefined ? liftingAliases :
    sourceMetric(source.liftingHeight, source.liftingHeightUnit) === liftingAliases ? liftingAliases : null;
  const capacity = sourceCapacity(record, source, family);
  const trayCapacity = family === "almacen-vertical" ? editorialQuantityOf(record.specs, ["Carga neta por bandeja"], "kg") : null;
  const declaredWeight = editorialQuantityOf(record.specs, ["Peso"], "kg");
  const weight = declaredWeight !== null && editorialWeightIsPlausible(family, declaredWeight) ? declaredWeight : null;
  const discDiameter = family === "equipo-corte-disco" ?
    editorialQuantityOf(record.specs, ["Diametro max. disco"], "mm") : null;
  const lengthCandidate = editorialMetricOf(record.specs, ["Longitud", "Longitud total", "Largo"]);
  const length = record.specs?.Longitud === undefined && record.specs?.["Longitud total"] === undefined &&
    !valid(lengthCandidate, 0.2, 50) ? null : lengthCandidate;
  const widthCandidate = editorialMetricOf(record.specs, ["Anchura", "Ancho total", "Anchura total", "Ancho"]);
  const width = record.specs?.Anchura === undefined && record.specs?.["Ancho total"] === undefined &&
    record.specs?.["Anchura total"] === undefined && !valid(widthCandidate, 0.2, 20) ? null : widthCandidate;
  const height = family === "elevador-materiales" || source.equipmentHeight === undefined ? null :
    editorialMetricOf({ Altura: source.equipmentHeight }, ["Altura"]);
  const voltage = editorialQuantityOf(record.specs, ["Voltaje de la batería", "Voltaje"], "V");
  const power = editorialQuantityOf(record.specs, ["Potencia", "Potencia nominal"], "kVA");
  const gradeability = editorialQuantityOf(record.specs, ["Pendiente superable", "Pendiente superable (%)"], "%");
  const loadCenter = hasHandlingMeasurements(family) ? corroboratedMillimetres(record.specs?.["Centro de carga"], record.longDescription, "Centro de carga", 350, 2000) : null;
  const turningRadius = isHandling(family) ? corroboratedMillimetres(record.specs?.["Radio de giro"], record.longDescription, "Radio de giro", 750, 7500) : null;
  const basket = platform ? verifiedPlatformDimensions(record) : null;
  const drawbar = family === "tractor-arrastre" ? editorialQuantityOf(record.specs, ["Tiro a la barra nominal"], "N") : null;
  const mast = hasHandlingMeasurements(family) ? verifiedMastOf(record) : null;
  const cleaningWidth = ["fregadora", "barredora", "maquina-limpieza"].includes(family) ?
    editorialMetricOf(record.specs, ["Anchura trabajo", "Anchura limpieza"]) : null;
  if ((platform || telehandler) && source.workingHeight !== undefined && work === null ||
    lateralFamily && !telehandler && source.lateralReach !== undefined && lateralCandidate === null ||
    source.loadCapacity !== undefined && (isHandling(family) || platform || family === "dumper") && capacity === null ||
    (isHandling(family) && source.liftingHeight !== undefined && lifting === null)) return null;
  const minimumWeight = family === "radial-electrica" || family === "martillo-electrico" ? 2 : 10;
  if (!valid(work, 3, 60) || !valid(platformHeight, 0.5, 60) || !valid(storedHeight, 0.5, 30) ||
    !valid(lateral, 0.5, 60) || !valid(lifting, 0.5, 60) || !valid(capacity, 100, 50000) ||
    !valid(trayCapacity, 10, 5000) ||
    !valid(weight, minimumWeight, 500000) || !valid(discDiameter, 150, 500) || !valid(length, 0.2, 50) || !valid(width, 0.2, 20) ||
    !valid(height, 0.2, 30) || !valid(voltage, 1, 1500) || !valid(power, 1, 20000) ||
    !valid(gradeability, 0, 100) || !valid(cleaningWidth, 0.2, 5) || !valid(drawbar, 100, 200000) ||
    (work !== null && storedHeight !== null && storedHeight > work)) return null;
  if (family === "carretilla-elevadora" || family === "carretilla-retractil") {
    const announced = /\b(\d{3,5})\s*kg\b/iu.exec(record.title ?? "")?.[1];
    if (announced && capacity !== null && Number(announced) !== capacity) return null;
  }
  if (![work, platformHeight, lateral, lifting, capacity, trayCapacity, weight, discDiameter, power, voltage, gradeability, height, loadCenter, turningRadius, cleaningWidth, drawbar, basket?.[0] ?? null].some((value) => value !== null)) return null;
  return {
    family, brand: source.brand, model: source.model, workingHeightM: work,
    platformHeightM: platformHeight, storedHeightM: storedHeight, lateralReachM: lateral,
    liftingHeightM: lifting, loadCapacityKg: capacity, trayCapacityKg: trayCapacity, weightKg: weight, discDiameterMm: discDiameter,
    lengthM: length, widthM: width, heightM: height,
    voltageV: voltage, powerKva: power, gradeabilityPercent: gradeability,
    loadCenterMm: loadCenter, turningRadiusM: turningRadius === null ? null : turningRadius / 1000, cleaningWidthM: cleaningWidth,
    basketLengthM: basket?.[0] ?? null, basketWidthM: basket?.[1] ?? null,
    drawbarPullN: drawbar, mastType: mast,
    year: unitYear(record), hours: unitHours(record), energy
  };
};

export const editorialHasImplausibleWeight = (record: ProductRecord): boolean => {
  const facts = resolveEditorialFacts(record);
  const weight = editorialQuantityOf(record.specs, ["Peso"], "kg");
  return facts !== null && weight !== null && !editorialWeightIsPlausible(facts.family, weight);
};
