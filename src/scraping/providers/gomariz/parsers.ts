import * as cheerio from "cheerio";
import { loadReadableHtml } from "../../parsing/readable-html.js";
import type { ParsedProduct } from "../../provider.js";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { collectProductImages } from "../../parsing/image-gallery.js";

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

const collectSpecs = (source: string): SpecsMap => {
  const specs: Record<string, string> = {};
  const keys = [
    "Altura plataforma", "Altura de trabajo", "Alcance lateral", "Altura almacenaje",
    "Altura", "Longitud", "Anchura", "Peso", "Motor", "Capacidad"
  ];
  const section = source.match(/Dimensiones\s*(.*?)(?:Ver ficha técnica|Comparador|¿Te interesa|Máquinas similares|$)/is)?.[1] ?? "";
  const fieldPattern = new RegExp(`(${keys.join("|")}):\\s*(.*?)(?=\\s+(?:${keys.join("|")}):|\\s+Especificaciones técnicas|$)`, "giu");
  for (const match of section.matchAll(fieldPattern)) {
    const key = normalize(match[1] ?? "");
    const value = normalize(match[2] ?? "");
    if (key && value) specs[key] = value;
  }
  return specs;
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
  const brandText = content.match(/\bMarca:\s*(.*?)(?=\s+(?:Ver precio|Contactar|Descripción|Dimensiones|Año:|Referencia:)|$)/i)?.[1] ?? "";
  const brand = normalize(brandText) || null;
  const description = normalize(content.match(/Descripción\s*(.*?)(?=\s+Dimensiones|\s+Especificaciones técnicas|\s+Ver ficha técnica|$)/i)?.[1] ?? "");
  const metadataStart = content.indexOf(`Referencia: ${reference}`);
  const overview = (metadataStart < 0 ? content : content.slice(metadataStart)).split(/Descripción|Dimensiones|Especificaciones técnicas/i)[0] ?? "";
  const priceMatch = /Ver precio/i.test(overview) ? null : overview.match(/\b(\d{1,3}(?:[. ]\d{3})*(?:,\d{2})?)\s*€/);
  const price = priceMatch?.[0] ?? null;
  const images = collectProductImages($, pageUrl, [
    ".woocommerce-product-gallery", ".product-gallery", ".swiper-slide",
    ".gallery", ".product-images"
  ]);
  const image = images[0] ?? null;

  return {
    title,
    reference,
    brand,
    model: brand && title.toLocaleLowerCase("es").startsWith(`${brand.toLocaleLowerCase("es")} `)
      ? title.slice(brand.length).trim() || null
      : null,
    year,
    price,
    shortDescription: description ? description.slice(0, 260) : null,
    longDescription: description || null,
    location: null,
    country: null,
    horometer: null,
    serialNumber: null,
    image,
    images,
    specs: collectSpecs(content)
  };
};
