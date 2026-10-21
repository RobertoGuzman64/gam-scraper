import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../preparation/contracts.js";
import { fold } from "./category-utils.js";
import { gamUsedCategorySlug, newCategorySlug } from "./providers/gam/categories.js";
import { gomarizCategorySlug } from "./providers/gomariz/categories.js";
import { mercaelevaCategorySlug } from "./providers/mercaeleva/categories.js";

type Category = ImportCatalog["categories"][number];
type ImportableCondition = Exclude<ImportCandidate["condition"], null>;

const sourceCategorySlug = (record: ProductRecord): string | null => {
  let path: string[];
  let hostname: string;
  try {
    const url = new URL(record.url);
    path = url.pathname.split("/").filter(Boolean);
    hostname = url.hostname;
  } catch {
    return null;
  }
  if (record.providerId === "gam") return gamUsedCategorySlug(record, path, hostname);
  if (record.providerId === "gomariz") return gomarizCategorySlug(record, path, hostname);
  if (record.providerId === "mercaeleva") return mercaelevaCategorySlug(record, path, hostname);
  return null;
};

const contradictsMappedCategory = (record: ProductRecord, slug: string): boolean => {
  if (record.providerId !== "gam") return false;
  if (slug === "furgonetas-electricas-segunda-mano") {
    const description = fold(`${record.title ?? ""} ${record.shortDescription ?? ""}`);
    if (/\b(?:es un cuatriciclo|cuatriciclo electrico|cuatriciclo de carga)\b/.test(description)) return true;
  }
  const text = fold(record.title ?? "");
  const electric = /\belectric[oa]s?\b/.test(text);
  const diesel = /\bdiesel\b/.test(text);
  const other = /\bgasolina\b|\bglp\b|\bhibrid[oa]\b/.test(text);
  const titleEnergy = other || electric === diesel ? null : electric ? "electric" : "diesel";
  if (/(?:^|-)diesel(?:-|$)/.test(slug) && titleEnergy === "electric") return true;
  if (/(?:^|-)electric[ao]s?(?:-|$)/.test(slug) && titleEnergy === "diesel") return true;
  return false;
};

export const isLeafCategoryForCondition = (
  categoryId: number, categories: ImportCatalog["categories"], condition: ImportableCondition
): boolean => {
  const rootName = condition === "Nuevo" ? "Maquinaria Nueva" : "Maquinaria de Ocasión";
  const roots = categories.filter((category) => fold(category.name) === fold(rootName));
  if (roots.length !== 1 || categories.filter((category) => category.id === categoryId).length !== 1 ||
    categories.some((category) => category.parentId === categoryId)) return false;
  const byId = new Map(categories.map((category) => [category.id, category]));
  let parentId = byId.get(categoryId)?.parentId ?? null;
  const visited = new Set<number>();
  while (parentId !== null && !visited.has(parentId)) {
    if (parentId === roots[0]?.id) return true;
    visited.add(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return false;
};

export const resolveCategory = (
  record: ProductRecord, categories: ImportCatalog["categories"],
  condition: ImportableCondition = record.condition === "Nuevo" ? "Nuevo" : "Segunda_Mano"
): Category | null => {
  const leaf = categories.filter((category) => isLeafCategoryForCondition(category.id, categories, condition));
  const sourceSlug = condition === "Nuevo" ? newCategorySlug(record) : sourceCategorySlug(record);
  if (sourceSlug) {
    const matches = leaf.filter((category) => fold(category.slug) === fold(sourceSlug));
    const matched = matches.length === 1 ? matches[0] : undefined;
    return matched && !contradictsMappedCategory(record, matched.slug) ? matched : null;
  }
  const direct = leaf.filter((category) => fold(category.slug) === fold(record.categoryKey));
  const directMatch = direct.length === 1 ? direct[0] : undefined;
  if (directMatch) return contradictsMappedCategory(record, directMatch.slug) ? null : directMatch;
  if (record.providerId !== "gam" || condition === "Nuevo") return null;
  const byName = leaf.filter((category) => fold(category.name) === fold(record.categoryName));
  const nameMatch = byName.length === 1 ? byName[0] : undefined;
  return nameMatch && !contradictsMappedCategory(record, nameMatch.slug) ? nameMatch : null;
};
