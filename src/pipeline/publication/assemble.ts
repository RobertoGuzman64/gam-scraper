import type { CategoryConfig, CategoryScrapeResult, Summary } from "../../contracts/scraping.js";
import type { CatalogSnapshot } from "../../catalog/snapshot.js";
import { dedupeBy, emptyDedupeReport, mergeDedupeReports } from "../../catalog/identity.js";
import { assessCatalogQuality } from "../../catalog/quality.js";
import { describeSerialNumberCollision, findIdentityConflicts, findSerialNumberCollisions } from "../../catalog/identity-conflicts.js";

export type OutputGroup = {
  readonly parent: CategoryConfig;
  readonly results: readonly CategoryScrapeResult[];
};

type ParentProduct = {
  readonly parent: CategoryConfig;
  readonly product: CategoryScrapeResult["products"][number];
};

export const assemblePublication = (groups: readonly OutputGroup[], previous: CatalogSnapshot | null) => {
  const allResults = groups.flatMap((group) => [...group.results]);
  const allProductsPreGlobal: ParentProduct[] = [];
  const categoryData: { readonly parent: CategoryConfig; readonly products: readonly CategoryScrapeResult["products"][number][] }[] = [];
  const categorySummaries: Summary["categories"][number][] = [];
  let withinCategories = emptyDedupeReport();

  for (const group of groups) {
    const rawProducts = group.results.flatMap((result) => [...result.products]);
    const deduped = dedupeBy(rawProducts, (product) => product);
    withinCategories = mergeDedupeReports(withinCategories, deduped.report);
    for (const product of deduped.unique) allProductsPreGlobal.push({ parent: group.parent, product });
    categoryData.push({ parent: group.parent, products: deduped.unique });
    categorySummaries.push({
      key: group.parent.key,
      name: group.parent.name,
      url: group.parent.url,
      discoveredProductUrls: group.results.reduce((sum, result) => sum + result.discoveredProductUrls, 0),
      ...(group.results.length === 1 && group.results[0]?.expectedProductUrls !== undefined
        ? { expectedProductUrls: group.results[0].expectedProductUrls } : {}),
      scrapedProductsRaw: rawProducts.length,
      scrapedProducts: deduped.unique.length,
      failures: group.results.reduce((sum, result) => sum + result.failures.length, 0),
      dedupe: deduped.report
    });
  }

  const global = dedupeBy(allProductsPreGlobal, (entry) => entry.product);
  const currentProducts = global.unique.map((entry) => entry.product);
  const rawProducts = allResults.flatMap((result) => result.products);
  const identityConflicts = findIdentityConflicts(rawProducts);
  const serialWarnings = findSerialNumberCollisions(rawProducts).map(describeSerialNumberCollision);
  const quality = assessCatalogQuality(allResults, currentProducts, previous, identityConflicts, serialWarnings);
  return {
    allResults,
    categoryData,
    categorySummaries,
    currentProducts,
    global,
    identityConflicts,
    serialWarnings,
    quality,
    withinCategories
  };
};
