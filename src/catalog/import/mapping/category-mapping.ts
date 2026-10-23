import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../preparation/contracts.js";
import { fold } from "./category-utils.js";
import { gamUsedCategorySlug, newCategorySlug } from "./providers/gam/categories.js";
import { gomarizCategorySlug } from "./providers/gomariz/categories.js";
import { mercaelevaCategorySlug, mercaelevaNewCategorySlug } from "./providers/mercaeleva/categories.js";

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
    const description = fold(`${record.title ?? ""} ${record.shortDescription ?? ""} ${record.longDescription ?? ""}`);
    if (/\b(?:es un cuatriciclo|cuatriciclo electrico|cuatriciclo de carga)\b/.test(description)) return true;
  }
  const expected = /(?:^|-)diesel(?:-|$)/.test(slug) ? "diesel" :
    /(?:^|-)electric[ao]s?(?:-|$)/.test(slug) ? "electric" :
      /(?:^|-)glp(?:-|$)/.test(slug) ? "glp" : null;
  if (expected === null) return false;
  const energies = (value: string): ReadonlySet<string> => {
    const result = new Set<string>();
    const folded = fold(value);
    if (/\bdiesel\b/.test(folded)) result.add("diesel");
    if (/\belectric[ao]s?\b/.test(folded)) result.add("electric");
    if (/\b(?:glp|lpg)\b/.test(folded)) result.add("glp");
    return result;
  };
  const titleEnergy = energies(record.title ?? "");
  if (titleEnergy.size === 1 && !titleEnergy.has(expected)) return true;
  if (titleEnergy.size > 1) return true;
  for (const key of ["Tipo motor", "Motorización"]) {
    const value = record.specs?.[key];
    if (typeof value !== "string") continue;
    const alternatives = energies(value);
    if (alternatives.size === 1 && !alternatives.has(expected)) return true;
  }
  return false;
};

export const isLeafCategoryForCondition = (
  categoryId: number, categories: ImportCatalog["categories"], condition: ImportableCondition
): boolean => {
  const rootName = condition === "Nuevo" ? "Maquinaria Nueva" : "Maquinaria de Ocasión";
  const roots = categories.filter((category) => category.active !== false && fold(category.name) === fold(rootName));
  if (roots.length !== 1 || categories.filter((category) => category.id === categoryId && category.active !== false).length !== 1 ||
    categories.some((category) => category.parentId === categoryId)) return false;
  const byId = new Map(categories.map((category) => [category.id, category]));
  let parentId = byId.get(categoryId)?.parentId ?? null;
  const visited = new Set<number>();
  while (parentId !== null && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent || parent.active === false) return false;
    if (parentId === roots[0]?.id) return true;
    visited.add(parentId);
    parentId = parent.parentId;
  }
  return false;
};

export const resolveCategory = (
  record: ProductRecord, categories: ImportCatalog["categories"],
  condition: ImportCandidate["condition"] = record.condition === "Nuevo" ? "Nuevo" :
    record.condition === "Segunda mano" ? "Segunda_Mano" : null
): Category | null => {
  if (condition === null) return null;
  const leaf = categories.filter((category) => isLeafCategoryForCondition(category.id, categories, condition));
  const sourceSlug = condition === "Nuevo"
    ? record.providerId === "mercaeleva" ? mercaelevaNewCategorySlug(record) : newCategorySlug(record)
    : sourceCategorySlug(record);
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
