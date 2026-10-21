import * as cheerio from "cheerio";
import type { SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import { collectProductImages } from "../../parsing/image-gallery.js";
import { extractGamGallery } from "./gallery.js";
import { distinguishDescriptions } from "../../../shared/descriptions.js";
import { extractGamPrice } from "./price.js";

export const normalizeSpace = (s: string): string => s.replace(/\s+/g, " ").trim();

export const buildPagedUrl = (categoryUrl: string, page: number): string => {
  const u = new URL(categoryUrl);
  if (page <= 1) {
    u.searchParams.delete("page");
    return u.toString();
  }
  u.searchParams.set("page", String(page));
  return u.toString();
};

const canonicalizeNoQueryNoHash = (url: string): string => {
  const u = new URL(url);
  u.hash = "";
  u.search = "";
  return u.toString();
};

export const isProductUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (u.hostname !== "online.gamrentals.com") return false;
    if (!u.pathname.startsWith("/es/")) return false;
    if (u.searchParams.has("action")) return false;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "es") return false;
    if (["c", "inicio"].includes(parts[1] ?? "")) return false;

    const last = parts.at(-1);
    return Boolean(last && /^\d+-[^/]+(?:\.html)?$/i.test(last));
  } catch {
    return false;
  }
};

export const isCategoryUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (u.hostname !== "online.gamrentals.com") return false;
    if (!u.pathname.startsWith("/es/")) return false;
    if (u.searchParams.has("action")) return false;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return false;

    const last = parts.at(-1);
    if (!last) return false;

    return /^\d+-/.test(last);
  } catch {
    return false;
  }
};

export const extractProductLinksFromListing = (listingUrl: string, html: string): readonly string[] => {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  const productCards = $("#js-product-list .product-miniature, #js-product-list .product, .products .product-miniature, .products .product");
  const anchors = productCards.length ? productCards.find("a[href]") : $("main a[href], #content a[href], #js-product-list a[href]");
  anchors.each((_, el) => {
    if ($(el).closest("header, nav, footer, .breadcrumb, #header, #footer").length) return;
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const abs = new URL(href, listingUrl).toString();
      const u = new URL(abs);
      u.hash = "";
      u.search = "";
      const s = u.toString();
      if (isProductUrl(s)) links.add(s);
    } catch {
      return;
    }
  });

  return [...links];
};

export const extractExpectedTotalFromListing = (html: string): number | null => {
  const $ = cheerio.load(html);
  const candidates = [
    $(".total-products").first().text(),
    $("#js-product-list-top").first().text(),
    $(".pagination .current").first().text(),
    $("main").first().text()
  ];
  for (const text of candidates) {
    const normalized = normalizeSpace(text);
    const match = normalized.match(/(?:\b(?:de|of)\s+)(\d[\d.,\s]*?)\s+(?:art[íi]culos?|productos?|items?|results?)\b/i)
      ?? normalized.match(/(?:mostrando|showing)\s+\d+\s*[-–]\s*\d+\s+(?:de|of)\s+(\d[\d.,]*)\b/i);
    if (!match?.[1]) continue;
    const count = Number(match[1].replace(/[.,\s]/g, ""));
    if (Number.isSafeInteger(count) && count >= 0) return count;
  }
  return null;
};

export const extractCategoryLinksFromPage = (pageUrl: string, html: string): readonly string[] => {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const $a = $(el);

    if ($a.closest("header, nav, footer").length > 0) return;
    if ($a.closest("#header, #footer, .header, .footer, .nav, .navbar").length > 0) return;
    if ($a.closest("nav[aria-label='breadcrumb'], .breadcrumb, ol.breadcrumb").length > 0) return;

    const href = $a.attr("href");
    if (!href) return;

    try {
      const abs = new URL(href, pageUrl).toString();
      const normalized = canonicalizeNoQueryNoHash(abs);
      if (isCategoryUrl(normalized)) links.add(normalized);
    } catch {
      return;
    }
  });

  return [...links];
};

const unrelatedDetails = "header, nav, footer, .breadcrumb, .related-products, .product-miniature, .product-accessories, .featured-products, .crossselling, #js-product-list";

const pickDtDd = ($: cheerio.CheerioAPI, label: string): string | null => {
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

const extractTitle = ($: cheerio.CheerioAPI): string | null => {
  const h1 = normalizeSpace($("h1").first().text());
  if (h1) return h1;
  const og = $('meta[property="og:title"]').attr("content");
  return og ? normalizeSpace(String(og)) : null;
};

const validYear = (value: string | null): string | null => value?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;

const extractYear = ($: cheerio.CheerioAPI, title: string | null, pageUrl: string, specs: SpecsMap): {
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

const fold = (s: string): string => normalizeSpace(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const stripAfterMarkers = (s: string): string => {
  const markers = [
    "¿No es lo que estabas buscando?",
    "Categorías relacionadas",
    "Categorias relacionadas",
    "Productos relacionados",
    "Productos recomendados",
    "Más productos",
    "Mas productos",
    "Otros productos",
    "Te puede interesar",
    "También te puede interesar",
    "Tambien te puede interesar"
  ];
  let out = s;
  for (const m of markers) {
    const idx = out.indexOf(m);
    if (idx >= 0) out = out.slice(0, idx);
  }
  return normalizeSpace(out);
};

const resolveTargetId = (raw: string): string | null => {
  const value = normalizeSpace(raw);
  if (!value || value === "#") return null;

  if (/^[A-Za-z][\w:-]*$/.test(value)) return value;

  try {
    const url = new URL(value, "https://example.invalid");
    const fragment = url.hash.slice(1);
    return fragment ? decodeURIComponent(fragment) : null;
  } catch {
    return null;
  }
};

const extractPanelText = ($: cheerio.CheerioAPI, panel: ReturnType<cheerio.CheerioAPI>): string | null => {
  const ps = panel
    .find("p")
    .toArray()
    .map((el) => normalizeSpace($(el).text()))
    .map(stripAfterMarkers)
    .filter((t) => t.length > 0);

  if (ps.length > 0) {
    const joined = stripAfterMarkers(ps.join("\n"));
    return joined.length > 0 ? joined : null;
  }

  const t = stripAfterMarkers(normalizeSpace(panel.text()));
  return t.length > 0 ? t : null;
};

const extractTabPanelByLabel = ($: cheerio.CheerioAPI, label: string): string | null => {
  const wanted = fold(label);

  const triggers = $("a[href], button, [role='tab']").toArray();
  for (const el of triggers) {
    const $el = $(el);
    const txt = fold($el.text());
    if (!txt || txt !== wanted) continue;

    const raw =
      $el.attr("data-bs-target") ??
      $el.attr("data-target") ??
      $el.attr("aria-controls") ??
      $el.attr("href") ??
      null;

    const targetId = raw ? resolveTargetId(raw) : null;
    if (targetId) {
      const panel = $("[id]").filter((_, element) => $(element).attr("id") === targetId).first();
      if (panel.length > 0) {
        const t = extractPanelText($, panel);
        if (t) return t;
      }
    }

    const triggerId = $el.attr("id");
    if (triggerId) {
      const panel = $("[aria-labelledby]").filter((_, element) => $(element).attr("aria-labelledby") === triggerId).first();
      if (panel.length > 0) {
        const t = extractPanelText($, panel);
        if (t) return t;
      }
    }
  }

  return null;
};

const extractLongDescriptionFromDescriptionTab = ($: cheerio.CheerioAPI): string | null => {
  const t1 = extractTabPanelByLabel($, "Descripción");
  if (t1) return t1;

  const t2 = extractTabPanelByLabel($, "Descripcion");
  if (t2) return t2;

  const candidates = [
    "[role='tabpanel'][id*='desc']",
    "[role='tabpanel'][id*='descr']",
    "[role='tabpanel'][id*='descripcion']",
    "[role='tabpanel'][class*='desc']",
    "[role='tabpanel'][class*='descr']",
    "[role='tabpanel'][class*='descripcion']",
    "#description",
    "[id*='description']",
    "[id*='descripcion']",
    ".tabs-content .tab-content",
    ".tab-content"
  ];

  let best: string | null = null;

  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length === 0) continue;

    const t = extractPanelText($, el);
    if (!t) continue;

    if (!best || t.length > best.length) best = t;
  }

  return best;
};

const extractLongDescriptionFromDetailsArea = ($: cheerio.CheerioAPI): string | null => {
  const dtMarca = $("dt")
    .filter((_, el) => normalizeSpace($(el).text()).toLowerCase() === "marca")
    .first();

  if (dtMarca.length === 0) return null;

  const dl = dtMarca.closest("dl");
  if (dl.length === 0) return null;

  const container = dl.parent();
  if (container.length === 0) return null;

  const clone = container.clone();
  clone.find("dl").remove();
  clone.find("dt, dd").remove();

  const paragraphs = clone
    .find("p")
    .toArray()
    .map((el) => normalizeSpace($(el).text()))
    .map(stripAfterMarkers)
    .filter((t) => t.length > 0);

  if (paragraphs.length > 0) {
    const joined = stripAfterMarkers(paragraphs.join("\n"));
    return joined.length > 0 ? joined : null;
  }

  const t = stripAfterMarkers(normalizeSpace(clone.text()));
  return t.length > 0 ? t : null;
};

const extractLongDescription = ($: cheerio.CheerioAPI): string | null => {
  const fromTab = extractLongDescriptionFromDescriptionTab($);
  if (fromTab) return fromTab;

  const fromDetails = extractLongDescriptionFromDetailsArea($);
  if (fromDetails) return fromDetails;

  const byOg = $('meta[property="og:description"]').attr("content");
  if (byOg) {
    const s = normalizeSpace(String(byOg));
    return s ? stripAfterMarkers(s) : null;
  }

  const candidates = [
    "#description",
    ".tabs-content",
    ".tab-content",
    "[id*='description']",
    "[class*='description']",
    "[id*='descripcion']",
    "[class*='descripcion']"
  ];

  let best: string | null = null;

  for (const sel of candidates) {
    const t = stripAfterMarkers(normalizeSpace($(sel).first().text()));
    if (!t) continue;
    if (!best || t.length > best.length) best = t;
  }

  return best;
};

const extractShortDescription = ($: cheerio.CheerioAPI): string | null => {
  const fromProduct = normalizeSpace($(".product-description-short, #product-description-short").first().text());
  if (fromProduct) return stripAfterMarkers(fromProduct);

  const og = $('meta[property="og:description"]').attr("content");
  if (og) {
    const s = stripAfterMarkers(normalizeSpace(String(og)));
    if (s) return s;
  }

  const meta = $('meta[name="description"]').attr("content");
  if (meta) {
    const s = stripAfterMarkers(normalizeSpace(String(meta)));
    if (s) return s;
  }

  return null;
};

const mergeSpecValue = (prev: SpecValue | undefined, next: SpecValue): SpecValue => {
  if (prev === undefined) return next;

  type Scalar = Exclude<SpecValue, readonly unknown[]>;
  const prevArr: readonly Scalar[] = Array.isArray(prev) ? (prev as readonly Scalar[]) : [prev as Scalar];
  const nextArr: readonly Scalar[] = Array.isArray(next) ? (next as readonly Scalar[]) : [next as Scalar];

  const merged: Scalar[] = [...prevArr, ...nextArr];

  if (merged.length === 1) return merged[0]!;

  const out: Scalar[] = [];
  const seen = new Set<string>();
  for (const v of merged) {
    const k = typeof v === "string" ? v : String(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }

  return out.length === 1 ? out[0]! : out;
};

const normalizeLabel = (label: string): string => normalizeSpace(label).replace(/\s*:+\s*$/, "");

const validSpecLabel = (label: string): boolean =>
  label.length > 1 && label.length <= 100 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(label)
  && !/^\s*(?:si|no|n\/?a)\s*$/i.test(label)
  && !/^\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)+(?:\s*(?:mm|cm|m|metros?))?$/i.test(label)
  && !/^\d+(?:[.,]\d+)?\s*(?:mes(?:es)?|horas?|kg|mm|cm|metros?|kw|km|años?)$/i.test(label)
  && !/^(?:\d+[.,xX\s\/-]*)$/.test(label);

const extractSpecs = ($: cheerio.CheerioAPI): SpecsMap => {
  const out: Record<string, SpecValue> = {};
  const add = (rawLabel: string, value: SpecValue): void => {
    const label = normalizeLabel(rawLabel);
    if (!validSpecLabel(label)) return;
    if (typeof value === "string" && !value.trim()) return;
    out[label] = mergeSpecValue(out[label], value);
  };

  $("dl").each((_, dl) => {
    if ($(dl).closest(unrelatedDetails).length) return;
    $(dl).children("dt").each((_, el) => {
      const term = $(el);
      const definition = term.next();
      if (!definition.is("dd")) return;
      const values = definition.find("li").toArray().map((li) => normalizeSpace($(li).text())).filter(Boolean);
      add(term.text(), values.length ? values : normalizeSpace(definition.text()));
    });
  });

  $("table tr").each((_, el) => {
    if ($(el).closest(unrelatedDetails).length) return;
    const cells = $(el).children("th, td");
    if (cells.length !== 2) return;
    const name = normalizeLabel($(cells[0]).text());
    if (!name) return;
    add(name, normalizeSpace($(cells[1]).text()));
  });

  $(".product-features .data-sheet li, .product-features .product-feature").each((_, el) => {
    if ($(el).closest(unrelatedDetails).length) return;
    const node = $(el);
    const name = node.find(".name, .feature-name, strong").first().text();
    const value = node.find(".value, .feature-value").first().text();
    if (name && value) add(name, normalizeSpace(value));
  });

  return out;
};

const extractExplicitTechnicalSpecs = ($: cheerio.CheerioAPI): SpecsMap => {
  const short = $(".product-description-short, #product-description-short")
    .filter((_, element) => $(element).closest(unrelatedDetails).length === 0)
    .first();
  const text = [short.text(), $("meta[name='description']").attr("content") ?? ""].filter(Boolean).join("\n");
  const expressions: readonly { readonly key: string; readonly pattern: RegExp }[] = [
    { key: "Altura de trabajo", pattern: /\baltura\s+(?:m[aá]xima\s+)?de\s+trabajo\s*[:：]\s*(\d+(?:[.,]\d+)?\s*(?:m|metros?|mm))\b/gi },
    { key: "Altura de elevación", pattern: /\baltura\s+de\s+elevaci[oó]n\s*[:：]\s*(\d+(?:[.,]\d+)?\s*(?:m|metros?|mm))\b/gi },
    { key: "Tipo de mástil", pattern: /\btipo\s+de\s+m[aá]stil\s*[:：]\s*(simple|d[uú]plex|tr[ií]plex|cu[aá]druplex)\b/gi }
  ];
  const found: Record<string, SpecValue> = {};
  for (const { key, pattern } of expressions) {
    const matches = [...text.matchAll(pattern)].map((match) => normalizeSpace(match[1] ?? ""));
    if (matches.length && matches.every((value) => fold(value) === fold(matches[0] ?? ""))) {
      found[key] = matches[0]!;
    }
  }
  return found;
};

const extractBreadcrumbs = ($: cheerio.CheerioAPI): readonly string[] => {
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

const extractPdf = ($: cheerio.CheerioAPI, pageUrl: string): string | null => {
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

const extractHtmlDescription = ($: cheerio.CheerioAPI, selectors: readonly string[]): string | null => {
  for (const selector of selectors) {
    const node = $(selector).first();
    if (!node.length) continue;
    const html = node.html()?.trim();
    if (html && normalizeSpace(node.text())) return html;
  }
  return null;
};

const extractExternalReference = ($: cheerio.CheerioAPI): string | null => {
  for (const label of ["Referencia", "Ref.", "Código", "Código GAM"]) {
    const match = pickDtDd($, label);
    if (match) return match;
  }
  const source = $(".product-reference, .product-sku, [itemprop='sku'], [data-product-reference]")
    .filter((_, element) => $(element).closest(unrelatedDetails).length === 0)
    .first();
  const fromSource = source.attr("content") ?? source.attr("data-product-reference") ?? normalizeSpace(source.text());
  const direct = fromSource.match(/(?:referencia|ref\.?|c[oó]digo(?:\s+gam)?)\s*:\s*([\w-]+)/i)?.[1]
    ?? (source.length && /^[\w-]+$/.test(fromSource.trim()) ? fromSource.trim() : null);
  if (direct) return direct;

  const container = $("main, #content, #product").first();
  if (!container.length) return null;
  const clean = container.clone();
  clean.find(unrelatedDetails).remove();
  for (const element of clean.find("p, li, td, th, span, div, section").toArray()) {
    const value = normalizeSpace($(element).text());
    const match = value.match(/^(?:referencia|ref\.?|c[oó]digo(?:\s+gam)?)\s*:\s*([A-Z0-9][\w-]{2,})\b/i);
    if (match?.[1]) return match[1];
  }
  const text = normalizeSpace(clean.text()).split(/(?:¿no es lo que estabas buscando\?|productos relacionados|categor[ií]as relacionadas)/i)[0] ?? "";
  return text.match(/\b(?:referencia|ref\.?|c[oó]digo(?:\s+gam)?)\s*:\s*([A-Z0-9][\w-]{2,})\b/i)?.[1] ?? null;
};

export const parseProductPage = (html: string, pageUrl: string): {
  readonly title: string | null;
  readonly shortDescription: string | null;
  readonly longDescription: string | null;
  readonly price: string | null;
  readonly priceText: string | null;
  readonly condition: "Nuevo" | "Segunda mano" | null;
  readonly breadcrumbs: readonly string[];
  readonly subcategory: string | null;
  readonly externalReference: string | null;
  readonly shortDescriptionHtml: string | null;
  readonly longDescriptionHtml: string | null;
  readonly technicalSheetUrl: string | null;
  readonly yearSource: "ficha" | "descripcion" | "titulo" | "url" | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly year: string | null;
  readonly location: string | null;
  readonly country: string | null;
  readonly horometer: string | null;
  readonly serialNumber: string | null;
  readonly image: string | null;
  readonly images: readonly string[];
  readonly specs: SpecsMap;
} => {
  const $ = cheerio.load(html);
  const title = extractTitle($);
  const longDescription = extractLongDescription($);
  const descriptions = distinguishDescriptions(extractShortDescription($), longDescription);
  const { price, priceText } = extractGamPrice($, pageUrl, title);
  const extractedSpecs = extractSpecs($);
  const labeledSpecs = extractExplicitTechnicalSpecs($);
  const specs: SpecsMap = { ...labeledSpecs, ...extractedSpecs };
  const { year, source: yearSource } = extractYear($, title, pageUrl, specs);
  const breadcrumbs = extractBreadcrumbs($);
  const lineage = breadcrumbs.filter((part) => part !== title);
  const path = decodeURIComponent(new URL(pageUrl).pathname);
  const contextual = lineage.join(" ").toLocaleLowerCase("es");
  const itemCondition = $("[itemprop='itemCondition']").first().attr("href") ??
    $("[itemprop='itemCondition']").first().attr("content") ?? "";
  const fromNew = /(?:maquinaria nueva|\bnuev[oa]s?\b)/i.test(contextual) || /-nuev[oa]s?\b/i.test(path) ||
    /\bNewCondition\b/i.test(itemCondition);
  const fromUsed = /(?:ocasión|segunda mano)/i.test(contextual) || /(?:segunda-mano|de-ocasion|de-ocasión)/i.test(path) ||
    /\bUsedCondition\b/i.test(itemCondition);
  const condition = fromNew === fromUsed ? null : fromNew ? "Nuevo" : "Segunda mano";
  const images = extractGamGallery($, pageUrl);
  const fallbackImages = images.length ? images : collectProductImages($, pageUrl, [
    "img[itemprop='image']", "main img", "#content img", "body img"
  ], "gam");
  return {
    title,
    shortDescription: descriptions.short,
    longDescription: descriptions.long,
    price,
    priceText,
    condition,
    breadcrumbs,
    subcategory: lineage.at(-1) ?? null,
    externalReference: extractExternalReference($),
    shortDescriptionHtml: extractHtmlDescription($, [".product-description-short", "#product-description-short", "[itemprop='description']"]),
    longDescriptionHtml: extractHtmlDescription($, ["#description .product-description", "#description", ".product-description", ".tab-content .product-description"]),
    technicalSheetUrl: extractPdf($, pageUrl),
    yearSource,
    brand: pickDtDd($, "Marca"),
    model: pickDtDd($, "Modelo"),
    year,
    location: pickDtDd($, "Ubicación") ?? pickDtDd($, "Ubicacion"),
    country: pickDtDd($, "País") ?? pickDtDd($, "Pais"),
    horometer: pickDtDd($, "Horómetro") ?? pickDtDd($, "Horometro"),
    serialNumber: pickDtDd($, "Nº de serie") ?? pickDtDd($, "Nº de Serie"),
    image: fallbackImages[0] ?? null,
    images: fallbackImages,
    specs
  };
};
