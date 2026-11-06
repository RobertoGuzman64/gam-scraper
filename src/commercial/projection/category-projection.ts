import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { fold } from "../../preparation/shared/classification/mapping/category-utils.js";
import { isLeafCategoryForCondition, resolveCategory } from "../../preparation/shared/classification/mapping/category-mapping.js";
import { productAttributes } from "../../preparation/product-attributes.js";
import { contradictsGamGlpCategory, documentedSourceCommercialSlug } from "./source-category-evidence.js";
import { reconcileGamSourceForCommercialFallback, reconcileSourceForCommercialProjection } from "./gam-category-evidence.js";

const generalCategorySlugs = new Set([
  "plataforma-articulada",
  "plataforma-elevadora",
  "carretilla-elevadora",
  "manipulacion-elevacion-cargas",
  "manipulacion-elevacion-cargas-segunda-mano",
  "maquinaria-construccion-segunda-mano",
  "vehiculos-segunda-mano",
  "casetas-contenedores-vallas-segunda-mano"
]);

const belongsToCondition = (
  categoryId: number, categories: ImportCatalog["categories"], condition: Exclude<ImportCandidate["condition"], null>
): boolean => {
  const expectedRoot = condition === "Nuevo" ? "maquinaria nueva" : "maquinaria de ocasion";
  const byId = new Map(categories.map((item) => [item.id, item]));
  let cursor = byId.get(categoryId);
  const visited = new Set<number>();
  while (cursor && !visited.has(cursor.id) && cursor.active !== false) {
    if (fold(cursor.name) === expectedRoot) return true;
    visited.add(cursor.id);
    cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
  }
  return false;
};

export const isValidCommercialCategory = (
  source: ProductRecord, categoryId: number, condition: ImportCandidate["condition"], catalog: ImportCatalog
): boolean => {
  if (!condition) return false;
  const categories = catalog.categories.filter((item) => item.id === categoryId && item.active !== false);
  if (categories.length !== 1 || !belongsToCondition(categoryId, catalog.categories, condition)) return false;
  const category = categories[0];
  if (!category) return false;
  if (category.slug === "plataforma-unipersonal-electrica" &&
    documentedSourceCommercialSlug(source, condition) === "plataforma-elevadora") return false;
  const categorySource = reconcileSourceForCommercialProjection(source);
  if (isLeafCategoryForCondition(categoryId, catalog.categories, condition)) {
    const sourceCategory = resolveCategory(categorySource, catalog.categories, condition);
    if (contradictsGamGlpCategory(source, categorySource, category.slug, categoryId, sourceCategory?.id)) return false;
    if (sourceCategory) return sourceCategory.id === categoryId;
    const fallbackSource = reconcileGamSourceForCommercialFallback(source);
    if (fallbackSource) {
      const reconciledCategory = resolveCategory(fallbackSource, catalog.categories, condition);
      if (reconciledCategory) return reconciledCategory.id === categoryId;
    }
    const documentedSlug = documentedSourceCommercialSlug(source, condition);
    if (documentedSlug === null) return false;
    const documentedCategories = catalog.categories.filter((entry) =>
      entry.slug === documentedSlug && entry.active !== false);
    const documented = documentedCategories.length === 1 ? documentedCategories[0] : undefined;
    return documented !== undefined && documented.id === categoryId &&
      isLeafCategoryForCondition(documented.id, catalog.categories, condition);
  }
  return generalCategorySlugs.has(category.slug) && documentedSourceCommercialSlug(source, condition) === category.slug;
};

export const projectCommercialCategory = (
  source: ProductRecord, mapped: PreparedProduct, catalog: ImportCatalog
): PreparedProduct => {
  if (mapped.product.categorySellID !== null) return mapped;
  const slug = documentedSourceCommercialSlug(source, mapped.product.condition);
  if (!slug) return mapped;
  const candidates = catalog.categories.filter((item) => item.slug === slug && item.active !== false);
  const category = candidates.length === 1 ? candidates[0] : undefined;
  if (!category || !isValidCommercialCategory(source, category.id, mapped.product.condition, catalog)) return mapped;
  const resolved = productAttributes(reconcileSourceForCommercialProjection(source), category, catalog);
  const product: ImportCandidate = {
    ...mapped.product, categorySellID: category.id, category: category.name,
    attributes: resolved.attributes
  };
  return { ...mapped, product };
};
