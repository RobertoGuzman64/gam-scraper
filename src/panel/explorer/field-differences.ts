import { normalizeSpecKey } from "../../catalog/normalization/normalize-specs.js";
import type { SpecValue } from "../../contracts/catalog.js";
import type { PanelFieldDifference, PanelProductView, PanelCommercialView } from "./types.js";

const display = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const compare = (
  field: string, group: PanelFieldDifference["group"], before: unknown, after: unknown
): PanelFieldDifference => {
  const first = display(before);
  const second = display(after);
  const change = first === second ? "unchanged" : first === null ? "added" : second === null ? "removed" : "changed";
  return { field, group, before: first, after: second, change };
};

const indexedSpecs = (specs: Readonly<Record<string, SpecValue>>): ReadonlyMap<string, readonly { key: string; value: SpecValue }[]> => {
  const groups = new Map<string, { key: string; value: SpecValue }[]>();
  for (const [key, value] of Object.entries(specs)) {
    const normalized = normalizeSpecKey(key);
    const found = groups.get(normalized) ?? [];
    found.push({ key, value });
    groups.set(normalized, found);
  }
  return groups;
};

export const compareTechnicalFields = (
  original: Readonly<Record<string, SpecValue>>, published: Readonly<Record<string, SpecValue>>,
  group: PanelFieldDifference["group"] = "technical"
): readonly PanelFieldDifference[] => {
  const before = indexedSpecs(original);
  const after = indexedSpecs(published);
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a.localeCompare(b, "es"));
  return keys.map((key) => {
    const left = before.get(key) ?? [];
    const right = after.get(key) ?? [];
    if (left.length > 1 || right.length > 1) {
      const value = (items: readonly { key: string; value: SpecValue }[]): string | null =>
        items.length ? items.map((item) => `${item.key}: ${display(item.value) ?? "No consta"}`).join(" · ") : null;
      return { field: key, group, before: value(left), after: value(right), change: "ambiguous" };
    }
    return compare(key, group, left[0]?.value, right[0]?.value);
  });
};

export const compareOriginalToPublished = (
  original: PanelProductView, published: PanelProductView
): readonly PanelFieldDifference[] => [
  compare("Título", "content", original.title, published.title),
  compare("Descripción corta", "content", original.shortDescription, published.shortDescription),
  compare("Descripción general", "content", original.generalDescription, published.generalDescription),
  compare("Categoría de origen / técnica", "content", original.category, published.category),
  compare("Precio declarado", "content", original.price, published.price),
  ...compareTechnicalFields(original.specs, published.specs)
];

export const comparePublishedToCommercial = (
  published: PanelProductView, commercial: PanelCommercialView
): readonly PanelFieldDifference[] => [
  compare("Título", "commercial", published.title, commercial.title),
  compare("Categoría técnica / comercial", "commercial", published.category, commercial.category),
  compare("Identificador de categoría comercial", "commercial", null, commercial.categorySellID),
  compare("Precio", "commercial", published.price, commercial.price),
  ...compareTechnicalFields(published.specs, commercial.specs, "commercial"),
  ...commercial.attributes.map((attribute) => compare(`Atributo comercial #${attribute.attributeID}`, "commercial", null, attribute.value))
];
