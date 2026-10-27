import * as cheerio from "cheerio";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { collectProductImages, identifyWordPressImage } from "../../parsing/image-gallery.js";
import type { ParsedProduct } from "../../provider.js";
import { normalizeManainSaleProductUrl } from "./listing.js";

const clean = (value: string): string => value.replace(/\s+/g, " ").trim();
const normalizedLabel = (value: string): string => clean(value).replace(/\s*:\s*$/, "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const excluded = ".related, .related-products, .up-sells, .upsells, .cross-sells, .product-recommendations, .related-products-wrapper, .woocommerce-RelatedProducts, .products, aside, nav, footer, form, script, style, noscript, template";
const canonicalLabels: Readonly<Record<string, string>> = {
  ano: "Año", "ano de fabricacion": "Año de fabricación", horometro: "Horómetro",
  condicion: "Condición", "nueva o usada": "Nueva o usada", "capacidad deposito": "Capacidad depósito", "numero de serie": "Número de serie", "nº de serie": "Nº de serie",
  traccion: "Tracción", "longitud extension": "Longitud extensión"
};
const technicalLabels = new Set([
  "marca", "modelo", "motor", "nueva o usada", "ano", "ano de fabricacion", "horas", "horas de trabajo", "horas laborales", "horometro", "estado", "condicion", "peso operativo", "peso", "altura trabajo", "altura de trabajo", "altura elevacion", "altura de elevacion", "capacidad carga", "capacidad de carga", "capacidad elevacion", "capacidad de elevacion", "capacidad deposito", "potencia", "tipo de enganche", "longitud", "ancho", "anchura", "alto", "altura", "numero de serie", "nº de serie", "serie", "sku", "referencia"
]);

const rootOf = ($: cheerio.CheerioAPI): ReturnType<cheerio.CheerioAPI> => {
  const candidates = [
    "main div.product[id^='product-']",
    "main article.product",
    "main div.product",
    "article.product",
    ".single-product div.product",
    "main [itemtype*='schema.org/Product']",
    "main"
  ];
  for (const selector of candidates) {
    const candidate = $(selector).filter((_, element) =>
      $(element).find("h1, h2.raven-product-title").length > 0
    ).first();
    if (candidate.length && (selector !== "main" || candidate.find(".sku_wrapper, [itemprop='sku'], .product_meta .sku").length)) return candidate;
  }
  throw new Error("Manain: no se encontró el contenido principal de la ficha");
};

type Values = ReadonlyMap<string, readonly string[]>;

const collectValues = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>): Values => {
  const results = new Map<string, string[]>();
  const add = (label: string, value: string, isProductAttribute = false): void => {
    const key = normalizedLabel(label);
    const data = clean(value);
    if ((!technicalLabels.has(key) && !isProductAttribute) || !key || key.length > 90 ||
      !data || data.length > 200 || data === clean(label)) return;
    const previous = results.get(key) ?? [];
    if (!previous.includes(data)) results.set(key, [...previous, data]);
  };
  root.find("dt").each((_, element) => {
    const node = $(element);
    if (node.next().is("dd")) add(node.text(), node.next().text());
  });
  root.find("tr").each((_, element) => {
    const cells = $(element).children("th, td");
    if (cells.length === 2) add(cells.eq(0).text(), cells.eq(1).text(), $(element).closest("table.woocommerce-product-attributes").length > 0);
  });
  root.find("li").each((_, element) => {
    const children = $(element).children("span, strong, b");
    if (children.length === 2 && $(element).children().length === 2) add(children.eq(0).text(), children.eq(1).text());
  });
  return results;
};

const firstUnambiguous = (values: Values, labels: readonly string[]): string | null => {
  const distinct = new Set(labels.flatMap((label) => values.get(normalizedLabel(label)) ?? []));
  return distinct.size === 1 ? [...distinct][0] ?? null : null;
};

const referenceCandidates = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>, values: Values): readonly string[] => {
  const refs = [...(values.get("sku") ?? []), ...(values.get("referencia") ?? [])];
  root.find(".sku_wrapper .sku, .product_meta .sku, [itemprop='sku'], .summary [data-sku]").each((_, element) => {
    const node = $(element);
    const value = clean(node.attr("content") ?? node.attr("data-sku") ?? node.text());
    if (value) refs.push(value);
  });
  root.find(".sku_wrapper, .product_meta").each((_, element) => {
    const text = clean($(element).text());
    const match = /(?:^|\s)(?:SKU|Referencia)\s*:\s*(.+?)(?=\s+(?:Categor[ií]as?|Etiquetas?|Tags?)\s*:|$)/i.exec(text);
    if (match?.[1]) refs.push(clean(match[1]));
  });
  return [...new Set(refs.filter((value) => value.length <= 90 && /[\p{L}\d]/u.test(value) && !/^(?:consultar|n\/a|sin referencia|no disponible)$/i.test(value)))];
};

const descriptionFrom = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>, selectors: readonly string[]): string | null => {
  for (const selector of selectors) {
    const node = root.find(selector).first();
    if (node.length) {
      const value = clean(node.text());
      if (value && value.length <= 12000) return value;
    }
  }
  return null;
};

const conditionOf = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>, values: Values): "Nuevo" | "Segunda mano" | null => {
  const candidates = [
    ...(values.get("estado") ?? []), ...(values.get("condicion") ?? []), ...(values.get("nueva o usada") ?? []),
    ...root.find("[itemprop='itemCondition'], .product-condition, .condition-badge").toArray().map((element) =>
      clean($(element).attr("content") ?? $(element).attr("href") ?? $(element).text())
    )
  ];
  const newItem = candidates.some((item) => /^(?:nuev[oa]|new|nueva maquina|https?:\/\/schema\.org\/NewCondition)$/i.test(item));
  const usedItem = candidates.some((item) => /^(?:usad[oa]|ocasi[oó]n|segunda mano|semi[- ]?nuev[oa]|https?:\/\/schema\.org\/UsedCondition)$/i.test(item));
  return newItem === usedItem ? null : newItem ? "Nuevo" : "Segunda mano";
};

const imagesFrom = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>, pageUrl: string): readonly string[] => {
  const galleryItems = root.find(".woocommerce-product-gallery__wrapper .woocommerce-product-gallery__image");
  const sources: string[] = [];
  if (galleryItems.length) {
    galleryItems.each((_, element) => {
      const item = $(element);
      const candidate = item.find("img[data-large_image]").first().attr("data-large_image") ??
        item.find("a[href]").first().attr("href") ?? item.find("img[data-src]").first().attr("data-src");
      if (candidate) sources.push(candidate);
    });
  } else {
    const gallerySelectors = [".woocommerce-product-gallery", ".product-gallery", ".product-images", ".product__gallery"];
    const gallery = gallerySelectors.find((selector) => root.find(selector).length > 0);
    if (!gallery) return [];
    const isolated = cheerio.load(`<main>${root.find(gallery).first().toString()}</main>`);
    sources.push(...collectProductImages(isolated, pageUrl, ["main"]));
  }
  const grouped = new Map<string, { readonly url: string; readonly rank: number }>();
  for (const candidate of sources) {
    let url: URL;
    try { url = new URL(candidate, pageUrl); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || !/\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname) ||
      /(?:placeholder|no-image|aspect_ratio|logo|sprite)/i.test(url.pathname)) continue;
    const image = identifyWordPressImage(url.toString());
    const previous = grouped.get(image.identity);
    if (!previous || image.rank > previous.rank) grouped.set(image.identity, { url: url.toString(), rank: image.rank });
  }
  return [...grouped.values()].map((item) => item.url);
};

const technicalSheetFrom = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>, pageUrl: string): string | null => {
  const candidates = new Set<string>();
  root.find("a[href]").each((_, element) => {
    const link = $(element);
    const href = link.attr("href");
    if (typeof href !== "string" || !/(?:ficha\s*t[eé]cnica|technical\s*(?:sheet|specification))/i.test(clean(link.text()))) return;
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol === "https:" && (/\.pdf$/i.test(url.pathname) ||
        (url.hostname === "manain.com" && url.pathname.startsWith("/ficha-tecnica/")))) candidates.add(url.toString());
    } catch { return; }
  });
  return candidates.size === 1 ? [...candidates][0] ?? null : null;
};

const publishedPrice = ($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>): { readonly price: string | null; readonly priceText: string | null } => {
  const values: string[] = root.find(".summary .price, .entry-summary .price, p.price, .detalles-producto .price, .detalles-producto a.showlogin").toArray()
    .map((element) => clean($(element).text())).filter(Boolean);
  if (values.length === 0) return { price: null, priceText: null };
  const unique = [...new Set(values)];
  if (unique.length !== 1) return { price: null, priceText: null };
  const text = unique[0] ?? "";
  return { price: /\d[\d.,\s]*\s*(?:€|EUR)(?!\w)/i.test(text) ? text : null, priceText: text };
};

export const parseManainProduct = (html: string, pageUrl: string): ParsedProduct => {
  if (!normalizeManainSaleProductUrl(pageUrl, "https://manain.com/")) {
    throw new Error(`Manain: URL de ficha de venta inválida: ${pageUrl}`);
  }
  const $ = cheerio.load(html);
  const root = rootOf($);
  root.find(excluded).remove();
  const title = clean(root.find("h1, .detalles-producto h2.raven-product-title, h2.raven-product-title").first().text());
  if (!title) throw new Error(`Manain: ficha sin título: ${pageUrl}`);
  const values = collectValues($, root);
  const refs = referenceCandidates($, root, values);
  if (refs.length > 1) throw new Error(`Manain: referencias contradictorias en la ficha: ${pageUrl}`);
  const yearText = firstUnambiguous(values, ["Año", "Año de fabricación"]);
  const year = yearText && /^(?:19|20)\d{2}$/.test(yearText) ? yearText : null;
  const horometerText = firstUnambiguous(values, ["Horas", "Horas de trabajo", "Horas laborales", "Horómetro"]);
  const horometer = horometerText && /^\d[\d.,\s]*\s*(?:h|horas?)?$/i.test(horometerText) ? horometerText : null;
  const specs: Record<string, SpecsMap[string]> = {};
  for (const [label, alternatives] of values) {
    const canonical = canonicalLabels[label] ?? `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
    if (alternatives.length) specs[canonical] = alternatives.length === 1 ? alternatives[0] ?? "" : alternatives;
  }
  const images = imagesFrom($, root, pageUrl);
  const price = publishedPrice($, root);
  return {
    title,
    reference: refs[0] ?? null,
    brand: firstUnambiguous(values, ["Marca"]),
    model: firstUnambiguous(values, ["Modelo"]),
    year,
    yearSource: year ? "ficha" : null,
    horometer,
    condition: conditionOf($, root, values),
    serialNumber: firstUnambiguous(values, ["Número de serie", "Nº de serie", "Serie"]),
    shortDescription: descriptionFrom($, root, [".woocommerce-product-details__short-description", ".product-short-description"]),
    longDescription: descriptionFrom($, root, [".woocommerce-Tabs-panel--description", "#tab-description", ".product-description"]),
    price: price.price,
    priceText: price.priceText,
    technicalSheetUrl: technicalSheetFrom($, root, pageUrl),
    location: null,
    country: null,
    image: images[0] ?? null,
    images,
    specs
  };
};
