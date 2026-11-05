import type * as cheerio from "cheerio";
import { collectProductImages } from "../../parsing/image-gallery.js";
import { excludeGamRelatedProductImages } from "../../../catalog/normalization/providers/gam/gallery.js";
import { unrelatedDetails } from "./selectors.js";

type ValueMap = Record<string, unknown>;

const isObject = (value: unknown): value is ValueMap =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const preferGamLargeImage = (value: string): string => {
  const url = new URL(value);
  if (url.hostname !== "online.gamrentals.com") return value;
  url.pathname = url.pathname.replace(
    /^(\/\d+)-(?:large_default|medium_default|small_default|home_default|cart_default|thickbox_default|product_main)(\/)/i,
    "$1-product_main_2x$2"
  );
  return url.toString();
};

const mediaUrl = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (!isObject(value)) return null;
  for (const candidate of [value.contentUrl, value.url, value.src]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  }
  return null;
};

const imagesFrom = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const image of value) {
    if (typeof image === "string") {
      urls.push(image);
      continue;
    }
    if (!isObject(image)) continue;
    const sizes = isObject(image.bySize) ? image.bySize : null;
    let url: string | null = null;
    if (sizes) {
      for (const candidate of [
        sizes.product_main_2x, sizes.large_default, sizes.product_main, sizes.medium_default,
        sizes.thickbox_default, sizes.home_default, sizes.small_default, sizes.cart_default
      ]) {
        url = mediaUrl(candidate);
        if (url?.trim()) break;
      }
    }
    url = url?.trim() ? url : mediaUrl(image);
    if (url) urls.push(url);
  }
  return urls;
};

const productImagesFrom = (value: unknown, pageUrl: string): readonly string[] => {
  if (!isObject(value) || identifiesOtherGamProduct(value, pageUrl)) return [];
  return imagesFrom(value.images);
};

const parseJson = (value: string): unknown => {
  try { return JSON.parse(value); } catch { return null; }
};

const isProductType = (value: unknown): boolean =>
  value === "Product" || (typeof value === "string" && /^https?:\/\/schema\.org\/Product\/?$/u.test(value));

const objectFromScript = (source: string, expression: RegExp): unknown => {
  const marker = expression.exec(source);
  if (!marker) return null;
  const start = marker.index + marker[0].length;
  if (source[start] !== "{") return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return parseJson(source.slice(start, index + 1));
  }
  return null;
};

const gamProductId = (identifier: string, pageUrl: string): string | null => {
  try {
    const url = new URL(identifier, pageUrl);
    if (url.origin !== new URL(pageUrl).origin) return null;
    return url.pathname.split("/").filter(Boolean).at(-1)?.match(/^(\d+)-/u)?.[1] ?? null;
  } catch {
    return null;
  }
};

const identifiesOtherGamProduct = (value: ValueMap, pageUrl: string): boolean => {
  const pageId = gamProductId(pageUrl, pageUrl);
  if (pageId === null) return false;
  const identifiers = [value.url, value["@id"]].filter((identifier): identifier is string =>
    typeof identifier === "string"
  );
  const productIds = identifiers
    .map((identifier) => gamProductId(identifier, pageUrl))
    .filter((identifier): identifier is string => identifier !== null);
  return productIds.length > 0 && productIds.every((identifier) => identifier !== pageId);
};

const productMatchesPage = (value: ValueMap, pageUrl: string): boolean =>
  [value.url, value["@id"]].some((identifier) => {
    if (typeof identifier !== "string") return false;
    try {
      const productUrl = new URL(identifier, pageUrl);
      const page = new URL(pageUrl);
      return productUrl.origin === page.origin &&
        productUrl.pathname.replace(/\/+$/u, "") === page.pathname.replace(/\/+$/u, "");
    } catch {
      return false;
    }
  });

const structuredProductImages = (values: readonly unknown[], pageUrl: string): readonly string[] => {
  const products: ValueMap[] = [];
  for (const value of values) {
    const nodes = Array.isArray(value) ? value : [value];
    for (const candidate of nodes) {
      if (!isObject(candidate)) continue;
      const graphValue = candidate["@graph"];
      const graph = Array.isArray(graphValue) ? graphValue : isObject(graphValue) ? [graphValue] : [candidate];
      for (const node of graph) {
        if (!isObject(node)) continue;
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        if (types.some(isProductType)) products.push(node);
      }
    }
  }
  const matched = products.filter((product) => productMatchesPage(product, pageUrl));
  const images: string[] = [];
  const eligible = matched.length > 0 ? matched : products.filter((product) => !identifiesOtherGamProduct(product, pageUrl));
  for (const product of eligible) {
    const values = Array.isArray(product.image) ? product.image : [product.image];
    for (const item of values) {
      const url = mediaUrl(item);
      if (url) images.push(url);
    }
  }
  return images;
};

export const extractGamGallery = ($: cheerio.CheerioAPI, pageUrl: string): readonly string[] => {
  const selectors = [
    ".product-cover", ".images-container", ".product-images", ".product-gallery",
    ".product-thumbnails", ".js-qv-product-cover", ".js-qv-product-images",
    "#product-images", ".product-detail-images", ".thumb-container", ".js-thumb",
    "#product .swiper-slide", "#product [data-fancybox]"
  ];
  const gallery = collectProductImages($, pageUrl, selectors, "gam", unrelatedDetails);
  const additional: string[] = [];
  const push = (urls: readonly string[]): void => { additional.push(...urls); };

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const node = $(element);
      if (node.closest(unrelatedDetails).length > 0) return;
      const candidates = [node, ...node.find("img, source, a[href], [data-image-large-src], [data-original], [data-src-large], [data-lazy-src]").toArray().map((child) => $(child))];
      for (const candidate of candidates) {
        if (candidate.closest(unrelatedDetails).length > 0) continue;
        for (const attribute of ["data-image-large-src", "data-original", "data-src-large", "data-lazy-src"]) {
          const value = candidate.attr(attribute);
          if (value) additional.push(value);
        }
      }
    });
  }

  $("#product-details[data-product], #product [data-product]").each((_, node) => {
    const element = $(node);
    if (element.closest(unrelatedDetails).length > 0) return;
    const value = element.attr("data-product");
    if (value) push(productImagesFrom(parseJson(value), pageUrl));
  });
  $("#product [data-images]").each((_, node) => {
    const element = $(node);
    if (element.closest(unrelatedDetails).length > 0) return;
    const value = element.attr("data-images");
    if (value) push(imagesFrom(parseJson(value)));
  });
  const structuredDocuments: unknown[] = [];
  $("script[type='application/ld+json']").each((_, node) => {
    const element = $(node);
    if (element.closest(unrelatedDetails).length > 0) return;
    structuredDocuments.push(parseJson(element.html() ?? ""));
  });
  push(structuredProductImages(structuredDocuments, pageUrl));
  $("script:not([src])").each((_, node) => {
    const element = $(node);
    if (element.closest(unrelatedDetails).length > 0) return;
    const source = element.html() ?? "";
    const prestashop = objectFromScript(source, /\b(?:var|let|const)\s+prestashop\s*=\s*/);
    if (isObject(prestashop)) push(productImagesFrom(prestashop.product, pageUrl));
    const product = objectFromScript(source, /\bprestashop\.product\s*=\s*/);
    push(productImagesFrom(product, pageUrl));
  });

  const collected = new Map<string, string>();
  for (const value of [...gallery, ...additional]) {
    try {
      const url = new URL(value, pageUrl);
      if (!/^https?:$/.test(url.protocol)) continue;
      if (!/\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i.test(url.toString())) continue;
      if (/(?:logo|sprite|placeholder|avatar|icon|favicon|no-image|es-default)/i.test(url.pathname)) continue;
      const preferred = preferGamLargeImage(url.toString());
      const media = new URL(preferred);
      const key = media.hostname === "online.gamrentals.com" &&
        /^\/\d+-product_main_2x\//u.test(media.pathname)
        ? `${media.origin}${media.pathname}`
        : preferred;
      if (!collected.has(key)) collected.set(key, preferred);
    } catch { continue; }
  }
  return excludeGamRelatedProductImages([...collected.values()]);
};
