import pLimit from "p-limit";
import type { CategoryConfig, ScrapeOptions } from "../../contracts/scraping.js";
import { fetchHtml, sleep } from "../../infrastructure/http/fetch-html.js";
import type { ScraperProvider } from "../provider.js";
import type { ScrapeProgressCallbacks, ScrapeReport, ScrapeFailureRecorder } from "./scrape-types.js";

export const discoverProductUrls = async (
  category: CategoryConfig,
  options: ScrapeOptions,
  provider: ScraperProvider,
  concurrentPages: number,
  recordFailure: ScrapeFailureRecorder,
  failureDetail: (error: unknown) => string,
  report: ScrapeReport,
  progress?: ScrapeProgressCallbacks
): Promise<{ urls: string[]; expectedProductUrls: number | undefined }> => {
  const productUrls = new Set<string>();
  const pageLimit = pLimit(concurrentPages);
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
  return { urls: [...productUrls], expectedProductUrls };
};
