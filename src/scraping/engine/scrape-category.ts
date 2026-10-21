import pLimit from "p-limit";
import type { CategoryConfig, CategoryScrapeResult, ScrapeOptions } from "../../contracts/scraping.js";

import type { ProductRecord } from "../../contracts/catalog.js";
import { fetchHtml, sleep } from "../../infrastructure/http/fetch-html.js";
import { validateScrapedProduct } from "../../catalog/product-validation.js";
import type { ParsedProduct, ScraperProvider } from "../provider.js";

export type ProductPageCache = Map<string, Promise<ParsedProduct>>;

export type ScrapeProgressCallbacks = {
  readonly verbose: boolean;
  readonly onListingDone: (total: number) => void;
  readonly onListingProgress?: (pages: number, total: number, stage?: string) => void;
  readonly onProductDone: (done: number, total: number) => void;
  readonly onFailure?: (stage: string, url: string, reason: string) => void;
};

const nowIso = (): string => new Date().toISOString();

const log = (scope: string, msg: string, verbose: boolean): void => {
  if (verbose) console.log(`[${nowIso()}] ${scope} ${msg}`);
};

export const scrapeCategory = async (
  category: CategoryConfig,
  options: ScrapeOptions,
  provider: ScraperProvider,
  cache?: ProductPageCache,
  progress?: ScrapeProgressCallbacks
): Promise<CategoryScrapeResult> => {
  for (const [key, value] of [
    ["maxPages", options.maxPages],
    ["stallStopAfter", options.stallStopAfter],
    ["concurrencyPages", options.concurrencyPages],
    ["concurrencyProducts", options.concurrencyProducts]
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} debe ser un entero positivo`);
  }

  const concurrentPages = Math.min(options.concurrencyPages, provider.defaultOptions.concurrencyPages);
  const concurrentProducts = Math.min(options.concurrencyProducts, provider.defaultOptions.concurrencyProducts);
  const pageLimit = pLimit(concurrentPages);
  const productLimit = pLimit(concurrentProducts);

  const verbose = progress?.verbose ?? false;
  const report = (scope: string, message: string): void => log(scope, message, verbose);
  const productUrls = new Set<string>();
  const failures: { url: string; error: string }[] = [];
  const recordFailure = (stage: string, url: string, error: string): void => {
    failures.push({ url, error });
    progress?.onFailure?.(stage, url, error);
  };
  const failureDetail = (error: unknown): string => error instanceof Error ? error.stack ?? error.message : String(error);

  let page = 1;
  let stall = 0;
  let exhausted = false;

  report("category", `start key=${category.key} pagesMax=${options.maxPages}`);

  let expectedProductUrls: number | undefined;

  if (provider.discoverListing) {
    try {
      const listing = await provider.discoverListing(category, options, progress?.onListingProgress);
      expectedProductUrls = listing.expectedTotal;
      for (const url of listing.urls) productUrls.add(url);
      if (!Number.isSafeInteger(expectedProductUrls) || expectedProductUrls < 1) {
        recordFailure("listado", category.url, "El proveedor no ha confirmado un total válido de resultados");
      } else if (productUrls.size !== expectedProductUrls) {
        recordFailure("listado", category.url, `Cobertura incompleta del catálogo: ${productUrls.size} de ${expectedProductUrls} referencias únicas`);
      }
      report("category", `listingDone key=${category.key} total=${productUrls.size} expected=${String(expectedProductUrls)}`);
    } catch (error) {
      recordFailure("paginación", category.url, `No se pudo recorrer la paginación: ${failureDetail(error)}`);
    }
  } else {
    while (page <= options.maxPages) {
      const pages: number[] = [];
      for (let i = 0; i < concurrentPages; i += 1) {
        const p = page + i;
        if (p <= options.maxPages) pages.push(p);
      }

      report("category", `listing key=${category.key} pages=${pages.join(",")}`);

      const results = await Promise.allSettled(
        pages.map((p) =>
          pageLimit(async () => {
            const url = provider.buildPagedUrl(category.url, p);
            const html = provider.loadListingHtml
              ? await provider.loadListingHtml(url, options)
              : await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
            return {
              urls: provider.extractProductLinksFromListing(url, html),
              expectedTotal: provider.extractExpectedTotalFromListing?.(html) ?? null
            };
          })
        )
      );

      let added = 0;

      for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        if (!r) continue;
        if (r.status === "rejected") {
          const listingUrl = provider.buildPagedUrl(category.url, pages[i]!);
          recordFailure("listado", listingUrl, failureDetail(r.reason));
          report("listing", `fail key=${category.key} url=${listingUrl} error=${String(r.reason)}`);
          continue;
        }
        if (r.value.expectedTotal !== null) {
          if (expectedProductUrls !== undefined && expectedProductUrls !== r.value.expectedTotal) {
            recordFailure("listado", provider.buildPagedUrl(category.url, pages[i]!), `Total de resultados inconsistente: ${expectedProductUrls} / ${r.value.expectedTotal}`);
          }
          expectedProductUrls = r.value.expectedTotal;
        }
        for (const u of r.value.urls) {
          if (!productUrls.has(u)) {
            productUrls.add(u);
            added += 1;
          }
        }
      }

      if (results.every((result) => result.status === "rejected")) {
        throw new Error(`No se pudo leer ninguna página del listado de ${category.key}: ${pages.join(",")}`);
      }

      progress?.onListingProgress?.(pages.length, productUrls.size);
      report("category", `listingDone key=${category.key} added=${added} total=${productUrls.size} stall=${stall}`);

      if (added === 0) stall += 1;
      else stall = 0;

      if (stall >= options.stallStopAfter) {
        exhausted = true;
        report("category", `stallStop key=${category.key} stall=${stall} total=${productUrls.size}`);
        break;
      }

      page += pages.length;
      if (page <= options.maxPages) await sleep(Math.max(options.delayMs, provider.defaultOptions.delayMs));
    }

    if (!exhausted && page > options.maxPages) {
      recordFailure("listado", category.url, `Límite de páginas (${options.maxPages}) alcanzado sin confirmar fin de catálogo`);
    }
    if (expectedProductUrls !== undefined && expectedProductUrls !== productUrls.size) {
      recordFailure("listado", category.url, `Cobertura incompleta del catálogo: ${productUrls.size} de ${expectedProductUrls} referencias únicas`);
    }
  }

  const urls = [...productUrls];
  progress?.onListingDone(urls.length);
  report("category", `productsStart key=${category.key} count=${urls.length}`);

  let done = 0;
  let processed = 0;
  const parsePage = async (url: string): Promise<ParsedProduct> => {
    const html = await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
    return provider.parseProductPage(html, url);
  };
  const readPage = (url: string): Promise<ParsedProduct> => {
    if (!cache) return parsePage(url);
    const previous = cache.get(url);
    if (previous) return previous;
    const pending = parsePage(url).catch((error: unknown) => {
      cache.delete(url);
      throw error;
    });
    cache.set(url, pending);
    return pending;
  };

  const productsSettled = await Promise.allSettled(
    urls.map((url, idx) =>
      productLimit(async (): Promise<ProductRecord> => {
        const n = idx + 1;
        report("product", `start key=${category.key} ${n}/${urls.length} url=${url}`);

        try {
          const parsed = await readPage(url);
          const condition = provider.resolveCondition
            ? provider.resolveCondition(category, parsed.condition, provider.id) : parsed.condition;

          const product: ProductRecord = {
            providerId: provider.id,
            categoryKey: category.key,
            categoryName: category.name,
            url,
            title: parsed.title ?? null,
            shortDescription: parsed.shortDescription ?? null,
            longDescription: parsed.longDescription ?? null,
            price: parsed.price ?? null,
            ...(parsed.priceText === undefined ? {} : { priceText: parsed.priceText }),
            ...(condition === undefined ? {} : { condition }),
            ...(parsed.breadcrumbs === undefined ? {} : { breadcrumbs: parsed.breadcrumbs }),
            ...(parsed.subcategory === undefined ? {} : { subcategory: parsed.subcategory }),
            ...(parsed.externalReference === undefined ? {} : { externalReference: parsed.externalReference }),
            ...(parsed.shortDescriptionHtml === undefined ? {} : { shortDescriptionHtml: parsed.shortDescriptionHtml }),
            ...(parsed.longDescriptionHtml === undefined ? {} : { longDescriptionHtml: parsed.longDescriptionHtml }),
            ...(parsed.technicalSheetUrl === undefined ? {} : { technicalSheetUrl: parsed.technicalSheetUrl }),
            ...(parsed.yearSource === undefined ? {} : { yearSource: parsed.yearSource }),
            scrapedAt: nowIso(),
            reference: parsed.reference ?? provider.extractReference(url),
            brand: parsed.brand ?? null,
            model: parsed.model ?? null,
            year: parsed.year ?? null,
            location: parsed.location ?? null,
            country: parsed.country ?? null,
            horometer: parsed.horometer ?? null,
            serialNumber: parsed.serialNumber ?? null,
            image: parsed.images?.[0] ?? parsed.image ?? null,
            images: parsed.images?.length ? parsed.images : (parsed.image ? [parsed.image] : []),
            ...(parsed.specs === undefined ? {} : { specs: parsed.specs })
          };

          validateScrapedProduct(product);
          done += 1;
          report(
            "product",
            `done key=${category.key} ${done}/${urls.length} title=${product.title ? product.title.slice(0, 60) : ""} shortLen=${product.shortDescription ? product.shortDescription.length : 0
            } longLen=${product.longDescription ? product.longDescription.length : 0}`
          );

          return product;
        } catch (error) {
          progress?.onFailure?.("ficha", url, failureDetail(error));
          throw error;
        } finally {
          processed += 1;
          progress?.onProductDone(processed, urls.length);
        }
      })
    )
  );

  const products: ProductRecord[] = [];

  for (let i = 0; i < productsSettled.length; i += 1) {
    const r = productsSettled[i];
    const url = urls[i] ?? "";
    if (r?.status === "fulfilled") {
      products.push(r.value);
      continue;
    }
    const reason = r?.status === "rejected" ? r.reason : "unknown";
    failures.push({ url, error: failureDetail(reason) });
    report("product", `fail key=${category.key} url=${url} error=${failureDetail(reason)}`);
  }

  report("category", `end key=${category.key} ok=${products.length} fail=${failures.length}`);

  return {
    category,
    discoveredProductUrls: urls.length,
    ...(expectedProductUrls === undefined ? {} : { expectedProductUrls }),
    products,
    failures
  };
};