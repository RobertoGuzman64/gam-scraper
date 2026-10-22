import * as cheerio from "cheerio";
import { loadReadableHtml } from "../../parsing/readable-html.js";
import type { ParsedProduct } from "../../provider.js";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { collectProductImages } from "../../parsing/image-gallery.js";
import { brandFromTitle, modelFromTitle } from "./identity.js";
import { invalidGomarizPlatformHeight } from "../../../catalog/normalization/gomariz-technical.js";

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
    if (url.hostname !== "www.gomarizrent.com" && url.hostname !== "gomarizrent.com") return false;
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[0] === "venta" && segments.length >= 3 && segments[1] !== "page";
  } catch {
    return false;
  }
};

export const extractGomarizLinks = (listingUrl: string, html: string): readonly string[] => {
  const $ = cheerio.load(html);
  const results = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, listingUrl);
      if (!isGomarizProductUrl(url.toString())) return;
      url.search = "";
      url.hash = "";
      results.add(url.toString());
    } catch {
      return;
    }
  });
  return [...results];
};

const collectSpecs = (source: string, pageUrl: string): SpecsMap => {
  const specs: Record<string, string> = {};
  const conflicting = new Set<string>();
  const keys = [
    "Altura plataforma", "Altura de trabajo", "Alcance lateral", "Altura almacenaje",
    "Altura", "Longitud", "Anchura", "Peso", "Motor", "Capacidad",
    "Potencia motor", "Potencia", "Combustible", "Tipo de combustible", "Tipo de motor", "Consumo",
    "Voltaje", "Tensión", "Anchura limpieza", "Ancho de limpieza",
    "Capacidad de trabajo máxima", "Velocidad máxima", "Altura del mástil", "Nº y tipo de focos"
  ];
  const section = source.match(/(?:Dimensiones|Especificaciones técnicas)\s+(?=(?:Altura|Alcance|Longitud|Anchura|Ancho|Peso|Motor|Potencia|Combustible|Voltaje|Tensión|Capacidad|Velocidad|Consumo|Nº y tipo de focos)\b)(.*?)(?:Ver ficha técnica|Comparador|¿Te interesa|Máquinas similares|$)/is)?.[1] ?? "";
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const fieldPattern = new RegExp(`(${sorted.join("|")}):\\s*(.*?)(?=\\s+(?:${sorted.join("|")}):|\\s+Especificaciones técnicas|$)`, "giu");
  for (const match of section.matchAll(fieldPattern)) {
    const key = normalize(match[1] ?? "");
    const value = normalize(match[2] ?? "");
    if (!key || !value || conflicting.has(key)) continue;
    if (specs[key] !== undefined && specs[key] !== value) {
      delete specs[key];
      conflicting.add(key);
    } else {
      specs[key] = value;
    }
  }
  if (invalidGomarizPlatformHeight(pageUrl, specs)) delete specs["Altura plataforma"];
  return specs;
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
  const reference = content.match(/Referencia:\s*([\w-]+)/i)?.[1] ?? null;
  if (!title || !reference) throw new Error(`Ficha Gomariz sin título o referencia: ${pageUrl}`);

  const year = content.match(/\bAño:\s*((?:19|20)\d{2})\b/i)?.[1] ?? null;
  const brand = metadataValue(content, "Marca") ?? brandFromTitle(title, pageUrl);
  const description = normalize(content.match(/Descripción\s*(.*?)(?=\s+Dimensiones|\s+Especificaciones técnicas|\s+Ver ficha técnica|$)/i)?.[1] ?? "");
  const metadataStart = content.indexOf(`Referencia: ${reference}`);
  const overview = (metadataStart < 0 ? content : content.slice(metadataStart)).split(/Descripción|Dimensiones|Especificaciones técnicas/i)[0] ?? "";
  const priceMatch = overview.match(/\b(\d{1,3}(?:[. ]\d{3})*(?:,\d{2})?)\s*€/);
  const price = priceMatch?.[0] ?? null;
  const images = collectProductImages($, pageUrl, [
    ".woocommerce-product-gallery", ".product-gallery", ".swiper-slide",
    ".gallery", ".product-images"
  ], "gomariz");
  const image = images[0] ?? null;

  return {
    title,
    reference,
    brand,
    model: metadataValue(overview, "Modelo") ?? modelFromTitle(title, brand),
    year,
    price,
    shortDescription: null,
    longDescription: description || null,
    location: metadataValue(overview, "Ubicación") ?? metadataValue(overview, "Localización"),
    country: metadataValue(overview, "País"),
    horometer: metadataValue(overview, "Horómetro") ?? metadataValue(overview, "Horometro") ?? metadataValue(overview, "Horas"),
    serialNumber: metadataValue(overview, "Nº de serie") ?? metadataValue(overview, "Número de serie") ?? metadataValue(overview, "Número de bastidor"),
    image,
    images,
    specs: collectSpecs(content, pageUrl)
  };
};
