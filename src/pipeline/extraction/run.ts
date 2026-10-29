import { join, resolve } from "node:path";
import { isPortableExtraction } from "./portable-eligibility.js";
import { consolidatePortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { cleanConsolidatedCatalogHistory } from "../../infrastructure/filesystem/catalog/catalog-retention.js";
import type { ScraperProvider } from "../../scraping/provider.js";
import type { CategoryConfig, CategoryScrapeResult, ScrapeOptions, Summary } from "../../contracts/scraping.js";

import { writeCategoriesCsv, writeGroupedOutputs, writeOutputs } from "../publication/publish.js";

import type { ProductPageCache } from "../../scraping/engine/scrape-category.js";
import { scrapeSafely } from "./category.js";
import { readSummary, readFirstFailure } from "./summary.js";

import type { ScrapeRunSelection, ScrapeRunReporter } from "./types.js";

const nowIso = (): string => new Date().toISOString();

const uniqueByUrl = (cats: readonly CategoryConfig[]): readonly CategoryConfig[] => {
  const map = new Map<string, CategoryConfig>();
  for (const c of cats) {
    if (!map.has(c.url)) map.set(c.url, c);
  }
  return [...map.values()];
};

export const runScrape = async (selection: ScrapeRunSelection, reporter: ScrapeRunReporter): Promise<boolean> => {
  const startedAt = nowIso();
  const options = selection.options;
  const provider = selection.provider;
  const cache: ProductPageCache = new Map();

  const finish = async (write: () => Promise<void>): Promise<boolean> => {
    let error: unknown = null;
    reporter.stage("publicando resultados", options.outDir);
    try {
      await write();
      if (isPortableExtraction(selection, process.cwd())) {
        await consolidatePortableOriginal(process.cwd(),
          join(resolve(options.outDir), `${options.outPrefix}-catalog.json`));
        // The publish step has succeeded. Cleanup is best-effort and must not
        // misreport a valid extraction if an unfamiliar history is protected.
        try {
          await cleanConsolidatedCatalogHistory(process.cwd(), provider.id, options.outDir, options.outPrefix);
        } catch (cleanupError) {
          console.warn(`Aviso: historial individual conservado: ${String(cleanupError)}`);
        }
      }
    } catch (reason) {
      error = reason;
    }
    const summary = await readSummary(options.outDir, options.outPrefix, startedAt);
    const failureDetail = error !== null && summary ? await readFirstFailure(options.outDir, options.outPrefix) : null;
    reporter.finish(summary, startedAt, error, failureDetail);
    return error === null && summary?.quality?.status === "complete" && summary.quality.published === true;
  };

  if (selection.mode === "tree") {
    reporter.stage("descubriendo categorías", selection.rootUrl);
    const cats = await provider.discoverCategoryTree(selection.rootUrl, options);
    reporter.start(cats.length);
    reporter.stage("guardando categorías", options.outDir);
    await writeCategoriesCsv(options.outDir, options.outPrefix, cats);

    if (selection.onlyCategories) {
      reporter.categoriesSaved(cats.length);
      return true;
    }

    const results: CategoryScrapeResult[] = [];
    for (let i = 0; i < cats.length; i += 1) {
      const c = cats[i]!;
      results.push(await scrapeSafely(c, options, provider, cache, reporter, i + 1, cats.length));
    }
    return finish(() => writeOutputs(options.outDir, options.outPrefix, results, startedAt, nowIso()));
  }

  if (selection.mode === "single") {
    if (!selection.discoverSubcategories) {
      reporter.start(1);
      const result = await scrapeSafely(selection.category, options, provider, cache, reporter, 1, 1);
      return finish(() => writeOutputs(options.outDir, options.outPrefix, [result], startedAt, nowIso()));
    }

    reporter.stage("descubriendo subcategorías", selection.category.url);
    const discovered = await provider.discoverCategoryTree(selection.category.url, options);
    const toScrape = uniqueByUrl(discovered);
    reporter.start(toScrape.length);
    reporter.stage("guardando categorías", options.outDir);
    const categoriesForCsv = uniqueByUrl([selection.category, ...toScrape]);
    await writeCategoriesCsv(options.outDir, options.outPrefix, categoriesForCsv);

    if (selection.onlyCategories) {
      reporter.categoriesSaved(categoriesForCsv.length);
      return true;
    }

    const resultsForRoot: CategoryScrapeResult[] = [];
    for (let i = 0; i < toScrape.length; i += 1) {
      const c = toScrape[i]!;
      resultsForRoot.push(await scrapeSafely(c, options, provider, cache, reporter, i + 1, toScrape.length));
    }
    return finish(() => writeGroupedOutputs(
      options.outDir,
      options.outPrefix,
      [{ parent: selection.category, results: resultsForRoot }],
      startedAt,
      nowIso()
    ));
  }

  const roots = selection.categories;
  reporter.start(roots.length);
  if (roots.length === 0) {
    const keys = provider.categories.map((c) => c.key).join(", ");
    throw new Error(`categoryKey no encontrado. Disponibles: ${keys}`);
  }

  if (!selection.discoverSubcategories) {
    const results: CategoryScrapeResult[] = [];
    for (let i = 0; i < roots.length; i += 1) {
      const c = roots[i]!;
      results.push(await scrapeSafely(c, options, provider, cache, reporter, i + 1, roots.length));
    }
    return finish(() => writeOutputs(options.outDir, options.outPrefix, results, startedAt, nowIso()));
  }

  const groups: { parent: CategoryConfig; results: CategoryScrapeResult[] }[] = [];
  const allDiscoveredForCsv: CategoryConfig[] = [];

  for (const root of roots) {
    reporter.stage("descubriendo subcategorías", root.url);
    const discovered = await provider.discoverCategoryTree(root.url, options);
    const toScrape = uniqueByUrl(discovered);
    for (const c of uniqueByUrl([root, ...toScrape])) allDiscoveredForCsv.push(c);
    if (selection.onlyCategories) {
      groups.push({ parent: root, results: [] });
      continue;
    }

    const resultsForRoot: CategoryScrapeResult[] = [];
    for (let j = 0; j < toScrape.length; j += 1) {
      const c = toScrape[j]!;
      resultsForRoot.push(await scrapeSafely(c, options, provider, cache, reporter, j + 1, toScrape.length));
    }
    groups.push({ parent: root, results: resultsForRoot });
  }

  reporter.stage("guardando categorías", options.outDir);
  const categoriesForCsv = uniqueByUrl(allDiscoveredForCsv);
  await writeCategoriesCsv(options.outDir, options.outPrefix, categoriesForCsv);
  if (selection.onlyCategories) {
    reporter.categoriesSaved(categoriesForCsv.length);
    return true;
  }

  return finish(() => writeGroupedOutputs(options.outDir, options.outPrefix, groups, startedAt, nowIso()));
};
