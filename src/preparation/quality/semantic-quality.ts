import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../../commercial/legacy-export/contracts.js";
import { validateCreateManyCandidate } from "../../commercial/legacy-export/import-validation.js";
import { fold } from "../classification/attribute-utils.js";
import { editorialQuantity } from "../editorial/measurements/editorial-measurements.js";
import { editorialHasImplausibleWeight, resolveEditorialFacts } from "../editorial/core/editorial-facts.js";
import { gomarizSemanticQualityIssues } from "../gomariz/source-quality.js";
import { mercaelevaSemanticQualityIssues } from "../mercaeleva/source-quality.js";

export const sourceSemanticQualityIssues = (record: ProductRecord): readonly string[] => [
  ...(record.providerId === "gomariz" ? gomarizSemanticQualityIssues(record) :
    record.providerId === "mercaeleva" ? mercaelevaSemanticQualityIssues(record) : []),
  ...(editorialHasImplausibleWeight(record) ?
    ["Peso técnicamente inverosímil para la familia del equipo: requiere verificación documental"] : [])
];

const weightField = (name: string): boolean => /\b(?:peso|masa|weight)\b/u.test(fold(name));

const containsWeightClaim = (text: string | null, rejectedWeight: number): boolean => {
  if (!text) return false;
  return /\b(?:pes[oa]s?|pesan|masa|weight)\b/u.test(fold(text)) ||
    [...text.matchAll(/\b\d+(?:[.,]\d+)*\s*kg\b/giu)]
      .some(([quantity]) => editorialQuantity(quantity, "kg") === rejectedWeight);
};

export const canOmitImplausiblePlatformWeight = (
  source: ProductRecord, editorialSource: ProductRecord, product: ImportCandidate, catalog: ImportCatalog | null
): boolean => {
  const weight = editorialQuantity(source.specs?.Peso, "kg");
  if (weight === null || !editorialHasImplausibleWeight(source)) return false;
  const facts = resolveEditorialFacts(editorialSource);
  if (!facts?.family.startsWith("plataforma-") || facts.workingHeightM === null ||
    facts.loadCapacityKg === null || !product.reference || !product.condition || !product.image ||
    !product.images.includes(product.image) || !product.title?.trim() || !product.description?.trim() ||
    !product.description_general?.trim()) return false;
  if (Object.keys(source.specs ?? {}).some((key) => key !== "Peso" && weightField(key)) ||
    Object.entries(product.spec).some(([key, value]) => weightField(key) ||
      (typeof value === "string" ? containsWeightClaim(value, weight) : Array.isArray(value) &&
        value.some((entry) => typeof entry === "string" && containsWeightClaim(entry, weight))))) return false;
  if ([source.title, source.shortDescription, source.longDescription, product.title, product.description_title,
    product.description, product.description_general].some((text) => containsWeightClaim(text, weight))) return false;
  if (catalog === null) return true;
  if (validateCreateManyCandidate(product, catalog).length > 0) return false;
  const weightIds = new Set(catalog.attributes.filter((attribute) => weightField(attribute.name)).map(({ id }) => id));
  return !product.attributes.some(({ attributeID }) => weightIds.has(attributeID));
};

export const withoutRejectedWeight = (record: ProductRecord): ProductRecord => {
  const specs = { ...record.specs };
  delete specs.Peso;
  return { ...record, specs };
};
