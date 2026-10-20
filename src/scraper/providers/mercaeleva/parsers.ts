import * as cheerio from "cheerio";
import { loadReadableHtml } from "../readableHtml.js";
import type { ParsedProduct } from "../contracts.js";
import { collectProductImages } from "../imageGallery.js";

const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();

export const buildMercaelevaPageUrl = (categoryUrl: string, page: number): string => {
  const url = new URL(categoryUrl);
  if (page <= 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  return url.toString();
};

export const isMercaelevaProductUrl = (href: string): boolean => {
  try {
    const url = new URL(href);
    return url.hostname === "sales.mercaeleva.com" && /^\/(?:es|en)\/for-sale\/machine\/[^/]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
};

export const extractMercaelevaLinks = (listingUrl: string, html: string): readonly string[] => {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, listingUrl);
      if (!isMercaelevaProductUrl(url.toString())) return;
      url.search = "";
      url.hash = "";
      links.add(url.toString());
    } catch {
      return;
    }
  });
  return [...links];
};

const labelValue = ($: cheerio.CheerioAPI, label: string): string | null => {
  let result: string | null = null;
  $("dt, th, label, span, div, p").each((_, el) => {
    if (result) return;
    const element = $(el);
    if (element.find("*").length > 0 || normalize(element.text()).toLocaleLowerCase("es") !== label.toLocaleLowerCase("es")) return;
    const sibling = element.next();
    const siblingValue = normalize(sibling.text());
    if (siblingValue && siblingValue.length < 240) { result = siblingValue; return; }
    const parentValue = normalize(element.parent().text());
    const rest = normalize(parentValue.slice(label.length));
    if (rest && rest.length < 240) result = rest;
  });
  return result;
};

const extractDescription = ($: cheerio.CheerioAPI): string | null => {
  let description: string | null = null;
  $("h2, h3, h4").each((_, el) => {
    if (description || !/^(?:machine description|descripción de la máquina)$/i.test(normalize($(el).text()))) return;
    const next = $(el).next();
    const value = normalize(next.text());
    if (value && value.length < 5000) description = value;
  });
  return description;
};

export const extractMercaelevaReference = (pageUrl: string): string | null => {
  try {
    const slug = new URL(pageUrl).pathname.split("/").filter(Boolean).at(-1) ?? "";
    return slug.match(/(M\d+-\d+)$/i)?.[1] ?? null;
  } catch {
    return null;
  }
};

export const parseMercaelevaProduct = (html: string, pageUrl: string): ParsedProduct => {
  const $ = loadReadableHtml(html);
  const title = normalize($("h1").first().text());
  const reference = extractMercaelevaReference(pageUrl);
  if (!title || !reference) throw new Error(`Ficha Mercaeleva sin título o ID de maquinaria: ${pageUrl}`);

  const content = normalize($("body").text());
  const fallbackDescription = normalize(content.match(/(?:Machine description|Descripción de la máquina)\s*(.*?)(?=\s+(?:Información general|General|Potencia y rendimiento)|$)/i)?.[1] ?? "");
  const description = extractDescription($) ?? (fallbackDescription || null);
  const price = content.match(/\b\d{1,3}(?:[\s\u00a0.]\d{3})+(?:[,.]\d{2})?\s*(?:EUR\b|€)/i)?.[0]
    ?? content.match(/\b\d+(?:[,.]\d{2})?\s*(?:EUR\b|€)/i)?.[0]
    ?? null;
  const specs: Record<string, string> = {};
  const specLabels = ["Marca", "Modelo", "Título adicional", "Año de fabricación", "Artículo No.", "Horas laborales", "Estado", "Condición general", "Tipo de motor", "Altura de trabajo"];
  for (const label of specLabels) {
    const value = labelValue($, label);
    if (value) specs[label] = value;
  }
  const images = collectProductImages($, pageUrl, [
    ".machine-gallery", ".machine-images", ".product-gallery", ".gallery",
    "[class*='gallery']", "[class*='Gallery']", "[class*='carousel']", "[class*='Carousel']",
    "img[alt*='Imagen']", "img[src*='machineric.com/']",
    "img[data-src*='machineric.com/']"
  ], "mercaeleva");
  const image = images[0] ?? null;

  const year = specs["Año de fabricación"]?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
  const hours = specs["Horas laborales"]?.match(/\d[\d\s.,]*/)?.[0]?.trim() ?? null;
  const location = labelValue($, "Ubicación");

  return {
    title,
    reference,
    brand: specs["Marca"] ?? null,
    model: specs["Modelo"] ?? null,
    year,
    price,
    shortDescription: description ? description.slice(0, 260) : null,
    longDescription: description,
    location,
    country: location?.endsWith(", ES") ? "ES" : null,
    horometer: hours,
    serialNumber: null,
    image,
    images,
    specs
  };
};
