import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../../../../commercial/legacy-export/contracts.js";
import { fold } from "./category-utils.js";
import { classificationProvider } from "./classification-provider.js";

type Category = ImportCatalog["categories"][number];
type ImportableCondition = Exclude<ImportCandidate["condition"], null>;

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

const leafCategoriesByCatalog = new WeakMap<ImportCatalog["categories"], Partial<Record<ImportableCondition, readonly Category[]>>>();

const leafCategories = (categories: ImportCatalog["categories"], condition: ImportableCondition): readonly Category[] => {
  let byCondition = leafCategoriesByCatalog.get(categories);
  if (!byCondition) {
    byCondition = {};
    leafCategoriesByCatalog.set(categories, byCondition);
  }
  const cached = byCondition[condition];
  if (cached) return cached;
  const resolved = categories.filter((category) => isLeafCategoryForCondition(category.id, categories, condition));
  byCondition[condition] = resolved;
  return resolved;
};

export const resolveCategory = (
  record: ProductRecord, categories: ImportCatalog["categories"],
  condition: ImportCandidate["condition"] = record.condition === "Nuevo" ? "Nuevo" :
    record.condition === "Segunda mano" ? "Segunda_Mano" : null
): Category | null => {
  if (condition === null) return null;
  const leaf = leafCategories(categories, condition);
  const rules = classificationProvider(record)?.category;
  const sourceSlug = rules?.slug(record, condition) ?? null;
  if (rules?.requiresSource && !sourceSlug) return null;
  if (sourceSlug) {
    const matches = leaf.filter((category) => fold(category.slug) === fold(sourceSlug));
    const matched = matches.length === 1 ? matches[0] : undefined;
    return matched && !rules?.contradicts(record, matched.slug) ? matched : null;
  }
  const direct = leaf.filter((category) => fold(category.slug) === fold(record.categoryKey));
  const directMatch = direct.length === 1 ? direct[0] : undefined;
  if (directMatch) return rules?.contradicts(record, directMatch.slug) ? null : directMatch;
  if (!rules?.allowNameFallback || condition === "Nuevo") return null;
  const byName = leaf.filter((category) => fold(category.name) === fold(record.categoryName));
  const nameMatch = byName.length === 1 ? byName[0] : undefined;
  return nameMatch && !rules.contradicts(record, nameMatch.slug) ? nameMatch : null;
};
