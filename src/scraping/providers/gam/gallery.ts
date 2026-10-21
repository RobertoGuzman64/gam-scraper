import type * as cheerio from "cheerio";
import { collectProductImages } from "../../parsing/image-gallery.js";

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
  const url = value.url ?? value.src;
  return typeof url === "string" ? url : null;
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
    const best = sizes ? (
      sizes.product_main_2x ?? sizes.large_default ?? sizes.product_main ?? sizes.medium_default
    ) : null;
    const url = mediaUrl(best) ?? mediaUrl(image);
    if (url) urls.push(url);
  }
  return urls;
};

const productImagesFrom = (value: unknown): readonly string[] => {
  if (!isObject(value)) return [];
  return imagesFrom(value.images);
};

const parseJson = (value: string): unknown => {
  try { return JSON.parse(value); } catch { return null; }
};

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

const structuredProductImages = (value: unknown): readonly string[] => {
  const nodes = Array.isArray(value) ? value : [value];
  const images: string[] = [];
  for (const candidate of nodes) {
    if (!isObject(candidate)) continue;
    const graph = Array.isArray(candidate["@graph"]) ? candidate["@graph"] : [candidate];
    for (const node of graph) {
      if (!isObject(node)) continue;
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      if (!types.includes("Product")) continue;
      const values = Array.isArray(node.image) ? node.image : [node.image];
      for (const item of values) {
        const url = mediaUrl(item);
        if (url) images.push(url);
      }
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
  const gallery = collectProductImages($, pageUrl, selectors, "gam");
  const additional: string[] = [];
  const push = (urls: readonly string[]): void => { additional.push(...urls); };

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const node = $(element);
      const candidates = [node, ...node.find("img, source, a[href], [data-image-large-src], [data-original]").toArray().map((child) => $(child))];
      for (const candidate of candidates) {
        for (const attribute of ["data-image-large-src", "data-original", "data-src-large", "data-lazy-src"]) {
          const value = candidate.attr(attribute);
          if (value) additional.push(value);
        }
      }
    });
  }

  $("#product-details[data-product], #product [data-product]").each((_, node) => {
    const value = $(node).attr("data-product");
    if (value) push(productImagesFrom(parseJson(value)));
  });
  $("#product [data-images]").each((_, node) => {
    const value = $(node).attr("data-images");
    if (value) push(imagesFrom(parseJson(value)));
  });
  $("script[type='application/ld+json']").each((_, node) => {
    push(structuredProductImages(parseJson($(node).html() ?? "")));
  });
  $("script:not([src])").each((_, node) => {
    const source = $(node).html() ?? "";
    const prestashop = objectFromScript(source, /\b(?:var|let|const)\s+prestashop\s*=\s*/);
    if (isObject(prestashop)) push(productImagesFrom(prestashop.product));
    const product = objectFromScript(source, /\bprestashop\.product\s*=\s*/);
    push(productImagesFrom(product));
  });

  const collected = new Set<string>();
  for (const value of [...gallery, ...additional]) {
    try {
      const url = new URL(value, pageUrl);
      if (!/^https?:$/.test(url.protocol)) continue;
      if (!/\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i.test(url.toString())) continue;
      if (/(?:logo|sprite|placeholder|avatar|icon|favicon|no-image|es-default)/i.test(url.pathname)) continue;
      collected.add(preferGamLargeImage(url.toString()));
    } catch { continue; }
  }
  return [...collected];
};
