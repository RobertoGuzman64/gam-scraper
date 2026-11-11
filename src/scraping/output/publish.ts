import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  assessCatalogQuality, buildCatalogItems, categoryScope, compareCatalog,
  describeSerialNumberCollision, findIdentityConflicts, findSerialNumberCollisions,
  parseCatalogSnapshot, validateScrapedProduct
} from "../../catalog/quality.js";
import type { CatalogSnapshot } from "../../catalog/quality.js";
import { dedupeBy, emptyDedupeReport, mergeDedupeReports } from "../../catalog/identity.js";
import { parseCanonicalCatalog } from "../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult, Summary } from "../../contracts/scraping.js";
import { atomicWrite } from "../../infrastructure/filesystem/atomic-write.js";
import { writeCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import {
  abandonArchive, cleanCatalogExcess, finalizePublishedCatalog, restorePublishedCatalog,
  stagePublishedCatalog
} from "../../infrastructure/filesystem/catalog/catalog-retention.js";
import { prepareImportBatch } from "../../preparation/prepare.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { serializeCategoriesCsv, serializeProductsCsv } from "./csv-serializer.js";

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const asJson = (value: unknown): string => JSON.stringify(value, null, 2);

const readPreviousSnapshot = async (dir: string, prefix: string, scope: string): Promise<CatalogSnapshot | null> => {
  try {
    return parseCatalogSnapshot(await readFile(join(dir, `${prefix}-snapshot-${scope}.json`), "utf8"), scope);
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

const writeReport = async (dir: string, prefix: string, name: string, content: string): Promise<void> =>
  atomicWrite(join(dir, `${prefix}-${name}`), content);

type Group = { readonly parent: CategoryConfig; readonly results: readonly CategoryScrapeResult[] };

const publish = async (
  outDir: string, prefix: string, results: readonly CategoryScrapeResult[],
  startedAt: string, endedAt: string, categories: readonly CategoryConfig[],
  mode: "flat" | "grouped"
): Promise<void> => {
  if (!/^[a-zA-Z0-9_-]+$/.test(prefix)) throw new Error("Prefijo de extracción inválido");
  if (!Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(endedAt)) ||
    Date.parse(endedAt) < Date.parse(startedAt)) throw new Error("Fechas de extracción con contrato inválido");

  const dir = resolve(outDir);
  const scope = categoryScope(categories, mode);
  const deduped = results.map((result) => ({ result, ...dedupeBy(result.products, (item) => item) }));
  const byCategory = deduped.flatMap((item) => item.unique);
  const global = dedupeBy(byCategory, (item) => item);
  const withinCategories = deduped.reduce((total, item) => mergeDedupeReports(total, item.report), emptyDedupeReport());
  const hasExclusions = results.some((result) => (result.exclusions?.length ?? 0) > 0);
  const identityConflicts = findIdentityConflicts(results.flatMap((result) => result.products));
  const serialWarnings = findSerialNumberCollisions(global.unique).map(describeSerialNumberCollision);
  const snapshotItems = buildCatalogItems(global.unique);
  const previous = await readPreviousSnapshot(dir, prefix, scope);
  const changes = compareCatalog(previous, snapshotItems);
  const quality = assessCatalogQuality(results, global.unique, previous, identityConflicts, serialWarnings);
  const preparation = prepareImportBatch(global.unique, await loadImportCatalog());
  const csv = serializeProductsCsv(global.unique);
  const prepared = asJson({ quality: quality.status, published: quality.published, totals: preparation.totals, products: preparation.products });
  const summaryBase: Summary = {
    startedAt, endedAt, quality,
    totals: {
      categories: results.length,
      discoveredProductUrls: results.reduce((count, result) => count + result.discoveredProductUrls, 0),
      scrapedProductsRaw: results.reduce((count, result) => count + result.products.length, 0),
      scrapedProductsByCategorySum: byCategory.length,
      scrapedProducts: global.unique.length,
      ...(hasExclusions ? { excludedProductUrls: results.reduce((count, result) => count + (result.exclusions?.length ?? 0), 0) } : {}),
      failures: results.reduce((count, result) => count + result.failures.length, 0),
      dedupe: { withinCategories, globalAll: global.report }
    },
    categories: deduped.map(({ result, unique, report }) => ({
      ...result.category,
      discoveredProductUrls: result.discoveredProductUrls,
      ...(result.expectedProductUrls === undefined ? {} : { expectedProductUrls: result.expectedProductUrls }),
      scrapedProductsRaw: result.products.length,
      scrapedProducts: unique.length,
      ...(result.exclusions?.length ? { excludedProductUrls: result.exclusions.length } : {}),
      failures: result.failures.length,
      dedupe: report
    }))
  };
  const errors = {
    quality: quality.status,
    failures: results.flatMap((result) => result.failures.map((failure) => ({
      categoryKey: result.category.key, ...failure
    }))),
    ...(hasExclusions ? { exclusions: results.flatMap((result) => (result.exclusions ?? []).map((exclusion) => ({
      categoryKey: result.category.key, ...exclusion
    }))) } : {}),
    identityConflicts, serialWarnings
  };
  const comparable = quality.published;
  const changesReport = { status: comparable ? "comparable" : "not-comparable", scope, ...changes };
  await mkdir(dir, { recursive: true });

  if (!quality.published) {
    const summary = { ...summaryBase, artifacts: { csvSha256: sha256(csv), preparationSha256: sha256(prepared) } };
    await writeReport(dir, prefix, "partial-all.csv", csv);
    await writeReport(dir, prefix, "partial-preparation.json", prepared);
    await writeReport(dir, prefix, "summary.json", asJson(summary));
    await writeReport(dir, prefix, "changes.json", asJson(changesReport));
    await writeReport(dir, prefix, "errors.json", asJson(errors));
    throw new Error(`Extracción ${quality.status}: ${quality.reasons.join("; ")}`);
  }

  for (const product of global.unique) validateScrapedProduct(product);
  if (new Set(global.unique.map((product) => product.providerId)).size !== 1) {
    throw new Error("Catálogo con productos de proveedores distintos");
  }
  parseCanonicalCatalog({
    version: 1, providerId: global.unique[0]!.providerId, prefix, scope, startedAt, endedAt,
    quality: { status: "complete", published: true }, productCount: global.unique.length,
    products: global.unique
  });

  const pending = await stagePublishedCatalog(dir, prefix);
  try {
    await writeReport(dir, prefix, "all.csv", csv);
    for (const { result, unique } of deduped) {
      if (!/^[a-zA-Z0-9_-]+$/.test(result.category.key)) throw new Error("Clave de categoría inválida");
      await writeReport(dir, prefix, `${result.category.key}.csv`, serializeProductsCsv(unique));
    }
    await writeReport(dir, prefix, "preparation.json", prepared);
    const catalogSha256 = await writeCanonicalCatalog(dir, prefix, scope, startedAt, endedAt, global.unique);
    const summary: Summary = {
      ...summaryBase,
      artifacts: { csvSha256: sha256(csv), preparationSha256: sha256(prepared), catalogSha256 }
    };
    await writeReport(dir, prefix, `snapshot-${scope}.json`, asJson({
      version: 1, scope, createdAt: endedAt, items: snapshotItems
    }));
    await writeReport(dir, prefix, "summary.json", asJson(summary));
    await writeReport(dir, prefix, "changes.json", asJson(changesReport));
    await writeReport(dir, prefix, "errors.json", asJson(errors));
    await finalizePublishedCatalog(dir, prefix, pending);
  } catch (error) {
    if (pending) await restorePublishedCatalog(dir, prefix, pending);
    else await abandonArchive(pending);
    throw error;
  }
  await cleanCatalogExcess(dir, prefix, false);
};

export const writeOutputs = (
  outDir: string, prefix: string, results: readonly CategoryScrapeResult[],
  startedAt: string, endedAt: string
): Promise<void> => publish(outDir, prefix, results, startedAt, endedAt, results.map((result) => result.category), "flat");

export const writeGroupedOutputs = (
  outDir: string, prefix: string, groups: readonly Group[], startedAt: string, endedAt: string
): Promise<void> => publish(outDir, prefix, groups.flatMap((group) => group.results),
  startedAt, endedAt, groups.map((group) => group.parent), "grouped");

export const writeCategoriesCsv = async (
  outDir: string, prefix: string, categories: readonly CategoryConfig[]
): Promise<void> => {
  if (!/^[a-zA-Z0-9_-]+$/.test(prefix)) throw new Error("Prefijo de extracción inválido");
  const dir = resolve(outDir);
  await mkdir(dir, { recursive: true });
  await writeReport(dir, prefix, "categories.csv", serializeCategoriesCsv(categories));
};
