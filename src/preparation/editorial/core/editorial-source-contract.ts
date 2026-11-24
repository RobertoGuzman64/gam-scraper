import { containsEditorialBrandModel, containsEditorialIdentity } from "../identity/editorial-identity-match.js";
import type { ProductRecord, SpecValue } from "../../../contracts/catalog.js";

type EditorialSource = {
  readonly brand: string;
  readonly model: string;
  readonly familyClues: string;
  readonly workingHeight: SpecValue | undefined;
  readonly lateralReach: SpecValue | undefined;
  readonly liftingHeight: SpecValue | undefined;
  readonly liftingHeightUnit: "m" | "mm";
  readonly loadCapacity: SpecValue | undefined;
  readonly motor: SpecValue | undefined;
  readonly equipmentHeight: SpecValue | undefined;
};

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

export const verifiedEditorialIdentity = (record: ProductRecord): boolean => {
  const title = normalized(record.title ?? "");
  const brand = normalized(record.brand ?? "");
  const model = normalized(record.model ?? "");
  if (!record.reference?.trim() || !title || !brand || !model ||
    !containsEditorialBrandModel(record.title ?? "", record.brand ?? "", record.model ?? "")) return false;
  const sourceBrand = record.specs?.Marca;
  const sourceModel = record.specs?.Modelo;
  return (sourceBrand === undefined || typeof sourceBrand === "string" && normalized(sourceBrand) === brand) &&
    (sourceModel === undefined || typeof sourceModel === "string" && normalized(sourceModel) === model);
};

export const verifiedEditorialStructuredIdentity = (record: ProductRecord): boolean => {
  const brand = normalized(record.brand ?? "");
  const model = normalized(record.model ?? "");
  const specsBrand = record.specs?.Marca;
  const specsModel = record.specs?.Modelo;
  return Boolean(record.reference?.trim() && brand && model &&
    containsEditorialIdentity(record.title ?? "", record.brand ?? "") &&
    normalized(record.title ?? "").includes(model) &&
    typeof specsBrand === "string" && normalized(specsBrand) === brand &&
    typeof specsModel === "string" && normalized(specsModel) === model);
};

export const sameEditorialUnit = (source: ProductRecord, prepared: ProductRecord): boolean =>
  Boolean(source.reference?.trim()) && source.reference === prepared.reference &&
  source.url === prepared.url &&
  source.brand === prepared.brand && source.model === prepared.model &&
  source.condition === prepared.condition;

export const resolveMissingEditorialUnitName = (
  source: ProductRecord, prepared: ProductRecord, general: string, authenticatedOrigin: boolean
): string | null => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  if (!authenticatedOrigin || !brand || !model ||
    !sameEditorialUnit(source, prepared) || !verifiedEditorialIdentity(source) ||
    !verifiedEditorialIdentity(prepared) || containsEditorialIdentity(general, model) ||
    containsEditorialIdentity(general, brand)) return null;
  return `${brand} ${model}`;
};

const singleCapacity = (value: string): RegExpMatchArray | null => {
  const matches = [...value.matchAll(/\b(\d{3,5})\s*kg\b/giu)];
  return matches.length === 1 ? matches[0] ?? null : null;
};

const correctedCapacityText = (value: string, previous: string, next: string): string | null => {
  const match = singleCapacity(value);
  if (!match?.[0] || !match[1] || match.index === undefined || match[1] !== previous) return null;
  return `${value.slice(0, match.index)}${match[0].replace(match[1], next)}${value.slice(match.index + match[0].length)}`;
};

export const hasCorroboratedEditorialCapacityReconciliation = (
  source: ProductRecord, prepared: ProductRecord
): boolean => {
  if (!sameEditorialUnit(source, prepared) || !source.brand || !source.model ||
    !verifiedEditorialIdentity(source) || source.title === prepared.title ||
    source.shortDescription !== prepared.shortDescription ||
    source.year !== prepared.year || source.horometer !== prepared.horometer ||
    source.serialNumber !== prepared.serialNumber) return false;
  const originalCapacity = singleCapacity(source.title ?? "")?.[1];
  const technicalCapacity = /^(\d{3,5})\s*kg$/iu.exec(
    String(source.specs?.["Capacidad máxima de elevación"] ?? "").trim()
  )?.[1];
  if (!originalCapacity || !technicalCapacity || originalCapacity === technicalCapacity ||
    source.specs?.Marca !== prepared.specs?.Marca ||
    source.specs?.Modelo !== prepared.specs?.Modelo ||
    source.specs?.["Capacidad máxima de elevación"] !== prepared.specs?.["Capacidad máxima de elevación"]) return false;
  const originalAdditional = source.specs?.["Título adicional"];
  const preparedAdditional = prepared.specs?.["Título adicional"];
  if (typeof originalAdditional !== "string" || typeof preparedAdditional !== "string" ||
    correctedCapacityText(originalAdditional, originalCapacity, technicalCapacity) !== preparedAdditional) return false;
  const originalGeneral = source.longDescription;
  return typeof originalGeneral === "string" && typeof prepared.longDescription === "string" &&
    correctedCapacityText(source.title ?? "", originalCapacity, technicalCapacity) === prepared.title &&
    (prepared.longDescription === originalGeneral ||
      correctedCapacityText(originalGeneral, originalCapacity, technicalCapacity) === prepared.longDescription);
};

export type { EditorialSource };
