import * as cheerio from "cheerio";

export const normalizeManainSaleProductUrl = (href: string, baseUrl: string): string | null => {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "https:" || !["manain.com", "www.manain.com"].includes(url.hostname.toLowerCase())) return null;
    if (!/^\/producto\/(?:venta|venda)-[^/]+\/?$/i.test(url.pathname)) return null;
    url.hostname = "manain.com";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

export const extractManainSaleProductLinks = (listingUrl: string, html: string): readonly string[] => {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    if ($(element).closest("header, nav, footer, .breadcrumb, .related, .related-products, .upsells").length) return;
    const href = $(element).attr("href");
    if (!href) return;
    const url = normalizeManainSaleProductUrl(href, listingUrl);
    if (url) links.add(url);
  });
  return [...links];
};

export type ManainListingResult = {
  readonly urls: readonly string[];
  readonly pagesVisited: number;
  readonly complete: boolean;
  readonly endReason: "control-exhausted" | "unverified-single-page" | "page-limit";
};

export const parseManainListingResult = (value: unknown): ManainListingResult => {
  if (!value || typeof value !== "object") throw new Error("Manain devolvió un resultado de descubrimiento inválido");
  if (!("urls" in value) || !Array.isArray(value.urls) || !value.urls.every((url: unknown) => typeof url === "string")) {
    throw new Error("Manain devolvió enlaces de catálogo inválidos");
  }
  if (!("pagesVisited" in value) || typeof value.pagesVisited !== "number" ||
    !Number.isSafeInteger(value.pagesVisited) || value.pagesVisited < 1 ||
    !("complete" in value) || typeof value.complete !== "boolean" ||
    !("endReason" in value) || !["control-exhausted", "unverified-single-page", "page-limit"].includes(String(value.endReason))) {
    throw new Error("Manain devolvió una cobertura de catálogo inválida");
  }
  const normalized = new Set<string>();
  for (const url of value.urls) {
    const canonical = normalizeManainSaleProductUrl(url, "https://manain.com/");
    if (!canonical) throw new Error(`Manain devolvió una URL ajena al catálogo de venta: ${url}`);
    normalized.add(canonical);
  }
  const endReason = value.endReason;
  if (endReason !== "control-exhausted" && endReason !== "unverified-single-page" && endReason !== "page-limit") {
    throw new Error("Manain devolvió un motivo de cierre inválido");
  }
  if (!normalized.size || value.complete !== (endReason === "control-exhausted")) {
    throw new Error("Manain devolvió un estado de cobertura inconsistente");
  }
  return { urls: [...normalized], pagesVisited: value.pagesVisited, complete: value.complete,
    endReason };
};
