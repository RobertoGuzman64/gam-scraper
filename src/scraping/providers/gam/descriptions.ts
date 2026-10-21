import * as cheerio from "cheerio";
import { fold, normalizeSpace } from "./text.js";

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

export const extractLongDescription = ($: cheerio.CheerioAPI): string | null => {
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

export const extractShortDescription = ($: cheerio.CheerioAPI): string | null => {
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

