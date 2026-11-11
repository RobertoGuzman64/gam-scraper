import * as cheerio from "cheerio";
import { loadReadableHtml } from "../../parsing/readable-html.js";
import type { ParsedProduct } from "../../provider.js";
import { collectProductImages } from "../../parsing/image-gallery.js";
import { excludeGomarizForeignCover, gomarizReferenceFromGallery } from "../../../catalog/normalization/gomariz/gallery.js";
import { brandFromTitle, modelFromTitle } from "./identity.js";
import { collectGomarizSpecs } from "./specifications.js";

const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();

export const buildGomarizPageUrl = (categoryUrl: string, page: number): string => {
  const url = new URL(categoryUrl);
  const path = url.pathname.replace(/\/page\/\d+\/?$/, "/").replace(/\/+$/, "/");
  url.pathname = page <= 1 ? path : `${path}page/${page}/`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const isGomarizProductUrl = (href: string): boolean => {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || !["www.gomarizrent.com", "gomarizrent.com"].includes(url.hostname)) return false;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2 || segments.some((segment) => /^__trashed(?:-\d+)?$/u.test(segment))) return false;
    if (segments[0] === "venta") return segments.length >= 4 && segments[1] !== "page";
    if (segments[0] !== "producto" && segments.length < 3) return false;
    return !["alquiler", "blog", "page", "category", "categoria", "cart", "carrito", "checkout", "my-account", "contacto", "repuestos"].includes(segments[0] ?? "");
  } catch {
    return false;
  }
};

export const extractGomarizLastPage = (html: string): number | null => {
  const $ = cheerio.load(html);
  const title = $("title").first().text();
  const match = /\bp[aá]gina\s+\d+\s+de\s+(\d+)\b/iu.exec(title);
  const total = match?.[1] ? Number(match[1]) : null;
  if (total !== null && Number.isSafeInteger(total) && total >= 1) return total;
  const lastHref = $("a.last.page-numbers[href], .pagination a.last[href], a[rel='last'][href]").first().attr("href");
  if (!lastHref) return null;
  try {
    const last = /\/venta\/page\/(\d+)\/?$/u.exec(new URL(lastHref, "https://www.gomarizrent.com").pathname)?.[1];
    const count = last ? Number(last) : null;
    return count !== null && Number.isSafeInteger(count) && count >= 1 ? count : null;
  } catch {
    return null;
  }
};

export const extractGomarizLinks = (listingUrl: string, html: string): readonly string[] => {
  const listing = new URL(listingUrl);
  if (listing.protocol !== "https:" || !["www.gomarizrent.com", "gomarizrent.com"].includes(listing.hostname) ||
    !/^\/venta\/(?:page\/\d+\/)?$/u.test(listing.pathname)) return [];
  const $ = cheerio.load(html);
  const results = new Set<string>();
  const main = $("main, #main, #content, .site-main").first();
  const anchors = main.length ? main.find("a[href]") : $("a[href]");
  anchors.each((_, element) => {
    const anchor = $(element);
    if (anchor.closest("header, nav, footer, aside, .breadcrumb, .related, .related-products, .upsells").length) return;
    const href = anchor.attr("href");
    if (!href) return;
    try {
      const url = new URL(href, listingUrl);
      const segments = url.pathname.split("/").filter(Boolean);
      const titleSelector = "h2, h3, h4, .product-title, .entry-title, .woocommerce-loop-product__title";
      const titleLink = Boolean(anchor.closest(titleSelector).length || anchor.find(titleSelector).length);
      const saleListingRentalPath = segments[0] === "alquiler" && titleLink &&
        segments.length >= 4 && url.protocol === "https:" &&
        ["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname);
      if (!isGomarizProductUrl(url.toString()) && !saleListingRentalPath) return;
      url.search = "";
      url.hash = "";
      results.add(url.toString());
    } catch {
      return;
    }
  });
  return [...results];
};


const metadataValue = (text: string, name: string): string | null => {
  const otherLabels = "Referencia|Año|Marca|Modelo|Horas|Horómetro|Horometro|Nº de serie|Número de serie|Número de bastidor|Ubicación|Localización|País|Potencia|Combustible";
  const pattern = new RegExp(`(?:^|\\s)${name}:\\s*(.*?)(?=\\s+(?:${otherLabels}):|\\s+(?:Ver precio|Contactar|Descripción|Dimensiones|Especificaciones técnicas|Ver ficha técnica)\\b|$)`, "i");
  const value = normalize(text.match(pattern)?.[1] ?? "");
  return value && value.length < 120 && !/^(?:consultar|ver precio|contactar)$/i.test(value) ? value : null;
};

export const parseGomarizProduct = (html: string, pageUrl: string): ParsedProduct => {
  const $ = loadReadableHtml(html);
  const title = normalize($("h1").first().text());
  const main = $("main").first();
  const scope = main.length > 0 ? main : $("body");
  const content = normalize(scope.text()).split(/Máquinas similares/i)[0] ?? "";
  const foundReference = content.match(/Referencia:\s*([\w-]+)/i)?.[1] ?? null;
  const gallery = collectProductImages($, pageUrl, [
    ".woocommerce-product-gallery", ".product-gallery", ".swiper-slide",
    ".gallery", ".product-images"
  ], "gomariz");
  const reference = foundReference ?? (title ? gomarizReferenceFromGallery(gallery, title) : null);
  if (!title || !reference) throw new Error(`Ficha Gomariz sin título o referencia: ${pageUrl}`);

  const year = content.match(/\bAño:\s*((?:19|20)\d{2})\b/i)?.[1] ?? null;
  const brand = metadataValue(content, "Marca") ?? brandFromTitle(title, pageUrl);
  const description = normalize(content.match(/Descripción\s*(.*?)(?=\s+Dimensiones|\s+Especificaciones técnicas|\s+Ver ficha técnica|$)/i)?.[1] ?? "");
  const metadataStart = content.indexOf(`Referencia: ${reference}`);
  const overview = (metadataStart < 0 ? content : content.slice(metadataStart)).split(/Descripción|Dimensiones|Especificaciones técnicas/i)[0] ?? "";
  const priceMatch = overview.match(/\b(\d{1,3}(?:[. ]\d{3})*(?:,\d{2})?)\s*€/);
  const price = priceMatch?.[0] ?? null;
  const images = excludeGomarizForeignCover(gallery, reference);
  const image = images[0] ?? null;

  return {
    title,
    reference,
    brand,
    model: metadataValue(overview, "Modelo") ?? modelFromTitle(title, brand),
    year,
    yearSource: year === null ? null : "ficha",
    price,
    shortDescription: null,
    longDescription: description || null,
    location: metadataValue(overview, "Ubicación") ?? metadataValue(overview, "Localización"),
    country: metadataValue(overview, "País"),
    horometer: metadataValue(overview, "Horómetro") ?? metadataValue(overview, "Horometro") ?? metadataValue(overview, "Horas"),
    serialNumber: metadataValue(overview, "Nº de serie") ?? metadataValue(overview, "Número de serie") ?? metadataValue(overview, "Número de bastidor"),
    image,
    images,
    specs: collectGomarizSpecs(content)
  };
};
