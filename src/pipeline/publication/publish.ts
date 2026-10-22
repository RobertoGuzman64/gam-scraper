import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { buildCatalogItems, categoryScope, compareCatalog, parseCatalogSnapshot } from "../../catalog/snapshot.js";
import type { CatalogSnapshot } from "../../catalog/snapshot.js";
import type { CategoryConfig, CategoryScrapeResult, Summary } from "../../contracts/scraping.js";
import { assemblePublication } from "./assemble.js";
import type { OutputGroup } from "./assemble.js";

import { toCsv } from "../../shared/csv.js";
import { serializeCategoriesCsv, listSpecKeys, buildProductHeaders, toProductRow } from "./csv-serializer.js";
import { atomicWrite } from "../../infrastructure/filesystem/atomic-write.js";
import { abandonArchive, cleanCatalogExcess, finalizePublishedCatalog, restorePublishedCatalog, stagePublishedCatalog } from "../../infrastructure/filesystem/catalog-retention.js";
import { buildLegacyPreparation } from "./legacy-preparation.js";
import { writeCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";

export const writeCategoriesCsv = async (
  outDir: string,
  outPrefix: string,
  categories: readonly CategoryConfig[]
): Promise<void> => {
  await mkdir(outDir, { recursive: true });
  await atomicWrite(resolve(outDir, `${outPrefix}-categories.csv`), serializeCategoriesCsv(categories));
};

const loadSnapshot = async (filePath: string, scope: string): Promise<CatalogSnapshot | null> => {
  try {
    return parseCatalogSnapshot(await readFile(filePath, "utf8"), scope);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

const writeResultGroups = async (
  outDir: string,
  outPrefix: string,
  groups: readonly OutputGroup[],
  startedAt: string,
  endedAt: string,
  grouped: boolean
): Promise<void> => {
  await mkdir(outDir, { recursive: true });
  const scope = categoryScope(groups.map((group) => group.parent), grouped ? "grouped" : "flat");
  const snapshotFile = resolve(outDir, `${outPrefix}-snapshot-${scope}.json`);
  const previous = await loadSnapshot(snapshotFile, scope);
  const { allResults, categoryData, categorySummaries, currentProducts, global,
    identityConflicts, serialWarnings, quality, withinCategories } = assemblePublication(groups, previous);
  const providerIds = new Set(currentProducts.map((product) => product.providerId));
  if (providerIds.size > 1) throw new Error("No se pueden publicar productos de proveedores distintos en un mismo catálogo");

  const outputPrefix = quality.published ? outPrefix : `${outPrefix}-partial`;
  const pending = quality.published ? await stagePublishedCatalog(outDir, outPrefix) : null;
  try {
    if (!grouped) {
      await writeCategoriesCsv(outDir, outputPrefix, groups.map((group) => group.parent));
    }

    for (const { parent, products } of categoryData) {
      const specKeys = listSpecKeys(products);
      await atomicWrite(resolve(outDir, `${outputPrefix}-${parent.key}.csv`), toCsv(
        products.map((product) => toProductRow(parent, product, specKeys)), buildProductHeaders(specKeys)
      ));
    }
    const globalSpecKeys = listSpecKeys(currentProducts);
    const aggregateCsv = toCsv(
      global.unique.map(({ parent, product }) => toProductRow(parent, product, globalSpecKeys)),
      buildProductHeaders(globalSpecKeys)
    );
    await atomicWrite(resolve(outDir, `${outputPrefix}-all.csv`), aggregateCsv);
    const catalogSha256 = quality.published
      ? await writeCanonicalCatalog(outDir, outPrefix, scope, startedAt, endedAt, currentProducts)
      : null;
    const preparationContent = await buildLegacyPreparation(currentProducts, quality.status, quality.published);
    const hash = (content: string): string => createHash("sha256").update(content).digest("hex");

    const summary: Summary = {
      startedAt,
      endedAt,
      quality,
      artifacts: { csvSha256: hash(aggregateCsv), preparationSha256: hash(preparationContent),
        ...(catalogSha256 ? { catalogSha256 } : {}) },
      totals: {
        categories: groups.length,
        discoveredProductUrls: categorySummaries.reduce((sum, category) => sum + category.discoveredProductUrls, 0),
        scrapedProductsRaw: categorySummaries.reduce((sum, category) => sum + category.scrapedProductsRaw, 0),
        scrapedProductsByCategorySum: categorySummaries.reduce((sum, category) => sum + category.scrapedProducts, 0),
        scrapedProducts: currentProducts.length,
        failures: categorySummaries.reduce((sum, category) => sum + category.failures, 0),
        dedupe: { withinCategories, globalAll: global.report }
      },
      categories: categorySummaries
    };
    const failures = allResults.flatMap((result) => result.failures.map((failure) => ({
      categoryKey: result.category.key,
      ...failure
    })));
    const summaryFile = resolve(outDir, `${outPrefix}-summary.json`);
    await atomicWrite(resolve(outDir, `${outPrefix}-errors.json`), JSON.stringify({
      quality: quality.status, failures, identityConflicts, serialWarnings
    }, null, 2));
    await atomicWrite(resolve(outDir, `${outputPrefix}-preparation.json`), preparationContent);

    if (!quality.published) {
      await atomicWrite(summaryFile, JSON.stringify(summary, null, 2));
      await atomicWrite(resolve(outDir, `${outPrefix}-changes.json`), JSON.stringify({
        status: "not-comparable", reasons: quality.reasons, suspectedMissing: []
      }, null, 2));
      throw new Error(`Extracción ${quality.status}: ${quality.reasons.join("; ")}. Los CSV anteriores se conservan; revisar ${outPrefix}-summary.json`);
    }

    const items = buildCatalogItems(currentProducts);
    const changes = compareCatalog(previous, items);
    await atomicWrite(resolve(outDir, `${outPrefix}-changes.json`), JSON.stringify({
      status: "comparable", scope, ...changes
    }, null, 2));
    await atomicWrite(snapshotFile, JSON.stringify({ version: 1, scope, createdAt: endedAt, items } satisfies CatalogSnapshot, null, 2));
    await atomicWrite(summaryFile, JSON.stringify(summary, null, 2));
    await finalizePublishedCatalog(outDir, outPrefix, pending);
  } catch (error) {
    if (pending) await restorePublishedCatalog(outDir, outPrefix, pending);
    await abandonArchive(pending);
    throw error;
  }
  await cleanCatalogExcess(outDir, outPrefix, false);
};

export const writeGroupedOutputs = async (
  outDir: string,
  outPrefix: string,
  groups: readonly OutputGroup[],
  startedAt: string,
  endedAt: string
): Promise<void> => writeResultGroups(outDir, outPrefix, groups, startedAt, endedAt, true);

export const writeOutputs = async (
  outDir: string,
  outPrefix: string,
  results: readonly CategoryScrapeResult[],
  startedAt: string,
  endedAt: string
): Promise<void> => writeResultGroups(outDir, outPrefix, results.map((result) => ({
  parent: result.category, results: [result]
})), startedAt, endedAt, false);
