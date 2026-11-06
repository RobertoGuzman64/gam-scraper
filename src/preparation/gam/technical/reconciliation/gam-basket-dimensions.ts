import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { basketDimensions } from "../../../shared/classification/mapping/attribute-utils.js";
import {
  gamBasketDimensionsFromDescription,
  gamBasketDimensionsFromRepeatedFragments
} from "../mapping/basket.js";

const basketValue = (specs: SpecsMap | undefined): string | null => {
  const value = specs?.["Dimensiones Cesta"];
  return typeof value === "string" ? value.trim() : null;
};

const reconciledValue = (record: ProductRecord, value: string): string | null =>
  basketDimensions(value) ??
  gamBasketDimensionsFromRepeatedFragments(value) ??
  gamBasketDimensionsFromDescription(record, value);

export const reconcileGamBasketDimensions = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam") return record;
  const raw = basketValue(record.specs);
  if (raw === null) return record;
  const normalized = reconciledValue(record, raw);
  if (normalized === null || normalized === raw) return record;
  const repeatedUnit = /\b(?:mm|cm|m)\s+metros?\b/iu.test(raw);
  const repeatedFragments = gamBasketDimensionsFromRepeatedFragments(raw) !== null;
  const corroboratedDescription = gamBasketDimensionsFromDescription(record, raw) !== null;
  if (!repeatedUnit && !repeatedFragments && !corroboratedDescription) return record;
  return { ...record, specs: { ...record.specs, "Dimensiones Cesta": normalized } };
};

export const gamUnreconciledBasketIssue = (record: ProductRecord, specs: SpecsMap): string | null => {
  if (record.providerId !== "gam") return null;
  const raw = basketValue(specs);
  if (raw === null || !/\d\s*(?:[x×]|\s+\d).*\bmetros?\b/iu.test(raw)) return null;
  return reconciledValue(record, raw) === null
    ? "Dimensiones Cesta no acreditables: la cifra o la unidad publicada está deformada"
    : null;
};
