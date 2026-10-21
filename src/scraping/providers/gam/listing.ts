import * as cheerio from "cheerio";
import { normalizeSpace } from "./text.js";

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

