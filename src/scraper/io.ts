import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  CategoryConfig,
  CategoryScrapeResult,
  DedupeReason,
  DedupeReport,
  SpecScalar,
  SpecValue,
  SpecsMap,
  Summary
} from "./types.js";
import { toCsv } from "../shared/csv.js";

const baseProductHeaders = [
  "categoryKey",
  "categoryName",
  "title",
  "shortDescription",
  "longDescription",
  "price",
  "reference",
  "brand",
  "model",
  "year",
  "location",
  "country",
  "horometer",
  "serialNumber",
  "image",
  "url",
  "specJson"
] as const;

const categoryHeaders = ["categoryKey", "categoryName", "categoryUrl"] as const;

type CategoryHeader = (typeof categoryHeaders)[number];
type CategoryCsvRow = Record<CategoryHeader, string>;

type DedupeEntity = {
  readonly reference: string | null;
  readonly serialNumber: string | null;
  readonly url: string;
};

type ParentProduct = {
  readonly parent: CategoryConfig;
  readonly product: CategoryScrapeResult["products"][number];
};

const canonicalizeNoQueryNoHash = (url: string): string => {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch {
    return url.trim();
  }
};

const normalizeKey = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");
const normalizeSpecKey = (s: string): string => s.trim().replace(/\s+/g, " ");

const specColumnName = (specKey: string): string => `spec__${specKey}`;

const specScalarToString = (v: SpecScalar): string => {
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const specValueToString = (v: SpecValue): string => {
  if (Array.isArray(v)) return v.map(specScalarToString).join(" | ");
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return specScalarToString(v);
  return "";
};

const normalizeSpecs = (specs: SpecsMap): Record<string, SpecValue> => {
  const out: Record<string, SpecValue> = {};
  for (const [k, v] of Object.entries(specs)) out[normalizeSpecKey(k)] = v;
  return out;
};

const listSpecKeys = (products: readonly { readonly specs?: SpecsMap }[]): string[] => {
  const set = new Set<string>();
  for (const p of products) {
    const specs = p.specs;
    if (!specs) continue;
    for (const k of Object.keys(specs)) set.add(normalizeSpecKey(k));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
};

const buildProductHeaders = (specKeys: readonly string[]): readonly string[] => [
  ...baseProductHeaders,
  ...specKeys.map(specColumnName)
];

const emptyDedupeReport = (): DedupeReport => ({
  kept: 0,
  removed: 0,
  byReason: { reference: 0, serialNumber: 0, canonicalUrl: 0 }
});

const mergeDedupeReports = (a: DedupeReport, b: DedupeReport): DedupeReport => ({
  kept: a.kept + b.kept,
  removed: a.removed + b.removed,
  byReason: {
    reference: a.byReason.reference + b.byReason.reference,
    serialNumber: a.byReason.serialNumber + b.byReason.serialNumber,
    canonicalUrl: a.byReason.canonicalUrl + b.byReason.canonicalUrl
  }
});

const buildDedupeKey = (e: DedupeEntity): { readonly reason: DedupeReason; readonly key: string } => {
  const ref = (e.reference ?? "").trim();
  if (ref) return { reason: "reference", key: `ref:${normalizeKey(ref)}` };

  const serial = (e.serialNumber ?? "").trim();
  if (serial) return { reason: "serialNumber", key: `sn:${normalizeKey(serial)}` };

  return { reason: "canonicalUrl", key: `url:${canonicalizeNoQueryNoHash(e.url)}` };
};

const dedupeBy = <T>(
  items: readonly T[],
  getEntity: (item: T) => DedupeEntity
): { readonly unique: T[]; readonly report: DedupeReport } => {
  const seen = new Set<string>();
  const unique: T[] = [];
  const byReason: Record<DedupeReason, number> = { reference: 0, serialNumber: 0, canonicalUrl: 0 };

  for (const item of items) {
    const k = buildDedupeKey(getEntity(item));
    if (seen.has(k.key)) {
      byReason[k.reason] += 1;
      continue;
    }
    seen.add(k.key);
    unique.push(item);
  }

  return {
    unique,
    report: {
      kept: unique.length,
      removed: items.length - unique.length,
      byReason
    }
  };
};

export const writeCategoriesCsv = async (
  outDir: string,
  outPrefix: string,
  categories: readonly CategoryConfig[]
): Promise<void> => {
  await mkdir(outDir, { recursive: true });

  const rows = categories.map<CategoryCsvRow>((c) => ({
    categoryKey: c.key,
    categoryName: c.name,
    categoryUrl: c.url
  }));

  const csv = toCsv(rows, categoryHeaders);
  await writeFile(resolve(outDir, `${outPrefix}-categories.csv`), csv, "utf8");
};

const toProductRow = (
  category: CategoryConfig,
  p: CategoryScrapeResult["products"][number],
  specKeys: readonly string[]
): Record<string, string> => {
  const specs: SpecsMap = p.specs ?? {};
  const specsNorm = normalizeSpecs(specs);
  const specJson = JSON.stringify(specs) ?? "{}";

  const row: Record<string, string> = {
    categoryKey: category.key,
    categoryName: category.name,
    title: p.title ?? "",
    shortDescription: p.shortDescription ?? "",
    longDescription: p.longDescription ?? "",
    price: p.price ?? "",
    reference: p.reference ?? "",
    brand: p.brand ?? "",
    model: p.model ?? "",
    year: p.year ?? "",
    location: p.location ?? "",
    country: p.country ?? "",
    horometer: p.horometer ?? "",
    serialNumber: p.serialNumber ?? "",
    image: p.image ?? "",
    url: p.url,
    specJson
  };

  for (const k of specKeys) {
    const v = specsNorm[k];
    row[specColumnName(k)] = v === undefined ? "" : specValueToString(v);
  }

  return row;
};

export const writeGroupedOutputs = async (
  outDir: string,
  outPrefix: string,
  groups: readonly { readonly parent: CategoryConfig; readonly results: readonly CategoryScrapeResult[] }[],
  startedAt: string,
  endedAt: string
): Promise<void> => {
  await mkdir(outDir, { recursive: true });

  type SummaryCategory = Summary["categories"][number];
  const categorySummaries: SummaryCategory[] = [];

  const allProductsPreGlobal: ParentProduct[] = [];
  let withinCategories = emptyDedupeReport();

  for (const g of groups) {
    let discoveredProductUrls = 0;
    let failures = 0;

    const rawProducts: CategoryScrapeResult["products"][number][] = [];

    for (const r of g.results) {
      discoveredProductUrls += r.discoveredProductUrls;
      failures += r.failures.length;
      for (const p of r.products) rawProducts.push(p);
    }

    const deduped = dedupeBy(rawProducts, (p) => p);
    withinCategories = mergeDedupeReports(withinCategories, deduped.report);

    for (const p of deduped.unique) allProductsPreGlobal.push({ parent: g.parent, product: p });

    const specKeys = listSpecKeys(deduped.unique);
    const headers = buildProductHeaders(specKeys);
    const rows = deduped.unique.map((p) => toProductRow(g.parent, p, specKeys));
    const csv = toCsv(rows, headers);
    await writeFile(resolve(outDir, `${outPrefix}-${g.parent.key}.csv`), csv, "utf8");

    categorySummaries.push({
      key: g.parent.key,
      name: g.parent.name,
      url: g.parent.url,
      discoveredProductUrls,
      scrapedProductsRaw: rawProducts.length,
      scrapedProducts: deduped.unique.length,
      failures,
      dedupe: deduped.report
    });
  }

  const global = dedupeBy(allProductsPreGlobal, (pp) => pp.product);
  const globalSpecKeys = listSpecKeys(global.unique.map((pp) => pp.product));
  const globalHeaders = buildProductHeaders(globalSpecKeys);
  const globalRows = global.unique.map((pp) => toProductRow(pp.parent, pp.product, globalSpecKeys));
  const allCsv = toCsv(globalRows, globalHeaders);
  await writeFile(resolve(outDir, `${outPrefix}-all.csv`), allCsv, "utf8");

  const totalsDiscovered = categorySummaries.reduce((acc, c) => acc + c.discoveredProductUrls, 0);
  const totalsRaw = categorySummaries.reduce((acc, c) => acc + c.scrapedProductsRaw, 0);
  const totalsByCategory = categorySummaries.reduce((acc, c) => acc + c.scrapedProducts, 0);
  const totalsFailures = categorySummaries.reduce((acc, c) => acc + c.failures, 0);

  const summary: Summary = {
    startedAt,
    endedAt,
    totals: {
      categories: groups.length,
      discoveredProductUrls: totalsDiscovered,
      scrapedProductsRaw: totalsRaw,
      scrapedProductsByCategorySum: totalsByCategory,
      scrapedProducts: global.unique.length,
      failures: totalsFailures,
      dedupe: {
        withinCategories,
        globalAll: global.report
      }
    },
    categories: categorySummaries
  };

  await writeFile(resolve(outDir, `${outPrefix}-summary.json`), JSON.stringify(summary, null, 2), "utf8");
};

export const writeOutputs = async (
  outDir: string,
  outPrefix: string,
  results: readonly CategoryScrapeResult[],
  startedAt: string,
  endedAt: string
): Promise<void> => {
  await mkdir(outDir, { recursive: true });

  await writeCategoriesCsv(
    outDir,
    outPrefix,
    results.map((r) => r.category)
  );

  type SummaryCategory = Summary["categories"][number];
  const categorySummaries: SummaryCategory[] = [];

  const allProductsPreGlobal: ParentProduct[] = [];
  let withinCategories = emptyDedupeReport();

  for (const r of results) {
    const rawProducts = [...r.products];
    const deduped = dedupeBy(rawProducts, (p) => p);
    withinCategories = mergeDedupeReports(withinCategories, deduped.report);

    for (const p of deduped.unique) allProductsPreGlobal.push({ parent: r.category, product: p });

    const specKeys = listSpecKeys(deduped.unique);
    const headers = buildProductHeaders(specKeys);
    const rows = deduped.unique.map((p) => toProductRow(r.category, p, specKeys));
    const csv = toCsv(rows, headers);
    await writeFile(resolve(outDir, `${outPrefix}-${r.category.key}.csv`), csv, "utf8");

    categorySummaries.push({
      key: r.category.key,
      name: r.category.name,
      url: r.category.url,
      discoveredProductUrls: r.discoveredProductUrls,
      scrapedProductsRaw: rawProducts.length,
      scrapedProducts: deduped.unique.length,
      failures: r.failures.length,
      dedupe: deduped.report
    });
  }

  const global = dedupeBy(allProductsPreGlobal, (pp) => pp.product);
  const globalSpecKeys = listSpecKeys(global.unique.map((pp) => pp.product));
  const globalHeaders = buildProductHeaders(globalSpecKeys);
  const globalRows = global.unique.map((pp) => toProductRow(pp.parent, pp.product, globalSpecKeys));
  const allCsv = toCsv(globalRows, globalHeaders);
  await writeFile(resolve(outDir, `${outPrefix}-all.csv`), allCsv, "utf8");

  const totalsDiscovered = results.reduce((acc, r) => acc + r.discoveredProductUrls, 0);
  const totalsRaw = categorySummaries.reduce((acc, c) => acc + c.scrapedProductsRaw, 0);
  const totalsByCategory = categorySummaries.reduce((acc, c) => acc + c.scrapedProducts, 0);
  const totalsFailures = results.reduce((acc, r) => acc + r.failures.length, 0);

  const summary: Summary = {
    startedAt,
    endedAt,
    totals: {
      categories: results.length,
      discoveredProductUrls: totalsDiscovered,
      scrapedProductsRaw: totalsRaw,
      scrapedProductsByCategorySum: totalsByCategory,
      scrapedProducts: global.unique.length,
      failures: totalsFailures,
      dedupe: {
        withinCategories,
        globalAll: global.report
      }
    },
    categories: categorySummaries
  };

  await writeFile(resolve(outDir, `${outPrefix}-summary.json`), JSON.stringify(summary, null, 2), "utf8");
};