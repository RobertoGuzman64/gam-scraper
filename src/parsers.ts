import * as cheerio from "cheerio";
import type { SpecsMap, SpecValue } from "./types.js";

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
    if (!u.pathname.startsWith("/es/")) return false;
    if (!u.pathname.includes("segunda-mano")) return false;
    if (u.searchParams.has("action")) return false;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 3) return false;

    const last = parts.at(-1);
    if (!last) return false;

    return /^\d+-/.test(last);
  } catch {
    return false;
  }
};

export const isCategoryUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith("/es/")) return false;
    if (!u.pathname.includes("segunda-mano")) return false;
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

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const abs = new URL(href, listingUrl).toString();
      const u = new URL(abs);
      u.hash = "";
      const s = u.toString();
      if (isProductUrl(s)) links.add(s);
    } catch {
      return;
    }
  });

  return [...links];
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

const pickDtDd = ($: cheerio.CheerioAPI, label: string): string | null => {
  let found: string | null = null;

  $("dt").each((_, el) => {
    if (found) return;
    const dtText = normalizeSpace($(el).text());
    if (!dtText) return;
    if (dtText.toLowerCase() !== label.toLowerCase()) return;

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

const extractPrice = ($: cheerio.CheerioAPI): string | null => {
  const meta = $('meta[property="product:price:amount"]').attr("content");
  if (meta) return normalizeSpace(String(meta));

  const text = normalizeSpace($.root().text());
  const m = text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/);
  if (m?.[1]) return `${m[1]} €`;
  return null;
};

const extractYear = ($: cheerio.CheerioAPI, title: string | null): string | null => {
  const byLabel = pickDtDd($, "Año");
  if (byLabel) return byLabel;

  if (title) {
    const m = title.match(/\b(20\d{2}|19\d{2})\b/);
    if (m?.[1]) return m[1];
  }

  const text = normalizeSpace($.root().text());
  const m = text.match(/\b(20\d{2}|19\d{2})\b/);
  return m?.[1] ?? null;
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

const resolveTargetSelector = (raw: string): string | null => {
  const v = normalizeSpace(raw);
  if (!v) return null;

  if (v.startsWith("#")) return v;

  try {
    const u = new URL(v, "https://example.invalid");
    if (u.hash) return u.hash;
  } catch { }

  if (/^[A-Za-z][\w:-]*$/.test(v)) return `#${v}`;

  return null;
};

const extractPanelText = ($: cheerio.CheerioAPI, panel: cheerio.Cheerio<any>): string | null => {
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

    const sel = raw ? resolveTargetSelector(raw) : null;
    if (sel) {
      const panel = $(sel).first();
      if (panel.length > 0) {
        const t = extractPanelText($, panel);
        if (t) return t;
      }
    }

    const triggerId = $el.attr("id");
    if (triggerId) {
      const panel = $(`[aria-labelledby="${triggerId}"]`).first();
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

const extractShortDescription = ($: cheerio.CheerioAPI, longDescription: string | null): string | null => {
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

  if (longDescription) {
    const firstLine = longDescription.split("\n").map((x) => normalizeSpace(x)).find((x) => x.length > 0) ?? "";
    if (firstLine) return firstLine.length > 260 ? `${firstLine.slice(0, 257)}...` : firstLine;
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

const extractSpecs = ($: cheerio.CheerioAPI): SpecsMap => {
  const out: Record<string, SpecValue> = {};

  $("dt").each((_, el) => {
    const key = normalizeSpace($(el).text());
    if (!key) return;

    const dd = $(el).next("dd");
    if (dd.length === 0) return;

    const lis = dd
      .find("li")
      .toArray()
      .map((li) => normalizeSpace($(li).text()))
      .filter(Boolean);

    if (lis.length > 0) {
      out[key] = mergeSpecValue(out[key], lis);
      return;
    }

    const value = normalizeSpace(dd.text());
    if (!value) return;

    out[key] = mergeSpecValue(out[key], value);
  });

  return out;
};

export const parseProductPage = (html: string): {
  readonly title: string | null;
  readonly shortDescription: string | null;
  readonly longDescription: string | null;
  readonly price: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly year: string | null;
  readonly location: string | null;
  readonly country: string | null;
  readonly horometer: string | null;
  readonly serialNumber: string | null;
  readonly specs: SpecsMap;
} => {
  const $ = cheerio.load(html);

  const title = extractTitle($);
  const longDescription = extractLongDescription($);
  const shortDescription = extractShortDescription($, longDescription);
  const price = extractPrice($);

  const brand = pickDtDd($, "Marca");
  const model = pickDtDd($, "Modelo");
  const horometer = pickDtDd($, "Horómetro") ?? pickDtDd($, "Horometro");
  const serialNumber = pickDtDd($, "Nº de serie") ?? pickDtDd($, "Nº de Serie");
  const location = pickDtDd($, "Ubicación") ?? pickDtDd($, "Ubicacion");
  const country = pickDtDd($, "País") ?? pickDtDd($, "Pais");
  const year = extractYear($, title);

  const specs = extractSpecs($);

  return { title, shortDescription, longDescription, price, brand, model, year, location, country, horometer, serialNumber, specs };
};