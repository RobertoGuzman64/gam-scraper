import pLimit from "p-limit";
import type { CategoryConfig, CategoryScrapeResult, ProductRecord, ScrapeOptions } from "./types.js";
import { fetchHtml, sleep } from "./http.js";
import { getProvider } from "./providers/index.js";
import { validateScrapedProduct } from "./quality.js";
import type { ScraperProvider } from "./providers/contracts.js";

const nowIso = (): string => new Date().toISOString();

const log = (scope: string, msg: string): void => {
  console.log(`[${nowIso()}] ${scope} ${msg}`);
};

export const scrapeCategory = async (
  category: CategoryConfig,
  options: ScrapeOptions,
  provider: ScraperProvider = getProvider("gam")
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

  const productUrls = new Set<string>();
  const failures: { url: string; error: string }[] = [];

  let page = 1;
  let stall = 0;
  let exhausted = false;

  log("category", `start key=${category.key} pagesMax=${options.maxPages}`);

  let expectedProductUrls: number | undefined;

  if (provider.discoverListing) {
    try {
      const listing = await provider.discoverListing(category, options);
      expectedProductUrls = listing.expectedTotal;
      for (const url of listing.urls) productUrls.add(url);
      if (!Number.isSafeInteger(expectedProductUrls) || expectedProductUrls < 1) {
        failures.push({ url: category.url, error: "El proveedor no ha confirmado un total válido de resultados" });
      } else if (productUrls.size !== expectedProductUrls) {
        failures.push({
          url: category.url,
          error: `Cobertura incompleta del catálogo: ${productUrls.size} de ${expectedProductUrls} referencias únicas`
        });
      }
      log("category", `listingDone key=${category.key} total=${productUrls.size} expected=${String(expectedProductUrls)}`);
    } catch (error) {
      failures.push({ url: category.url, error: `No se pudo recorrer la paginación: ${String(error)}` });
    }
  } else {
    while (page <= options.maxPages) {
      const pages: number[] = [];
      for (let i = 0; i < concurrentPages; i += 1) {
        const p = page + i;
        if (p <= options.maxPages) pages.push(p);
      }

      log("category", `listing key=${category.key} pages=${pages.join(",")}`);

      const results = await Promise.allSettled(
        pages.map((p) =>
          pageLimit(async () => {
            const url = provider.buildPagedUrl(category.url, p);
            const html = provider.loadListingHtml
              ? await provider.loadListingHtml(url, options)
              : await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
            return provider.extractProductLinksFromListing(url, html);
          })
        )
      );

      let added = 0;

      for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        if (!r) continue;
        if (r.status === "rejected") {
          const listingUrl = provider.buildPagedUrl(category.url, pages[i]!);
          failures.push({ url: listingUrl, error: String(r.reason) });
          log("listing", `fail key=${category.key} url=${listingUrl} error=${String(r.reason)}`);
          continue;
        }
        for (const u of r.value) {
          if (!productUrls.has(u)) {
            productUrls.add(u);
            added += 1;
          }
        }
      }

      if (results.every((result) => result.status === "rejected")) {
        throw new Error(`No se pudo leer ninguna página del listado de ${category.key}: ${pages.join(",")}`);
      }

      log("category", `listingDone key=${category.key} added=${added} total=${productUrls.size} stall=${stall}`);

      if (added === 0) stall += 1;
      else stall = 0;

      if (stall >= options.stallStopAfter) {
        exhausted = true;
        log("category", `stallStop key=${category.key} stall=${stall} total=${productUrls.size}`);
        break;
      }

      page += pages.length;
      if (page <= options.maxPages) await sleep(Math.max(options.delayMs, provider.defaultOptions.delayMs));
    }

    if (!exhausted && page > options.maxPages) {
      failures.push({ url: category.url, error: `Límite de páginas (${options.maxPages}) alcanzado sin confirmar fin de catálogo` });
    }

  }

  const urls = [...productUrls];
  log("category", `productsStart key=${category.key} count=${urls.length}`);

  let done = 0;

  const productsSettled = await Promise.allSettled(
    urls.map((url, idx) =>
      productLimit(async (): Promise<ProductRecord> => {
        const n = idx + 1;
        log("product", `start key=${category.key} ${n}/${urls.length} url=${url}`);

        const html = await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
        const parsed = provider.parseProductPage(html, url);

        const product: ProductRecord = {
          providerId: provider.id,
          categoryKey: category.key,
          categoryName: category.name,
          url,
          title: parsed.title ?? null,
          shortDescription: parsed.shortDescription ?? null,
          longDescription: parsed.longDescription ?? null,
          price: parsed.price ?? null,
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
        log(
          "product",
          `done key=${category.key} ${done}/${urls.length} title=${product.title ? product.title.slice(0, 60) : ""} shortLen=${product.shortDescription ? product.shortDescription.length : 0
          } longLen=${product.longDescription ? product.longDescription.length : 0}`
        );

        return product;
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
    failures.push({ url, error: String(reason) });
    log("product", `fail key=${category.key} url=${url} error=${String(reason)}`);
  }

  log("category", `end key=${category.key} ok=${products.length} fail=${failures.length}`);

  return {
    category,
    discoveredProductUrls: urls.length,
    ...(expectedProductUrls === undefined ? {} : { expectedProductUrls }),
    products,
    failures
  };
};