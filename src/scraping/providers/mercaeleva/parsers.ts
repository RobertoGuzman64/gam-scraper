import * as cheerio from "cheerio";
import { loadReadableHtml } from "../../parsing/readable-html.js";
import type { ParsedProduct } from "../../provider.js";
import { collectProductImages } from "../../parsing/image-gallery.js";
import { extractEmbeddedMachineMetadata, extractEmbeddedMachinePrice } from "./embedded-machine.js";
import { recoverMercaelevaDescriptionSpecs } from "./technical-description.js";

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

const salesTechnicalLabels = new Set(["Altura de elevación", "Tipo de mástil", "Capacidad de carga"]);

const salesTechnicalValue = (label: string, value: string): boolean => {
  if (label === "Tipo de mástil") {
    return /^[\p{L}][\p{L}\p{M}\s./-]{1,48}$/u.test(value)
      && !/\b(?:venta|ventas|cliente|información|informacion)\b/i.test(value);
  }
  return /^\d[\d.,\s]*\s*(?:m|metros?|kg|t|toneladas?)$/i.test(value);
};

const labelValue = ($: cheerio.CheerioAPI, label: string): string | null => {
  let result: string | null = null;
  let section: "data" | "sales" | "contact" = "data";
  $("body").find("h2, h3, h4, dt, th, label, span, div, p").each((_, el) => {
    if (result) return;
    const element = $(el);
    if (element.is("h2, h3, h4")) {
      const heading = normalize(element.text());
      if (/^(?:contacto|contact|contact information|información de contacto)$/i.test(heading)) section = "contact";
      else if (/^(?:sales information|información de venta)$/i.test(heading)) section = "sales";
      else if (element.is("h2")) section = "data";
      return;
    }
    if (section === "contact" || (section === "sales" && !salesTechnicalLabels.has(label))
      || element.find("*").length > 0
      || normalize(element.text()).toLocaleLowerCase("es") !== label.toLocaleLowerCase("es")) return;
    const sibling = element.next();
    const siblingValue = normalize(sibling.text());
    const parentValue = normalize(element.parent().text());
    const rest = normalize(parentValue.slice(label.length));
    const value = siblingValue && siblingValue.length < 240 ? siblingValue : rest && rest.length < 240 ? rest : null;
    if (value && (section !== "sales" || salesTechnicalValue(label, value))) result = value;
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


const technicalHeadings = new Set([
  "general information", "información general", "power and performance", "potencia y rendimiento", "chassis", "chasis"
]);

const technicalTerms = /(?:marca|modelo|motor|año|fabricaci[oó]n|bater[ií]a|cargador|carga|capacidad|altura|anchura|ancho|longitud|peso|horas|estado|condici[oó]n|cabina|m[aá]stil|ruedas|centro de gravedad|conductor|certificaci[oó]n|color|voltaje|corriente|t[ií]tulo adicional|art[ií]culo|reg\. no\.|id de maquinaria|potencia|distancia|accesorio|dimensi[oó]n|combustible|transmisi[oó]n|serial|número de serie)/i;
const nonTechnicalText = /(?:¡|!|\?|@|(?:oferta|contact|tel[eé]fono|dpt|gesti[oó]n flota|departamento|vendedor|comercial|precio|avinguda|avenida|calle|direcci[oó]n|street|road)\b)/i;

const isTechnicalLabel = (label: string, semantic: boolean): boolean =>
  label.length >= 2 && label.length <= 72 && /[\p{L}]/u.test(label)
  && !/[{}\[\]"€]/.test(label)
  && !nonTechnicalText.test(label)
  && (technicalTerms.test(label) || (semantic && !/\d/.test(label) && label.split(/\s+/).length <= 6));

const isTechnicalValue = (value: string): boolean =>
  value.length > 0 && value.length <= 240 && !/[{}\[\]"@]/.test(value)
  && !nonTechnicalText.test(value);

const collectSpecs = ($: cheerio.CheerioAPI): Record<string, string> => {
  const specs: Record<string, string> = {};
  let insideSpecs = false;

  $("body").find("*").each((_, el) => {
    const element = $(el);
    if (element.is("h2")) {
      insideSpecs = technicalHeadings.has(normalize(element.text()).toLocaleLowerCase("es"));
      return;
    }
    if (element.is("h3, h4") && /^(?:sales information|información de venta|machine description|descripción de la máquina|contacto|contact|contact information|información de contacto)$/i.test(normalize(element.text()))) {
      insideSpecs = false;
      return;
    }
    if (!insideSpecs || !element.is("dt, th, td, label, span, div, p") || element.children().length > 0
      || element.closest("h1, h2, h3, h4, h5, h6, script, style").length > 0) return;

    const key = normalize(element.text()).replace(/:\s*$/, "");
    const sibling = element.next();
    if (!sibling.length || sibling.find("dt, dd, th, td, div, p, h1, h2, h3, h4, h5, h6").length > 0) return;

    const semantic = (element.is("dt") && sibling.is("dd"))
      || (element.is("th, td") && sibling.is("td") && element.parent().is("tr"));
    const paired = semantic || ((element.is("span") && sibling.is("span"))
      || (element.is("div") && sibling.is("div"))
      || (element.is("p") && sibling.is("p")))
      && element.parent().children().length === 2
      && !element.parent().is("body");
    if (!paired || !isTechnicalLabel(key, semantic)) return;

    const value = normalize(sibling.text());
    if (!isTechnicalValue(value) || value === key) return;
    if (!Object.hasOwn(specs, key)) specs[key] = value;
  });

  const primaryLabels = ["Marca", "Modelo", "Título adicional", "Año de fabricación", "Artículo No.", "Horas laborales", "Estado", "Condición general", "Tipo de motor", "Altura de trabajo", "Altura de elevación", "Tipo de mástil", "Capacidad de carga", "Capacidad máxima de elevación", "Altura máxima de elevación", "Tipo de cabina", "Número de ruedas"];
  for (const label of primaryLabels) {
    if (specs[label]) continue;
    const value = labelValue($, label);
    if (value && isTechnicalValue(value)) specs[label] = value;
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
  const visibleHeader = normalize($("h1").first().nextUntil("h2").text()).slice(0, 600);
  const visiblePrice = visibleHeader.match(/^(?:precio(?:\s+de\s+venta)?\s*:?\s*)?(\d{1,3}(?:[\s\u00a0.]\d{3})+(?:[,.]\d{2})?\s*(?:EUR\b|€))/i)?.[1]
    ?? visibleHeader.match(/^(?:precio(?:\s+de\s+venta)?\s*:?\s*)?(\d+(?:[,.]\d{2})?\s*(?:EUR\b|€))/i)?.[1]
    ?? null;
  const specs = collectSpecs($);
  recoverMercaelevaDescriptionSpecs(specs, description, title);
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
  const location = embedded.location;
  const sourceCondition = normalize(specs["Estado"] ?? "").toLocaleLowerCase("es");
  const condition = /^(?:usad[oa]|segunda mano|de segunda mano)$/.test(sourceCondition) ? "Segunda mano"
    : /^nuev[oa]$/.test(sourceCondition) ? "Nuevo" : null;

  return {
    title,
    reference,
    brand: specs["Marca"] ?? null,
    model: specs["Modelo"] ?? null,
    year,
    price,
    condition,
    shortDescription: null,
    longDescription: description,
    location,
    country: embedded.country,
    horometer: hours,
    serialNumber: null,
    image,
    images,
    specs
  };
};
