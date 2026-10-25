import pLimit from "p-limit";
import type { CategoryConfig, ScrapeOptions } from "../../contracts/scraping.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { fetchHtml } from "../../infrastructure/http/fetch-html.js";
import { validateScrapedProduct } from "../../catalog/product-validation.js";
import type { ParsedProduct, ScraperProvider } from "../provider.js";
import type { ProductPageCache, ScrapeProgressCallbacks, ScrapeReport } from "./scrape-types.js";

const nowIso = (): string => new Date().toISOString();

export const scrapeProductPages = async (
  category: CategoryConfig,
  options: ScrapeOptions,
  provider: ScraperProvider,
  urls: readonly string[],
  concurrentProducts: number,
  cache: ProductPageCache | undefined,
  failureDetail: (error: unknown) => string,
  report: ScrapeReport,
  progress?: ScrapeProgressCallbacks
): Promise<{ products: ProductRecord[]; failures: { url: string; error: string }[] }> => {
  const productLimit = pLimit(concurrentProducts);
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
  const failures: { url: string; error: string }[] = [];

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
  return { products, failures };
};
