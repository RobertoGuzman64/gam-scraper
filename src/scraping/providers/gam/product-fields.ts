import * as cheerio from "cheerio";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { normalizeSpace } from "./text.js";
import { unrelatedDetails } from "./selectors.js";

export const pickDtDd = ($: cheerio.CheerioAPI, label: string): string | null => {
  let found: string | null = null;

  $("dt").each((_, el) => {
    if (found || $(el).closest(unrelatedDetails).length) return;
    const dtText = normalizeSpace($(el).text());
    if (!dtText) return;
    if (dtText.replace(/\s*:+\s*$/, "").toLocaleLowerCase("es") !== label.toLocaleLowerCase("es")) return;

    const dd = $(el).next("dd");
    const ddText = normalizeSpace(dd.text());
    if (ddText) found = ddText;
  });

  return found;
};

export const extractTitle = ($: cheerio.CheerioAPI): string | null => {
  const h1 = normalizeSpace($("h1").first().text());
  if (h1) return h1;
  const og = $('meta[property="og:title"]').attr("content");
  return og ? normalizeSpace(String(og)) : null;
};

const validYear = (value: string | null): string | null => value?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;

export const extractYear = ($: cheerio.CheerioAPI, title: string | null, pageUrl: string, specs: SpecsMap): {
  readonly year: string | null;
  readonly source: "ficha" | "descripcion" | "titulo" | "url" | null;
} => {
  const fromSpecs = specs["Año de fabricación"] ?? specs["Año"];
  const inFicha = validYear(pickDtDd($, "Año de fabricación") ?? pickDtDd($, "Año") ??
    (typeof fromSpecs === "string" ? fromSpecs : null));
  if (inFicha) return { year: inFicha, source: "ficha" };
  const descriptions = [
    $(".product-description-short").text(),
    $("#description, .product-description, .tab-content").first().text(),
    $("meta[property='og:description']").attr("content") ?? "",
    $("meta[name='description']").attr("content") ?? ""
  ];
  for (const description of descriptions) {
    const match = description.match(/(?:\baño\s*(?:de\s+fabricación)?\s*[:\-]?\s*|\bfabricad[oa]\s+en\s+)((?:19|20)\d{2})\b/i);
    if (match?.[1]) return { year: match[1], source: "descripcion" };
  }
  const inTitle = validYear(title);
  if (inTitle) return { year: inTitle, source: "titulo" };
  const path = decodeURIComponent(new URL(pageUrl).pathname).replace(/\/\d+-/, "/");
  const yearFromUrl = validYear(path.replace(/[-_]/g, " "));
  return { year: yearFromUrl, source: yearFromUrl ? "url" : null };
};

export const extractBreadcrumbs = ($: cheerio.CheerioAPI): readonly string[] => {
  const selectors = ["nav.breadcrumb li", "ol.breadcrumb li", ".breadcrumb li", "nav[aria-label='breadcrumb'] li"];
  for (const selector of selectors) {
    const items = $(selector).toArray()
      .map((node) => normalizeSpace($(node).text()))
      .filter((name) => name && !/^(?:inicio|home)$/i.test(name));
    if (items.length > 1) return [...new Set(items)];
  }
  const links = $(".breadcrumb a").toArray().map((node) => normalizeSpace($(node).text()))
    .filter((name) => name && !/^(?:inicio|home)$/i.test(name));
  if (links.length) return [...new Set(links)];
  return [];
};

export const extractPdf = ($: cheerio.CheerioAPI, pageUrl: string): string | null => {
  const anchors = $("main a[href], #content a[href], .product-container a[href]");
  for (const element of anchors.toArray()) {
    if ($(element).closest(unrelatedDetails).length) continue;
    const href = $(element).attr("href");
    if (!href) continue;
    try {
      const url = new URL(href, pageUrl);
      if (/^https?:$/.test(url.protocol) && /\.pdf(?:$|[?#])/i.test(url.toString())
        && /(?:ficha|técnica|tecnica|datasheet|technical|especificacion|descargar)/i.test(`${$(element).text()} ${url.pathname}`)) return url.toString();
    } catch { continue; }
  }
  return null;
};

export const extractHtmlDescription = ($: cheerio.CheerioAPI, selectors: readonly string[]): string | null => {
  for (const selector of selectors) {
    const node = $(selector).first();
    if (!node.length) continue;
    const html = node.html()?.trim();
    if (html && normalizeSpace(node.text())) return html;
  }
  return null;
};

const referenceLabel = /^(?:referencia|ref\.?|c[oó]digo(?:\s+gam)?)\s*[:：]\s*(.+)$/i;
const referenceValue = /^[\p{L}\p{N}]+(?:[._/+-][\p{L}\p{N}]+|\+(?=\s|$))*(?:\s+[\p{L}\p{N}]+(?:[._/+-][\p{L}\p{N}]+|\+(?=\s|$))*)*$/iu;
const adjacentReferenceField = /\s+(?=(?:marca|modelo|precio|estado|disponibilidad|año|c[oó]digo|referencia|ref\.?)\s*[:：])/i;

const normalizeExternalReference = (value: string): string | null => {
  const reference = normalizeSpace(value).replace(/\.$/, "");
  return referenceValue.test(reference) ? reference : null;
};

const parseLabelledExternalReference = (value: string): string | null => {
  const match = normalizeSpace(value).match(referenceLabel);
  if (!match?.[1]) return null;
  const [reference] = match[1].split(adjacentReferenceField);
  return normalizeExternalReference(reference ?? "");
};

export const extractExternalReference = ($: cheerio.CheerioAPI): string | null => {
  for (const label of ["Referencia", "Ref.", "Código", "Código GAM"]) {
    const match = pickDtDd($, label);
    if (match) return match;
  }
  const source = $(".product-reference, .product-sku, [itemprop='sku'], [data-product-reference]")
    .filter((_, element) => $(element).closest(unrelatedDetails).length === 0)
    .first();
  const fromSource = source.attr("content") ?? source.attr("data-product-reference") ?? normalizeSpace(source.text());
  const direct = parseLabelledExternalReference(fromSource)
    ?? (source.length && !referenceLabel.test(fromSource) ? normalizeExternalReference(fromSource) : null);
  if (direct) return direct;

  const container = $("main, #content, #product").first();
  if (!container.length) return null;
  const clean = container.clone();
  clean.find(unrelatedDetails).remove();
  for (const element of clean.find("p, li, td, th, span, div, section").toArray()) {
    const value = normalizeSpace($(element).text());
    if ($(element).find("p, li, td, th, div, section, a, button").length) continue;
    const reference = parseLabelledExternalReference(value);
    if (reference) return reference;
  }
  return null;
};

