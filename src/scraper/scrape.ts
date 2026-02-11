import pLimit from "p-limit";
import type { CategoryConfig, CategoryScrapeResult, ProductRecord, ScrapeOptions } from "./types.js";
import { fetchHtml, sleep } from "./http.js";
import { buildPagedUrl, extractProductLinksFromListing, parseProductPage } from "./parsers.js";

const nowIso = (): string => new Date().toISOString();

const log = (scope: string, msg: string): void => {
  console.log(`[${nowIso()}] ${scope} ${msg}`);
};

const extractProductIdFromUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).at(-1);
    if (!last) return null;
    const m = last.match(/^(\d+)-/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
};

export const scrapeCategory = async (category: CategoryConfig, options: ScrapeOptions): Promise<CategoryScrapeResult> => {
  const pageLimit = pLimit(options.concurrencyPages);
  const productLimit = pLimit(options.concurrencyProducts);

  const productUrls = new Set<string>();

  let page = 1;
  let stall = 0;

  log("category", `start key=${category.key} pagesMax=${options.maxPages}`);

  while (page <= options.maxPages) {
    const pages: number[] = [];
    for (let i = 0; i < options.concurrencyPages; i += 1) {
      const p = page + i;
      if (p <= options.maxPages) pages.push(p);
    }

    log("category", `listing key=${category.key} pages=${pages.join(",")}`);

    const results = await Promise.allSettled(
      pages.map((p) =>
        pageLimit(async () => {
          const url = buildPagedUrl(category.url, p);
          const html = await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
          return extractProductLinksFromListing(url, html);
        })
      )
    );

    let added = 0;

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const u of r.value) {
        if (!productUrls.has(u)) {
          productUrls.add(u);
          added += 1;
        }
      }
    }

    log("category", `listingDone key=${category.key} added=${added} total=${productUrls.size} stall=${stall}`);

    if (added === 0) stall += 1;
    else stall = 0;

    if (stall >= options.stallStopAfter) {
      log("category", `stallStop key=${category.key} stall=${stall} total=${productUrls.size}`);
      break;
    }

    page += pages.length;
    await sleep(options.delayMs);
  }

  const urls = [...productUrls];
  const failures: { url: string; error: string }[] = [];

  log("category", `productsStart key=${category.key} count=${urls.length}`);

  let done = 0;

  const productsSettled = await Promise.allSettled(
    urls.map((url, idx) =>
      productLimit(async (): Promise<ProductRecord> => {
        const n = idx + 1;
        log("product", `start key=${category.key} ${n}/${urls.length} url=${url}`);

        const html = await fetchHtml(url, { timeoutMs: options.timeoutMs, userAgent: options.userAgent });
        const parsed = parseProductPage(html, url);

        const product: ProductRecord = {
          categoryKey: category.key,
          categoryName: category.name,
          url,
          title: parsed.title ?? null,
          shortDescription: parsed.shortDescription ?? null,
          longDescription: parsed.longDescription ?? null,
          price: parsed.price ?? null,
          reference: extractProductIdFromUrl(url),
          brand: parsed.brand ?? null,
          model: parsed.model ?? null,
          year: parsed.year ?? null,
          location: parsed.location ?? null,
          country: parsed.country ?? null,
          horometer: parsed.horometer ?? null,
          serialNumber: parsed.serialNumber ?? null,
          image: parsed.image ?? null,
          specs: parsed.specs
        };

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
    products,
    failures
  };
};