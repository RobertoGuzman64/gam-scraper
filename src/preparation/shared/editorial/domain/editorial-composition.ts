import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { editorialFamilyName } from "./editorial-families.js";
import { formatEditorialQuantity } from "./editorial-measurements.js";
import type { EditorialFacts } from "./editorial-facts.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";
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

const details = (facts: EditorialFacts): readonly string[] => [
  quantity(facts.weightKg, "kg", "peso declarado"),
  quantity(facts.lengthM, "m", "longitud"),
  quantity(facts.widthM, "m", "anchura"),
  quantity(facts.heightM, "m", "altura del equipo"),
  quantity(facts.storedHeightM, "m", "altura de almacenaje"),
  quantity(facts.voltageV, "V", "voltaje declarado"),
  quantity(facts.gradeabilityPercent, "%", "pendiente superable declarada"),
  quantity(facts.loadCenterMm, "mm", "centro de carga declarado"),
  quantity(facts.turningRadiusM, "m", "radio de giro declarado"),
  quantity(facts.cleaningWidthM, "m", "anchura de trabajo de limpieza"),
  quantity(facts.drawbarPullN, "N", "tiro nominal a la barra"),
  facts.basketLengthM !== null && facts.basketWidthM !== null ?
    `cesta de ${formatEditorialQuantity(facts.basketLengthM)} × ${formatEditorialQuantity(facts.basketWidthM)} m` : null,
  facts.mastType !== null ? `mástil ${facts.mastType} declarado` : null
].filter((item): item is string => item !== null);

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
    sourceUnitRecord.specs?.[key] !== undefined &&
    sourceUnitRecord.specs[key] === record.specs?.[key];
  const facts: EditorialFacts = {
    ...prepared,
    loadCenterMm: corroborated("Centro de carga") && source?.loadCenterMm === prepared.loadCenterMm
      ? prepared.loadCenterMm : null,
    turningRadiusM: corroborated("Radio de giro") && source?.turningRadiusM === prepared.turningRadiusM
      ? prepared.turningRadiusM : null
  };
  const family = editorialFamilyName(facts.family);
  const name = `${facts.brand} ${facts.model}`;
  const measures = asserted(facts);
  const extras = details(facts);
  if (measures.length === 0 && extras.length === 0) return { short: null, general: null };
  const fuel = facts.energy === "eléctrica" ? " eléctrica" :
    facts.energy === "diésel" ? " diésel" :
      facts.energy === "GLP" ? " de GLP" : facts.energy === "gasolina" ? " de gasolina" : "";
  const identity = `${family[0]?.toLocaleUpperCase("es") ?? ""}${family.slice(1)}${fuel} ${name}`;
  const main = measures.length ? join(measures) : join(extras.slice(0, 2));
  const extra = measures.length ? extras : extras.slice(2);
  const unit = [facts.year !== null ? `año de fabricación ${facts.year}` : null,
    facts.hours !== null ? `${formatEditorialQuantity(facts.hours)} horas registradas` : null]
    .filter((value): value is string => value !== null);
  const generalClauses = [...measures, ...extra];
  const generalDetails = generalClauses.length ? join(generalClauses) : main;
  return {
    short: `${identity}, con ${main}.`,
    general: `La ficha técnica de ${family}${fuel} ${name} indica ${generalDetails}${unit.length ? `; esta unidad consta con ${join(unit)}` : ""}.`
  };
};
