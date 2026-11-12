import type { ProductRecord, SpecValue } from "../../../../contracts/catalog.js";

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
    !title.includes(brand) || !title.includes(model)) return false;
  const sourceBrand = record.specs?.Marca;
  const sourceModel = record.specs?.Modelo;
  return (sourceBrand === undefined || typeof sourceBrand === "string" && normalized(sourceBrand) === brand) &&
    (sourceModel === undefined || typeof sourceModel === "string" && normalized(sourceModel) === model);
};

export type { EditorialSource };
