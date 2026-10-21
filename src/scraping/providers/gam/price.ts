import * as cheerio from "cheerio";

type PriceResult = {
  readonly price: string | null;
  readonly priceText: string | null;
};

const normalizeSpace = (value: string): string => value.replace(/\s+/g, " ").trim();

const relatedSelector = [
  ".related-products",
  ".product-accessories",
  ".product-miniature",
  ".product-card",
  ".featured-products",
  ".crossselling",
  ".upsell-products",
  ".recommendations",
  ".products",
  "#js-product-list"
].join(", ");

const parsePrice = (text: string): string | null => {
  const value = normalizeSpace(text);
  if (/\b(?:consultar|bajo pedido|sin precio|pedir presupuesto|puja|pujar|subasta)\b/i.test(value)) return null;
  const match = value.match(/(?:^|[^\d.,])((?:\d{1,3}(?:[.,\s\u00a0]\d{3})+|\d+)(?:[.,]\d{1,2})?)(?=$|[^\d.,])/);
  if (!match?.[1]) return null;
  const raw = match[1].replace(/[\s\u00a0]/g, "");
  const separator = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  const hasDecimals = separator >= 0 && raw.length - separator - 1 <= 2;
  const normalized = hasDecimals
    ? `${raw.slice(0, separator).replace(/[.,]/g, "")}.${raw.slice(separator + 1)}`
    : raw.replace(/[.,]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? String(amount) : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProduct = (node: Record<string, unknown>): boolean =>
  (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]).includes("Product");

const canonicalUrl = (raw: string, base: string): string | null => {
  try {
    const url = new URL(raw, base);
    url.search = "";
    url.hash = "";
    return `${url.host}${url.pathname.replace(/\.html$/i, "").replace(/\/$/, "")}`;
  } catch {
    return null;
  }
};

const productMatchesPage = (
  node: Record<string, unknown>,
  pageUrl: string,
  title: string | null,
  productCount: number
): boolean => {
  const identifier = node.url ?? node["@id"];
  if (typeof identifier === "string") {
    const linked = canonicalUrl(identifier, pageUrl);
    return linked !== null && linked === canonicalUrl(pageUrl, pageUrl);
  }
  if (typeof node.name === "string" && title) {
    return normalizeSpace(node.name).toLocaleLowerCase("es") === normalizeSpace(title).toLocaleLowerCase("es");
  }
  return productCount === 1 && typeof node.name === "string" && title === null;
};

const structuredPrice = ($: cheerio.CheerioAPI, pageUrl: string, title: string | null): string | null => {
  for (const element of $("script[type='application/ld+json']").toArray()) {
    const source = $(element).html();
    if (!source) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      continue;
    }
    const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    const nodes = entries.flatMap((entry) => isRecord(entry)
      ? Array.isArray(entry["@graph"]) ? entry["@graph"] : [entry]
      : []);
    const products = nodes.filter((node): node is Record<string, unknown> => isRecord(node) && isProduct(node));
    for (const product of products) {
      if (!productMatchesPage(product, pageUrl, title, products.length)) continue;
      const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
      for (const offer of offers) {
        if (!isRecord(offer)) continue;
        if (typeof offer.priceCurrency === "string" && offer.priceCurrency.toUpperCase() !== "EUR") continue;
        const price = offer.price ?? (isRecord(offer.priceSpecification) ? offer.priceSpecification.price : null);
        if (typeof price !== "number" && typeof price !== "string") continue;
        const normalized = parsePrice(String(price));
        if (normalized) return normalized;
      }
    }
  }
  return null;
};

const auctionText = ($: cheerio.CheerioAPI): string | null => {
  const container = $("main").first().length ? $("main").first()
    : $("#content").first().length ? $("#content").first() : $("body").first();
  if (!container.length) return null;
  const content = container.clone();
  content.find(`header, footer, nav, ${relatedSelector}`).remove();
  const text = normalizeSpace(content.text());
  return text.match(/para\s+participar\s+en\s+la\s+subasta\s*:?/i)?.[0] ?? null;
};

const findDisplay = ($: cheerio.CheerioAPI, price: string): string | null => {
  for (const selector of [".current-price .price", ".product-prices .price", ".product-price", ".our_price_display", ".current-price"]) {
    for (const element of $(selector).toArray()) {
      if (!isOwnPriceNode($, $(element))) continue;
      const text = normalizeSpace($(element).text());
      if (/[€]|\bEUR\b/i.test(text) && parsePrice(text) === price) return text;
    }
  }
  return null;
};

const isOwnPriceNode = ($: cheerio.CheerioAPI, node: ReturnType<cheerio.CheerioAPI>): boolean => {
  if (node.closest(relatedSelector).length || node.closest("header, nav, footer").length) return false;
  const hasMain = $("main, #content").length > 0;
  return !hasMain || node.closest("main, #content").length > 0;
};

export const extractGamPrice = ($: cheerio.CheerioAPI, pageUrl: string, title: string | null): PriceResult => {
  const auction = auctionText($);
  if (auction) return { price: null, priceText: auction };

  const candidates: ReadonlyArray<{ readonly selector: string; readonly attribute?: string }> = [
    { selector: ".current-price [itemprop='price'][content]", attribute: "content" },
    { selector: "[itemprop='offers'] [itemprop='price'][content]", attribute: "content" },
    { selector: ".product-prices [data-price-amount]", attribute: "data-price-amount" },
    { selector: ".product-prices [data-price]", attribute: "data-price" },
    { selector: "[itemprop='price'][content]", attribute: "content" },
    { selector: ".current-price .price" },
    { selector: ".product-price" },
    { selector: ".current-price" },
    { selector: ".our_price_display" }
  ];

  const readCandidates = (entries: typeof candidates): PriceResult | null => {
    for (const { selector, attribute } of entries) {
      for (const element of $(selector).toArray()) {
        if (!isOwnPriceNode($, $(element))) continue;
        const text = attribute ? $(element).attr(attribute) : $(element).text();
        if (!text) continue;
        const price = parsePrice(text);
        if (price) return { price, priceText: findDisplay($, price) ?? normalizeSpace(text) };
      }
    }
    return null;
  };

  const primary = readCandidates(candidates.slice(0, 1));
  if (primary) return primary;

  const firstProductPrice = $("meta[property='product:price:amount']").first().attr("content");
  const metaPrice = firstProductPrice ? parsePrice(firstProductPrice) : null;
  if (metaPrice) return { price: metaPrice, priceText: findDisplay($, metaPrice) ?? firstProductPrice ?? metaPrice };

  const published = readCandidates(candidates.slice(1));
  if (published) return published;

  for (const element of $("dt").toArray()) {
    if (!isOwnPriceNode($, $(element))) continue;
    if (normalizeSpace($(element).text()).replace(/:+$/, "").toLowerCase() !== "precio") continue;
    const definition = $(element).next("dd");
    if (!definition.length) continue;
    const text = normalizeSpace(definition.text());
    const price = parsePrice(text);
    if (price) return { price, priceText: text };
  }

  const fromSchema = structuredPrice($, pageUrl, title);
  if (fromSchema) return { price: fromSchema, priceText: findDisplay($, fromSchema) ?? fromSchema };

  for (const selector of [".product-prices", ".product-price", ".current-price", ".our_price_display"]) {
    const element = $(selector).toArray().find((candidate) => isOwnPriceNode($, $(candidate)));
    if (!element) continue;
    const priceText = normalizeSpace($(element).text());
    if (priceText) return { price: null, priceText };
  }
  return { price: null, priceText: null };
};
