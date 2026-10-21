import * as cheerio from "cheerio";
import type { SpecsMap } from "../../../contracts/catalog.js";
import { collectProductImages } from "../../parsing/image-gallery.js";
import { extractGamGallery } from "./gallery.js";
import { distinguishDescriptions } from "../../../catalog/normalization/descriptions.js";
import { extractGamPrice } from "./price.js";
import { extractLongDescription, extractShortDescription } from "./descriptions.js";
import { extractSpecs, extractExplicitTechnicalSpecs } from "./specifications.js";
import { extractTitle, extractYear, extractBreadcrumbs, extractExternalReference, extractHtmlDescription, extractPdf, pickDtDd } from "./product-fields.js";

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
