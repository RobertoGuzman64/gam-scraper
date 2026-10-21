import * as cheerio from "cheerio";
import { loadReadableHtml } from "../../parsing/readable-html.js";
import type { ParsedProduct } from "../../provider.js";
import { collectProductImages } from "../../parsing/image-gallery.js";
import { extractEmbeddedMachineMetadata, extractEmbeddedMachinePrice } from "./embedded-machine.js";

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
    return url.hostname === "sales.mercaeleva.com" && /^\/(?:es|en|ca)\/for-sale\/machine\/[^/]+\/?$/i.test(url.pathname);
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
      url.pathname = url.pathname.replace(/\/$/, "");
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

const cleanDescription = (value: string): string | null => {
  const text = normalize(value);
  const marker = /\\?"(?:parameterType|parameterUnit|parameterValue|subgroupName|clientLegalName|machineSiteSettings|machinericId|pictures)\\?"\s*:/i.exec(text);
  const cleaned = normalize((marker ? text.slice(0, marker.index) : text).replace(/[,{}\[\]":\s]+$/g, ""));
  return cleaned || null;
};

const extractDescription = ($: cheerio.CheerioAPI): string | null => {
  let description: string | null = null;
  $("h2, h3, h4").each((_, el) => {
    if (description || !/^(?:machine description|descripción de la máquina)$/i.test(normalize($(el).text()))) return;
    const next = $(el).next();
    const value = normalize(next.text());
    if (value && value.length < 5000) description = cleanDescription(value);
  });
  return description;
};

const collectSpecs = ($: cheerio.CheerioAPI): Record<string, string> => {
  const specs: Record<string, string> = {};
  const usedValues = new Set<object>();
  let insideSpecs = false;

  $("body").find("*").each((_, el) => {
    const element = $(el);
    if (element.is("h2")) {
      const heading = normalize(element.text());
      if (/^(?:general information|información general|power and performance|potencia y rendimiento|chassis|chasis)$/i.test(heading)) insideSpecs = true;
      else if (/^(?:sales information|información de venta|machine description|descripción de la máquina)$/i.test(heading)) insideSpecs = false;
    }
    if (!insideSpecs || !element.is("dt, th, label, span, div, p") || element.children().length > 0 || usedValues.has(el)) return;

    const key = normalize(element.text()).replace(/:\s*$/, "");
    if (key.length < 2 || key.length > 72 || !/[\p{L}]/u.test(key)
      || /[{}\[\]"]/.test(key) || /(?:EUR|€)/i.test(key)) return;

    const sibling = element.next();
    const value = normalize(sibling.text());
    if (!sibling.length || sibling.is("h1, h2, h3, h4, h5, h6, script, style")
      || sibling.find("dt, dd, th, td, span, div, p").length > 1
      || !value || value === key || value.length > 240 || /[{}\[\]"]/.test(value)) return;

    const valueNode = sibling.get(0);
    if (!valueNode || usedValues.has(valueNode)) return;
    if (!Object.hasOwn(specs, key)) specs[key] = value;
    usedValues.add(valueNode);
  });

  const primaryLabels = ["Marca", "Modelo", "Título adicional", "Año de fabricación", "Artículo No.", "Horas laborales", "Estado", "Condición general", "Tipo de motor", "Altura de trabajo", "Altura de elevación", "Tipo de mástil", "Capacidad de carga"];
  for (const label of primaryLabels) {
    if (specs[label]) continue;
    const value = labelValue($, label);
    if (value) specs[label] = value;
  }
  return specs;
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
  $("script, style, noscript, template").remove();
  const title = normalize($("h1").first().text());
  const reference = extractMercaelevaReference(pageUrl);
  if (!title || !reference) throw new Error(`Ficha Mercaeleva sin título o ID de maquinaria: ${pageUrl}`);

  const content = normalize($("body").text());
  const fallbackDescription = normalize(content.match(/(?:Machine description|Descripción de la máquina)\s*(.*?)(?=\s+(?:Información general|General|Potencia y rendimiento)|$)/i)?.[1] ?? "");
  const description = extractDescription($) ?? cleanDescription(fallbackDescription);
  const visiblePrice = content.match(/\b\d{1,3}(?:[\s\u00a0.]\d{3})+(?:[,.]\d{2})?\s*(?:EUR\b|€)/i)?.[0]
    ?? content.match(/\b\d+(?:[,.]\d{2})?\s*(?:EUR\b|€)/i)?.[0]
    ?? null;
  const specs = collectSpecs($);
  const embedded = extractEmbeddedMachineMetadata(html, reference);
  const price = visiblePrice ?? extractEmbeddedMachinePrice(html, reference);
  const visibleImages = collectProductImages($, pageUrl, [
    ".machine-gallery", ".machine-images", ".product-gallery", ".gallery",
    "[class*='gallery']", "[class*='Gallery']", "[class*='carousel']", "[class*='Carousel']",
    "img[alt*='Imagen']", "img[src*='machineric.com/']",
    "img[data-src*='machineric.com/']"
  ], "mercaeleva");
  const images = embedded.images.length ? embedded.images : visibleImages;
  const image = images[0] ?? null;

  const year = specs["Año de fabricación"]?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
  const hours = specs["Horas laborales"]?.match(/\d[\d\s.,]*/)?.[0]?.trim() ?? null;
  const location = embedded.location ?? labelValue($, "Ubicación");

  return {
    title,
    reference,
    brand: specs["Marca"] ?? null,
    model: specs["Modelo"] ?? null,
    year,
    price,
    shortDescription: null,
    longDescription: description,
    location,
    country: embedded.country ?? (location?.endsWith(", ES") ? "ES" : null),
    horometer: hours,
    serialNumber: null,
    image,
    images,
    specs
  };
};
