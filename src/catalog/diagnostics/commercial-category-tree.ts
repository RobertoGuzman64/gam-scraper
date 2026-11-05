import type { ImportCatalog } from "../legacy-export/contracts.js";
import type { CommercialPresentationAudit } from "./commercial-presentation.js";

type Category = ImportCatalog["categories"][number];
type Product = CommercialPresentationAudit["decisions"][number];

export type CommercialCategoryTreeProvider = {
  readonly providerId: string;
  readonly decisions: readonly Product[];
};

type TreeProduct = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly title: string | null;
};

const sortProducts = (products: readonly TreeProduct[]): TreeProduct[] => [...products].sort((a, b) =>
  a.providerId.localeCompare(b.providerId, "es") ||
  (a.reference ?? "").localeCompare(b.reference ?? "", "es", { numeric: true }) ||
  a.sourceUrl.localeCompare(b.sourceUrl, "es")
);

const describe = (item: TreeProduct): string => {
  const reference = item.reference?.trim() || new URL(item.sourceUrl).pathname.split("/").filter(Boolean).at(-1) || "sin referencia";
  const title = (item.title ?? "Sin título").replace(/\s+/g, " ").trim();
  const shortTitle = [...title].length > 105 ? `${[...title].slice(0, 104).join("")}…` : title;
  return `${item.providerId.toUpperCase()} ${reference} — ${shortTitle}`;
};

export const renderCommercialCategoryTree = (
  categories: ImportCatalog["categories"], providers: readonly CommercialCategoryTreeProvider[]
): readonly string[] => {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const byParent = new Map<number | null, Category[]>();
  for (const category of categories) {
    const children = byParent.get(category.parentId) ?? [];
    children.push(category);
    byParent.set(category.parentId, children);
  }
  const productsByCategory = new Map<number, TreeProduct[]>();
  const counts = new Map<number, number>();
  const pending: TreeProduct[] = [];
  let excluded = 0;
  for (const provider of providers) {
    for (const decision of provider.decisions) {
      if (decision.status === "excluded") {
        excluded += 1;
        continue;
      }
      const product: TreeProduct = { providerId: provider.providerId, reference: decision.reference,
        sourceUrl: decision.sourceUrl, title: decision.title };
      if (decision.status === "pending" || decision.categorySellID === null) {
        pending.push(product);
        continue;
      }
      const assigned = productsByCategory.get(decision.categorySellID) ?? [];
      assigned.push(product);
      productsByCategory.set(decision.categorySellID, assigned);
      let categoryId: number | null = decision.categorySellID;
      const visited = new Set<number>();
      while (categoryId !== null) {
        if (visited.has(categoryId)) throw new Error(`Ciclo en la jerarquía comercial: ${categoryId}`);
        visited.add(categoryId);
        const category = byId.get(categoryId);
        if (!category) throw new Error(`Categoría comercial inexistente: ${categoryId}`);
        counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
        categoryId = category.parentId;
      }
    }
  }
  const categorized = [...productsByCategory.values()].reduce((sum, products) => sum + products.length, 0);
  const lines = [`ÁRBOL COMERCIAL | ${categorized} categorizadas | ${pending.length} pendientes | ${excluded} excluidas`];
  const writeCategory = (category: Category, prefix: string, last: boolean): void => {
    lines.push(`${prefix}${last ? "└─" : "├─"} ${category.name} [${category.id}] · ${counts.get(category.id) ?? 0}`);
    const nextPrefix = `${prefix}${last ? "   " : "│  "}`;
    const children = (byParent.get(category.id) ?? []).filter((child) => counts.has(child.id));
    const products = sortProducts(productsByCategory.get(category.id) ?? []);
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child) writeCategory(child, nextPrefix, index === children.length - 1 && products.length === 0);
    }
    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      if (product) lines.push(`${nextPrefix}${index === products.length - 1 ? "└─" : "├─"} ${describe(product)}`);
    }
  };
  const roots = (byParent.get(null) ?? []).filter((category) => counts.has(category.id));
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    if (root) writeCategory(root, "", index === roots.length - 1);
  }
  if (pending.length > 0) {
    lines.push(`SIN CATEGORÍA · ${pending.length}`);
    for (const product of sortProducts(pending)) lines.push(`  ${describe(product)}`);
  }
  return lines;
};
