import type { ProductRecord } from "../../../contracts/catalog.js";
import { hasPlatformRetractedHeight, hasSeparatePlatformDimensions, resolveEditorialFacts } from "./editorial-facts.js";
import { editorialFamilyFromSourceGeneral, editorialFamilyIsMasculine, editorialFamilyName, editorialFamilyOf } from "./editorial-families.js";
import { editorialMetricOf, editorialQuantity, formatEditorialQuantity } from "../measurements/editorial-measurements.js";
import { hasUnconditionalEditorialClaim } from "../claims/editorial-claim-evidence.js";
import type { EditorialFacts } from "./editorial-facts.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";
import { verifiedEditorialUnitPair } from "../identity/editorial-unit-provenance.js";
import { containsEditorialBrandModel } from "../identity/editorial-identity-match.js";
import { resolveDocumentedBatteryConfiguration } from "../claims/editorial-battery-claims.js";
import { corroboratedAnnouncedUnitSummary } from "../source/context/editorial-source-announced-unit.js";
import type { EditorialFamily } from "./editorial-families.js";
import { resolveEquipmentConfigurationDetails, resolveHandlingOperationalDetails, resolvePlatformOperationalDetails, resolveTransportOperationalDetails } from "../source/details/editorial-sourced-equipment-details.js";

const quantity = (value: number | null, unit: string, label: string, separator = " de "): string | null =>
  value === null ? null : `${label}${separator}${formatEditorialQuantity(value)} ${unit}`;

const asserted = (facts: EditorialFacts, reachLabel = "alcance lateral"): readonly string[] => {
  const metrics = [
    quantity(facts.workingHeightM, "m", "altura de trabajo"),
    quantity(facts.platformHeightM, "m", "altura de plataforma"),
    quantity(facts.lateralReachM, "m", reachLabel),
    quantity(facts.liftingHeightM, "m", "altura de elevación"),
    quantity(facts.loadCapacityKg, "kg", facts.family === "tractor-arrastre" ? "capacidad de arrastre" :
      facts.family.includes("plataforma") ? "capacidad" : "capacidad de carga"),
    quantity(facts.powerKva, "kVA", "potencia aparente"),
    quantity(facts.trayCapacityKg, "kg", "carga neta por bandeja")
  ];
  return metrics.filter((item): item is string => item !== null);
};

const generalReachLabel = (facts: EditorialFacts, record: ProductRecord, source: ProductRecord): string => {
  const reach = facts.lateralReachM;
  const maximumKeys = ["Alcance horizontal max.", "Alcance horizontal máximo"];
  const reachKeys = [...maximumKeys, "Alcance horizontal", "Alcance horizontal (m)", "Alcance lateral", "Alcance Lateral", "Alcance maximo"];
  if (reach === null || !["plataforma-articulada", "plataforma-telescopica", "camion-cesta"].includes(facts.family) ||
    !sameEditorialUnit(source, record) || source.shortDescription?.trim() || source.longDescription?.trim() ||
    record.shortDescription?.trim() || record.longDescription?.trim() ||
    resolveEditorialFacts(source)?.family !== facts.family ||
    ![source, record].every(({ specs }) => editorialMetricOf(specs, maximumKeys) === reach &&
      editorialMetricOf(specs, reachKeys) === reach)) return "alcance lateral";
  return "alcance horizontal máximo declarado";
};

const generalWeightLabel = (facts: EditorialFacts, record: ProductRecord, source: ProductRecord): string => {
  const field = facts.family === "miniexcavadora" ? "Peso operativo" :
    facts.family === "cargadora" ? "Peso sin carga" : null;
  if (field === null || facts.weightKg === null || !sameEditorialUnit(source, record) ||
    source.shortDescription?.trim() || source.longDescription?.trim() ||
    record.shortDescription?.trim() || record.longDescription?.trim() ||
    resolveEditorialFacts(source)?.family !== facts.family) return "peso declarado";
  const weight = facts.weightKg;
  const alternative = field === "Peso operativo" ? "Peso sin carga" : "Peso operativo";
  if (![source, record].every(({ specs }) =>
    editorialQuantity(specs?.Peso, "kg") === weight && editorialQuantity(specs?.[field], "kg") === weight &&
    specs?.[alternative] === undefined && specs?.["Peso carretilla en vacio"] === undefined &&
    (specs?.["Peso maquina"] === undefined || editorialQuantity(specs["Peso maquina"], "kg") === weight))) return "peso declarado";
  return field === "Peso operativo" ? "peso operativo declarado" : "peso sin carga declarado";
};

const generalDimensionLabels = (facts: EditorialFacts, record: ProductRecord, source: ProductRecord): readonly [string, string] => {
  if (!facts.family.startsWith("plataforma-") || !verifiedEditorialUnitPair(source, record) ||
    source.shortDescription?.trim() || source.longDescription?.trim() ||
    record.shortDescription?.trim() || record.longDescription?.trim() ||
    resolveEditorialFacts(source)?.family !== facts.family) return ["longitud", "anchura"];
  const explicit = (value: number | null, total: readonly string[], aliases: readonly string[]): boolean =>
    value !== null && [source, record].every(({ specs }) =>
      editorialMetricOf(specs, total) === value && editorialMetricOf(specs, [...total, ...aliases]) === value);
  return [explicit(facts.lengthM, ["Longitud total"], ["Longitud", "Largo"]) ? "longitud total" : "longitud",
    explicit(facts.widthM, ["Anchura total", "Ancho total"], ["Anchura", "Ancho"]) ? "anchura total" : "anchura"];
};

const details = (facts: EditorialFacts, battery: string | null, record: ProductRecord, weightLabel = "peso declarado",
  dimensionLabels: readonly [string, string] = ["longitud", "anchura"]): readonly string[] => [
  quantity(facts.weightKg, "kg", weightLabel),
  quantity(facts.discDiameterMm, "mm", "diámetro máximo de disco"),
  quantity(facts.lengthM, "m", dimensionLabels[0], dimensionLabels[0] === "longitud total" ? ": " : " de "),
  quantity(facts.widthM, "m", dimensionLabels[1], dimensionLabels[1] === "anchura total" ? ": " : " de "),
  quantity(facts.heightM, "m", "altura del equipo"),
  quantity(facts.storedHeightM, "m", hasPlatformRetractedHeight(record, facts.family) ? "altura replegada" : "altura de almacenaje"),
  quantity(facts.voltageV, "V", "voltaje declarado"),
  battery,
  quantity(facts.gradeabilityPercent, "%", "pendiente superable declarada"),
  quantity(facts.loadCenterMm, "mm", "centro de carga declarado"),
  quantity(facts.turningRadiusM, "m", "radio de giro declarado"),
  quantity(facts.cleaningWidthM, "m", "anchura de trabajo de limpieza"),
  quantity(facts.drawbarPullN, "N", "tiro nominal a la barra"),
  facts.basketLengthM !== null && facts.basketWidthM !== null ?
    `${hasSeparatePlatformDimensions(record) ? "plataforma" : "cesta"} de ${formatEditorialQuantity(facts.basketLengthM)} × ${formatEditorialQuantity(facts.basketWidthM)} m` : null,
  facts.mastType !== null ? `mástil ${facts.mastType} declarado` : null
].filter((item): item is string => item !== null);

const towerMeasures = (
  record: ProductRecord, source: ProductRecord, facts: EditorialFacts
): readonly string[] => {
  const titleFamily = editorialFamilyOf(record.title ?? "");
  if (facts.family !== "torre-iluminacion" || (titleFamily !== null && titleFamily !== facts.family) ||
    !sameEditorialUnit(source, record) ||
    resolveEditorialFacts(source)?.family !== facts.family) return [];
  const measures: string[] = [];
  const work = record.specs?.["Altura de trabajo"];
  if (typeof work === "string" && work === source.specs?.["Altura de trabajo"]) {
    const height = editorialQuantity(work, "m");
    if (height !== null && height >= 3 && height <= 60) {
      measures.push(`altura de trabajo declarada de ${formatEditorialQuantity(height)} m`);
    }
  }
  const power = record.specs?.Potencia;
  const lamps = /\b(?:focos?|luminarias?|proyectores?|l[aá]mparas?)\b/giu;
  const description = source.longDescription ?? "";
  const lightingContradiction = /\b(?:focos?|luminarias?|proyectores?|l[aá]mparas?)\b/iu.test(description) &&
    !hasUnconditionalEditorialClaim(description, lamps);
  if (!lightingContradiction && typeof power === "string" && power === source.specs?.Potencia) {
    const match = /^(\d{1,2})\s*[x×]\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*W$/iu.exec(power.trim());
    const count = match?.[1] ? Number(match[1]) : null;
    const watts = match?.[2] ? Number(match[2].replace(",", ".")) : null;
    if (count !== null && watts !== null && count > 0 && count <= 20 && watts > 0 && watts <= 10000) {
      measures.push(`configuración de luminarias declarada de ${count} × ${formatEditorialQuantity(watts)} W`);
    }
  }
  return measures;
};

const join = (values: readonly string[]): string => values.length === 1 ? values[0] ?? "" :
  values.length === 2 ? `${values[0]} y ${values[1]}` :
    `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;

const differentiatedSourceYear = (
  record: ProductRecord, source: ProductRecord, facts: EditorialFacts
): string | null => {
  const general = source.longDescription?.trim();
  const year = facts.year;
  if (year === null || !general || source.shortDescription?.trim() ||
    source.year?.trim() !== String(year) || record.year?.trim() !== source.year?.trim() ||
    !sameEditorialUnit(source, record) ||
    editorialFamilyFromSourceGeneral(general) !== facts.family ||
    containsEditorialBrandModel(general, facts.brand, facts.model)) return null;
  const otherYears = [...general.matchAll(/\b(?:19|20)\d{2}\b/gu)]
    .some(([value]) => value !== String(year));
  return otherYears ? null : `año de fabricación ${year}`;
};

const equipmentAccessWidth = (facts: EditorialFacts, source: ProductRecord, prepared: ProductRecord): string | null => {
  const width = facts.widthM;
  const scissor = facts.family === "plataforma-tijera";
  const forklift = facts.family === "carretilla-elevadora" || facts.family === "carretilla-retractil";
  const boom = facts.family === "plataforma-articulada" || facts.family === "plataforma-telescopica";
  if ((!scissor && !forklift && !boom) || width === null || width < 0.5 || width > (forklift ? 4 : 3) ||
    (boom && (facts.workingHeightM === null || facts.lateralReachM === null || facts.platformHeightM !== null)) ||
    facts.loadCapacityKg === null || (scissor && facts.workingHeightM === null && facts.platformHeightM === null && facts.liftingHeightM === null) ||
    source.shortDescription?.trim() || prepared.shortDescription?.trim() ||
    !verifiedEditorialUnitPair(source, prepared) ||
    /\b(?:anchura|ancho|anch[oa]s?)\b/iu.test([source.title, source.longDescription, prepared.title, prepared.longDescription].join(" "))) return null;
  const original = resolveEditorialFacts(source);
  if (original?.family !== facts.family || original.widthM !== width) return null;
  return quantity(width, "m", "anchura del equipo");
};

const platformStorageHeight = (facts: EditorialFacts, source: ProductRecord, prepared: ProductRecord): string | null => {
  const height = facts.storedHeightM;
  const scissor = facts.family === "plataforma-tijera";
  if ((!scissor && !["plataforma-articulada", "plataforma-telescopica"].includes(facts.family)) ||
    height === null || facts.workingHeightM === null || height >= facts.workingHeightM ||
    (!scissor && facts.lateralReachM === null) || facts.loadCapacityKg === null ||
    source.shortDescription?.trim() || prepared.shortDescription?.trim() ||
    !verifiedEditorialUnitPair(source, prepared)) return null;
  const original = resolveEditorialFacts(source);
  if (original?.family !== facts.family || original.storedHeightM !== height) return null;
  if (!source.longDescription?.trim() && !prepared.longDescription?.trim() &&
    [source, prepared].every(({ specs }) => editorialMetricOf(specs, ["Altura replegada"]) === height)) {
    return quantity(height, "m", "altura replegada");
  }
  if (![source, prepared].every(({ specs }) => specs?.["Altura replegada"] === undefined &&
    editorialMetricOf(specs, ["Altura almacenaje"]) === height) ||
    /\b(?:almacen\w*|repleg\w*|plegad\w*|recogid\w*|transporte)\b/iu.test(
      [source.title, source.longDescription, prepared.title, prepared.longDescription].join(" "))) return null;
  return quantity(height, "m", "altura de almacenaje");
};

const declaredShortWeight = (facts: EditorialFacts, source: ProductRecord, prepared: ProductRecord): string | null => {
  const weight = facts.weightKg;
  const platform = ["plataforma-tijera", "plataforma-articulada", "plataforma-telescopica"].includes(facts.family);
  if ((!platform && !["carretilla-elevadora", "carretilla-retractil", "manipulador-telescopico", "grupo-electrogeno"].includes(facts.family)) ||
    weight === null || (facts.family === "grupo-electrogeno" ? facts.powerKva === null : facts.loadCapacityKg === null) ||
    (platform && (facts.workingHeightM === null && facts.platformHeightM === null && facts.liftingHeightM === null || weight < 100)) ||
    (!platform && (source.shortDescription?.trim() || prepared.shortDescription?.trim())) ||
    !verifiedEditorialUnitPair(source, prepared) ||
    /\b(?:peso|tara|masa)\b/iu.test([source.title, source.shortDescription, source.longDescription, prepared.title, prepared.shortDescription, prepared.longDescription].join(" ")) ||
    ![source, prepared].every(({ specs }) => editorialQuantity(specs?.Peso, "kg") === weight &&
      !Object.keys(specs ?? {}).some((key) => key !== "Peso" && /\b(?:peso|weight|tara)\b/iu.test(key)))) return null;
  const original = resolveEditorialFacts(source);
  if (original?.family !== facts.family || original.weightKg !== weight) return null;
  return quantity(weight, "kg", "peso declarado");
};

export const resolveReusableEditorial = (
  record: ProductRecord, familyOverride: EditorialFamily | null = null,
  sourceUnitRecord: ProductRecord = record
): { readonly short: string | null; readonly general: string | null } => {
  const prepared = resolveEditorialFacts(record, familyOverride);
  if (!prepared) return { short: null, general: null };
  const separatePlatformDimensions = hasSeparatePlatformDimensions(record);
  const retractedPlatformHeight = hasPlatformRetractedHeight(record, prepared.family);
  const source = sourceUnitRecord === record ? prepared :
    (prepared.loadCenterMm !== null || prepared.turningRadiusM !== null ||
      separatePlatformDimensions || retractedPlatformHeight) &&
      sameEditorialUnit(sourceUnitRecord, record) ? resolveEditorialFacts(sourceUnitRecord, familyOverride) : null;
  const corroborated = (key: "Centro de carga" | "Radio de giro"): boolean =>
    source !== null && source.family === prepared.family &&
    sourceUnitRecord.specs?.[key] !== undefined && record.specs?.[key] !== undefined;
  const dumperCapacityConfirmed = sameEditorialUnit(sourceUnitRecord, record) &&
    ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"].some((key) =>
      sourceUnitRecord.specs?.[key] !== undefined && sourceUnitRecord.specs[key] === record.specs?.[key]);
  const dimensionsCorroborated = !separatePlatformDimensions || source?.family === prepared.family &&
    source.basketLengthM === prepared.basketLengthM && source.basketWidthM === prepared.basketWidthM;
  const storedHeightCorroborated = !retractedPlatformHeight ||
    source?.family === prepared.family && source.storedHeightM === prepared.storedHeightM;
  const facts: EditorialFacts = {
    ...prepared,
    basketLengthM: dimensionsCorroborated ? prepared.basketLengthM : null,
    basketWidthM: dimensionsCorroborated ? prepared.basketWidthM : null,
    storedHeightM: storedHeightCorroborated ? prepared.storedHeightM : null,
    loadCapacityKg: prepared.family === "dumper" && !dumperCapacityConfirmed ? null : prepared.loadCapacityKg,
    loadCenterMm: corroborated("Centro de carga") && source?.loadCenterMm === prepared.loadCenterMm
      ? prepared.loadCenterMm : null,
    turningRadiusM: corroborated("Radio de giro") && source?.turningRadiusM === prepared.turningRadiusM
      ? prepared.turningRadiusM : null
  };
  const family = editorialFamilyName(facts.family);
  const name = `${facts.brand} ${facts.model}`;
  const tower = towerMeasures(record, sourceUnitRecord, facts);
  const reachLabel = generalReachLabel(facts, record, sourceUnitRecord);
  const measures = [...asserted(facts, reachLabel === "alcance lateral" ? reachLabel : "alcance horizontal máximo"), ...tower];
  const battery = resolveDocumentedBatteryConfiguration(sourceUnitRecord, record, facts.family, facts.voltageV);
  const extras = details(facts, battery, record);
  if (measures.length === 0 && extras.length === 0) return { short: null, general: null };
  const fuel = facts.energy === "eléctrica" ? editorialFamilyIsMasculine(facts.family) ? " eléctrico" : " eléctrica" :
    facts.energy === "diésel" ? " diésel" :
      facts.energy === "GLP" ? " de GLP" : facts.energy === "gasolina" ? " de gasolina" : "";
  const identity = `${family[0]?.toLocaleUpperCase("es") ?? ""}${family.slice(1)}${fuel} ${name}`;
  const main = measures.length ? join(measures) : join(extras.slice(0, 2));
  const compactHandling = facts.family === "apilador" || facts.family === "transpaleta" || facts.family === "recogepedidos";
  const widthSource = compactHandling && measures.length === 1 && facts.loadCapacityKg !== null &&
    facts.widthM !== null && facts.widthM >= 0.3 && facts.widthM <= 1.5 &&
    verifiedEditorialUnitPair(sourceUnitRecord, record) ?
    source ?? resolveEditorialFacts(sourceUnitRecord, familyOverride) : null;
  const shortWidth = widthSource?.family === facts.family && widthSource.widthM === facts.widthM ?
    quantity(facts.widthM, "m", "anchura del equipo") : null;
  const accessWidth = equipmentAccessWidth(facts, sourceUnitRecord, record);
  const storageHeight = platformStorageHeight(facts, sourceUnitRecord, record);
  const shortWeight = facts.family.startsWith("plataforma-") && (accessWidth || storageHeight) ? null :
    declaredShortWeight(facts, sourceUnitRecord, record);
  const shortLoadCenter = facts.loadCapacityKg !== null && facts.loadCenterMm !== null &&
    verifiedEditorialUnitPair(sourceUnitRecord, record) &&
    !/\bcentro\s+(?:de\s+)?(?:carga|gravedad)\b/iu.test([sourceUnitRecord.shortDescription, record.shortDescription].join(" ")) ?
    quantity(facts.loadCenterMm, "mm", "centro de carga declarado") : null;
  const shortTurningRadius = facts.loadCapacityKg !== null && facts.turningRadiusM !== null &&
    verifiedEditorialUnitPair(sourceUnitRecord, record) &&
    !/\bradio\s+(?:de\s+)?giro\b/iu.test([sourceUnitRecord.shortDescription, record.shortDescription].join(" ")) &&
    [sourceUnitRecord, record].every(({ specs }) => !Object.keys(specs ?? {}).some((key) =>
      key !== "Radio de giro" && /\bradio\b.*\bgiro\b/iu.test(key))) ?
    quantity(facts.turningRadiusM, "m", "radio de giro declarado") : null;
  const handlingDetails = resolveHandlingOperationalDetails(sourceUnitRecord, record, facts.family);
  const shortMastHeight = facts.loadCapacityKg !== null && facts.liftingHeightM !== null ?
    handlingDetails.find((detail) => detail.startsWith("altura de mástil replegado declarada de ")) ?? null : null;
  const shortExtras = [accessWidth, storageHeight, shortWeight, shortLoadCenter, shortMastHeight].filter((value): value is string => value !== null);
  const shortMeasures = [...measures, ...shortExtras, ...(shortExtras.length === 0 && shortWidth ? [shortWidth] : []),
    ...(shortTurningRadius ? [shortTurningRadius] : [])];
  const shortMain = shortExtras.length > 0 || shortTurningRadius ? join(shortMeasures) : shortWidth ? join([main, shortWidth]) : main;
  const unit = [facts.year !== null ? `año de fabricación ${facts.year}` : null,
    facts.hours !== null ? `${formatEditorialQuantity(facts.hours)} ${facts.hours === 1 ? "hora registrada" : "horas registradas"}` : null]
    .filter((value): value is string => value !== null);
  const weightLabel = generalWeightLabel(facts, record, sourceUnitRecord);
  const dimensionLabels = generalDimensionLabels(facts, record, sourceUnitRecord);
  const generalExtras = weightLabel === "peso declarado" && dimensionLabels[0] === "longitud" && dimensionLabels[1] === "anchura" ?
    extras : details(facts, battery, record, weightLabel, dimensionLabels);
  const generalMeasures = reachLabel === "alcance lateral" ? measures : [...asserted(facts, reachLabel), ...tower];
  const generalClauses = [...generalMeasures, ...generalExtras, ...resolvePlatformOperationalDetails(sourceUnitRecord, record, facts.family),
    ...handlingDetails,
    ...resolveTransportOperationalDetails(sourceUnitRecord, record, facts.family, facts.heightM !== null),
    ...resolveEquipmentConfigurationDetails(sourceUnitRecord, record, facts.family)];
  const generalDetails = generalClauses.length ? join(generalClauses) : main;
  const sourceYear = differentiatedSourceYear(record, sourceUnitRecord, facts);
  const unitSummary = corroboratedAnnouncedUnitSummary(record, sourceUnitRecord, facts);
  return {
    short: `${identity}, con ${shortMain}${unitSummary || sourceYear ? `; ${unitSummary ?? sourceYear}` : ""}.`,
    general: `La ficha técnica de ${family}${fuel} ${name} indica ${generalDetails}${unit.length ? `; esta unidad consta con ${join(unit)}` : ""}.`
  };
};
