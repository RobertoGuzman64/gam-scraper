import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../commercial/legacy-export/contracts.js";
import { editorialQuantity, editorialQuantityOf } from "../editorial-measurements.js";

const nominalLoad = /\bcapacidad\s+de\s+carga\s+(?:nominal\s+)?(?:de\s+)?(?:hasta\s+)?(\d{1,3}(?:[.,]\d{3})+|\d{1,5})\s*(?:kg|kilogramos?)\b/giu;
const negatedLoad = /\b(?:no\s+debe\s+interpretarse\s+como|no\s+es|no\s+equivale\s+a|no\s+se\s+confirma)\s+(?:una?\s+)?$/iu;
const conditionalLoad = /\b(?:con|sin)\s+(?:restricci[oó]n(?:es)?|limitaci[oó]n(?:es)?)\b|\brestringid[ao]s?\b/iu;

const hasContradictoryNominalLoad = (text: string | null, expected: number): boolean => {
  if (!text || conditionalLoad.test(text)) return false;
  for (const match of text.matchAll(nominalLoad)) {
    if (match.index !== undefined && negatedLoad.test(text.slice(Math.max(0, match.index - 90), match.index))) continue;
    const published = match[1] ? editorialQuantity(`${match[1]} kg`, "kg") : null;
    if (published !== null && published >= 50 && published <= 50000 && published !== expected) return true;
  }
  return false;
};

export const hasPublishedEditorialLoadConflict = (source: ProductRecord, published: ImportCandidate): boolean => {
  if (!source.reference?.trim() || source.reference !== published.reference || source.url !== published.sourceUrl ||
    !source.brand || !source.model ||
    source.specs?.Marca !== undefined && source.specs.Marca !== source.brand ||
    source.specs?.Modelo !== undefined && source.specs.Modelo !== source.model ||
    published.spec.Marca !== undefined && published.spec.Marca !== source.brand ||
    published.spec.Modelo !== undefined && published.spec.Modelo !== source.model) return false;
  const keys = ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad", "Capacidad máxima de elevación"];
  const sourceLoad = editorialQuantityOf(source.specs, keys, "kg");
  const publishedLoad = editorialQuantityOf(published.spec, keys, "kg");
  if (sourceLoad === null || sourceLoad < 50 || sourceLoad > 50000 || sourceLoad !== publishedLoad) return false;
  return hasContradictoryNominalLoad(published.title, sourceLoad) ||
    hasContradictoryNominalLoad(published.description, sourceLoad) ||
    hasContradictoryNominalLoad(published.description_general, sourceLoad);
};
