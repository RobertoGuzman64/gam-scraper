import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { editorialFamilyIsMasculine, editorialFamilyName, editorialFamilyOf } from "./editorial-families.js";
import { editorialQuantity, formatEditorialQuantity } from "./editorial-measurements.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import type { EditorialFacts } from "./editorial-facts.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";
import { resolveDocumentedBatteryConfiguration } from "./editorial-battery-claims.js";
import type { EditorialFamily } from "./editorial-families.js";

const quantity = (value: number | null, unit: string, label: string): string | null =>
  value === null ? null : `${label} de ${formatEditorialQuantity(value)} ${unit}`;

const asserted = (facts: EditorialFacts): readonly string[] => {
  const metrics = [
    quantity(facts.workingHeightM, "m", "altura de trabajo"),
    quantity(facts.platformHeightM, "m", "altura de plataforma"),
    quantity(facts.lateralReachM, "m", "alcance lateral"),
    quantity(facts.liftingHeightM, "m", "altura de elevación"),
    quantity(facts.loadCapacityKg, "kg", facts.family === "tractor-arrastre" ? "capacidad de arrastre" :
      facts.family.includes("plataforma") ? "capacidad" : "capacidad de carga"),
    quantity(facts.powerKva, "kVA", "potencia aparente"),
    quantity(facts.trayCapacityKg, "kg", "carga neta por bandeja")
  ];
  return metrics.filter((item): item is string => item !== null);
};

const details = (facts: EditorialFacts, battery: string | null): readonly string[] => [
  quantity(facts.weightKg, "kg", "peso declarado"),
  quantity(facts.lengthM, "m", "longitud"),
  quantity(facts.widthM, "m", "anchura"),
  quantity(facts.heightM, "m", "altura del equipo"),
  quantity(facts.storedHeightM, "m", "altura de almacenaje"),
  quantity(facts.voltageV, "V", "voltaje declarado"),
  battery,
  quantity(facts.gradeabilityPercent, "%", "pendiente superable declarada"),
  quantity(facts.loadCenterMm, "mm", "centro de carga declarado"),
  quantity(facts.turningRadiusM, "m", "radio de giro declarado"),
  quantity(facts.cleaningWidthM, "m", "anchura de trabajo de limpieza"),
  quantity(facts.drawbarPullN, "N", "tiro nominal a la barra"),
  facts.basketLengthM !== null && facts.basketWidthM !== null ?
    `cesta de ${formatEditorialQuantity(facts.basketLengthM)} × ${formatEditorialQuantity(facts.basketWidthM)} m` : null,
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

export const resolveReusableEditorial = (
  record: ProductRecord, familyOverride: EditorialFamily | null = null,
  sourceUnitRecord: ProductRecord = record
): { readonly short: string | null; readonly general: string | null } => {
  const prepared = resolveEditorialFacts(record, familyOverride);
  if (!prepared) return { short: null, general: null };
  const source = sourceUnitRecord === record ? prepared :
    (prepared.loadCenterMm !== null || prepared.turningRadiusM !== null) &&
      sameEditorialUnit(sourceUnitRecord, record) ? resolveEditorialFacts(sourceUnitRecord, familyOverride) : null;
  const corroborated = (key: "Centro de carga" | "Radio de giro"): boolean =>
    source !== null && source.family === prepared.family &&
    sourceUnitRecord.specs?.[key] !== undefined && record.specs?.[key] !== undefined;
  const dumperCapacityConfirmed = sameEditorialUnit(sourceUnitRecord, record) &&
    ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"].some((key) =>
      sourceUnitRecord.specs?.[key] !== undefined && sourceUnitRecord.specs[key] === record.specs?.[key]);
  const facts: EditorialFacts = {
    ...prepared,
    loadCapacityKg: prepared.family === "dumper" && !dumperCapacityConfirmed ? null : prepared.loadCapacityKg,
    loadCenterMm: corroborated("Centro de carga") && source?.loadCenterMm === prepared.loadCenterMm
      ? prepared.loadCenterMm : null,
    turningRadiusM: corroborated("Radio de giro") && source?.turningRadiusM === prepared.turningRadiusM
      ? prepared.turningRadiusM : null
  };
  const family = editorialFamilyName(facts.family);
  const name = `${facts.brand} ${facts.model}`;
  const measures = [...asserted(facts), ...towerMeasures(record, sourceUnitRecord, facts)];
  const extras = details(facts, resolveDocumentedBatteryConfiguration(
    sourceUnitRecord, record, facts.family, facts.voltageV
  ));
  if (measures.length === 0 && extras.length === 0) return { short: null, general: null };
  const fuel = facts.energy === "eléctrica" ? editorialFamilyIsMasculine(facts.family) ? " eléctrico" : " eléctrica" :
    facts.energy === "diésel" ? " diésel" :
      facts.energy === "GLP" ? " de GLP" : facts.energy === "gasolina" ? " de gasolina" : "";
  const identity = `${family[0]?.toLocaleUpperCase("es") ?? ""}${family.slice(1)}${fuel} ${name}`;
  const main = measures.length ? join(measures) : join(extras.slice(0, 2));
  const extra = measures.length ? extras : extras.slice(2);
  const unit = [facts.year !== null ? `año de fabricación ${facts.year}` : null,
    facts.hours !== null ? `${formatEditorialQuantity(facts.hours)} horas registradas` : null]
    .filter((value): value is string => value !== null);
  const cleaningFamily = facts.family === "fregadora" || facts.family === "barredora" || facts.family === "maquina-limpieza";
  const generalClauses = [...measures, ...(cleaningFamily ? extras : extra)];
  const generalDetails = generalClauses.length ? join(generalClauses) : main;
  return {
    short: `${identity}, con ${main}.`,
    general: `La ficha técnica de ${family}${fuel} ${name} indica ${generalDetails}${unit.length ? `; esta unidad consta con ${join(unit)}` : ""}.`
  };
};
