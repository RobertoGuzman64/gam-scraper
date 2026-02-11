import { resolveCliSelection } from "./cli.js";
import { DEFAULT_CATEGORIES } from "./config.js";
import type { CategoryConfig, CategoryScrapeResult } from "./types.js";
import { writeCategoriesCsv, writeGroupedOutputs, writeOutputs } from "./io.js";
import { scrapeCategory } from "./scrape.js";
import { discoverCategoryTree } from "./tree.js";

const nowIso = (): string => new Date().toISOString();

const uniqueByUrl = (cats: readonly CategoryConfig[]): readonly CategoryConfig[] => {
  const map = new Map<string, CategoryConfig>();
  for (const c of cats) {
    if (!map.has(c.url)) map.set(c.url, c);
  }
  return [...map.values()];
};

const logOptions = (options: {
  readonly outDir: string;
  readonly outPrefix: string;
  readonly maxPages: number;
  readonly stallStopAfter: number;
  readonly concurrencyPages: number;
  readonly concurrencyProducts: number;
  readonly timeoutMs: number;
  readonly delayMs: number;
  readonly userAgent: string;
}): void => {
  console.log(
    [
      "[options]",
      `outDir=${options.outDir}`,
      `outPrefix=${options.outPrefix}`,
      `maxPages=${options.maxPages}`,
      `stallStopAfter=${options.stallStopAfter}`,
      `concurrencyPages=${options.concurrencyPages}`,
      `concurrencyProducts=${options.concurrencyProducts}`,
      `timeoutMs=${options.timeoutMs}`,
      `delayMs=${options.delayMs}`,
      `userAgent=${options.userAgent}`
    ].join(" | ")
  );
};

const logCategoryResult = (prefix: string, r: CategoryScrapeResult): void => {
  console.log(
    [
      `[done] ${prefix}`,
      `discovered=${r.discoveredProductUrls}`,
      `products=${r.products.length}`,
      `failures=${r.failures.length}`
    ].join(" | ")
  );
};

const main = async (): Promise<void> => {
  const selection = resolveCliSelection(process.argv.slice(2));
  const startedAt = nowIso();
  const options = selection.options;

  console.log(`[start] ${startedAt}`);
  console.log(`[mode] ${selection.mode}`);
  logOptions(options);

  if ("onlyCategories" in selection) console.log(`[flags] onlyCategories=${selection.onlyCategories}`);
  if ("discoverSubcategories" in selection) console.log(`[flags] discoverSubcategories=${selection.discoverSubcategories}`);
  if (selection.mode === "tree") console.log(`[tree] rootUrl=${selection.rootUrl}`);

  if (selection.mode === "tree") {
    console.log(`[tree] discovering categories from: ${selection.rootUrl}`);
    const cats = await discoverCategoryTree(selection.rootUrl, options);
    console.log(`[tree] discovered categories: ${cats.length}`);

    await writeCategoriesCsv(options.outDir, options.outPrefix, cats);
    console.log(`[write] ${options.outPrefix}-categories.csv`);

    if (selection.onlyCategories) {
      console.log("[end] onlyCategories=true");
      return;
    }

    const results: CategoryScrapeResult[] = [];
    for (let i = 0; i < cats.length; i += 1) {
      const c = cats[i]!;
      console.log(`[scrape] (${i + 1}/${cats.length}) ${c.key} | ${c.name}`);
      const r = await scrapeCategory(c, options);
      logCategoryResult(`${c.key} | ${c.name}`, r);
      results.push(r);
    }

    const endedAt = nowIso();
    console.log(`[end] ${endedAt} | elapsedMs=${Date.parse(endedAt) - Date.parse(startedAt)}`);
    console.log(`[write] writing outputs...`);
    await writeOutputs(options.outDir, options.outPrefix, results, startedAt, endedAt);
    console.log(`[write] done | prefix=${options.outPrefix}`);
    return;
  }

  if (selection.mode === "single") {
    const roots: readonly CategoryConfig[] = [selection.category];
    console.log(`[single] category=${selection.category.key} | ${selection.category.name}`);
    console.log(`[single] url=${selection.category.url}`);

    if (!selection.discoverSubcategories) {
      const results: CategoryScrapeResult[] = [];
      for (const c of roots) {
        console.log(`[scrape] ${c.key} | ${c.name}`);
        const r = await scrapeCategory(c, options);
        logCategoryResult(`${c.key} | ${c.name}`, r);
        results.push(r);
      }
      const endedAt = nowIso();
      console.log(`[end] ${endedAt} | elapsedMs=${Date.parse(endedAt) - Date.parse(startedAt)}`);
      console.log(`[write] writing outputs...`);
      await writeOutputs(options.outDir, options.outPrefix, results, startedAt, endedAt);
      console.log(`[write] done | prefix=${options.outPrefix}`);
      return;
    }

    console.log(`[tree] discovering subcategories from: ${selection.category.url}`);
    const discovered = await discoverCategoryTree(selection.category.url, options);
    const toScrape = uniqueByUrl(discovered);
    console.log(`[tree] discovered subcategories: ${toScrape.length}`);

    await writeCategoriesCsv(options.outDir, options.outPrefix, uniqueByUrl([selection.category, ...toScrape]));
    console.log(`[write] ${options.outPrefix}-categories.csv`);

    if (selection.onlyCategories) {
      console.log("[end] onlyCategories=true");
      return;
    }

    const resultsForRoot: CategoryScrapeResult[] = [];
    for (let i = 0; i < toScrape.length; i += 1) {
      const c = toScrape[i]!;
      console.log(`[scrape] (${i + 1}/${toScrape.length}) ${c.key} | ${c.name}`);
      const r = await scrapeCategory(c, options);
      logCategoryResult(`${c.key} | ${c.name}`, r);
      resultsForRoot.push(r);
    }

    const endedAt = nowIso();
    console.log(`[end] ${endedAt} | elapsedMs=${Date.parse(endedAt) - Date.parse(startedAt)}`);
    console.log(`[write] writing grouped outputs...`);
    await writeGroupedOutputs(
      options.outDir,
      options.outPrefix,
      [{ parent: selection.category, results: resultsForRoot }],
      startedAt,
      endedAt
    );
    console.log(`[write] done | prefix=${options.outPrefix}`);
    return;
  }

  const roots = selection.categories;
  console.log(`[config] roots=${roots.length} | keys=${roots.map((c) => c.key).join(",")}`);

  if (roots.length === 0) {
    const keys = DEFAULT_CATEGORIES.map((c) => c.key).join(", ");
    throw new Error(`categoryKey no encontrado. Disponibles: ${keys}`);
  }

  if (!selection.discoverSubcategories) {
    const results: CategoryScrapeResult[] = [];
    for (let i = 0; i < roots.length; i += 1) {
      const c = roots[i]!;
      console.log(`[scrape] (${i + 1}/${roots.length}) ${c.key} | ${c.name}`);
      const r = await scrapeCategory(c, options);
      logCategoryResult(`${c.key} | ${c.name}`, r);
      results.push(r);
    }
    const endedAt = nowIso();
    console.log(`[end] ${endedAt} | elapsedMs=${Date.parse(endedAt) - Date.parse(startedAt)}`);
    console.log(`[write] writing outputs...`);
    await writeOutputs(options.outDir, options.outPrefix, results, startedAt, endedAt);
    console.log(`[write] done | prefix=${options.outPrefix}`);
    return;
  }

  const groups: { parent: CategoryConfig; results: CategoryScrapeResult[] }[] = [];
  const allDiscoveredForCsv: CategoryConfig[] = [];

  for (let i = 0; i < roots.length; i += 1) {
    const root = roots[i]!;
    console.log(`[tree] (${i + 1}/${roots.length}) discovering subcategories from root: ${root.key} | ${root.url}`);
    const discovered = await discoverCategoryTree(root.url, options);
    const toScrape = uniqueByUrl(discovered);
    console.log(`[tree] ${root.key} discovered subcategories: ${toScrape.length}`);

    for (const c of uniqueByUrl([root, ...toScrape])) allDiscoveredForCsv.push(c);

    if (selection.onlyCategories) {
      groups.push({ parent: root, results: [] });
      continue;
    }

    const resultsForRoot: CategoryScrapeResult[] = [];
    for (let j = 0; j < toScrape.length; j += 1) {
      const c = toScrape[j]!;
      console.log(`[scrape] ${root.key} -> (${j + 1}/${toScrape.length}) ${c.key} | ${c.name}`);
      const r = await scrapeCategory(c, options);
      logCategoryResult(`${root.key} -> ${c.key} | ${c.name}`, r);
      resultsForRoot.push(r);
    }

    groups.push({ parent: root, results: resultsForRoot });
  }

  await writeCategoriesCsv(options.outDir, options.outPrefix, uniqueByUrl(allDiscoveredForCsv));
  console.log(`[write] ${options.outPrefix}-categories.csv`);
  if (selection.onlyCategories) {
    console.log("[end] onlyCategories=true");
    return;
  }

  const endedAt = nowIso();
  console.log(`[end] ${endedAt} | elapsedMs=${Date.parse(endedAt) - Date.parse(startedAt)}`);
  console.log(`[write] writing grouped outputs...`);
  await writeGroupedOutputs(options.outDir, options.outPrefix, groups, startedAt, endedAt);
  console.log(`[write] done | prefix=${options.outPrefix}`);
};

await main();