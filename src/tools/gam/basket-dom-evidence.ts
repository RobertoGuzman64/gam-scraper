import * as cheerio from "cheerio";
import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import { basketDimensions, fold } from "../../catalog/import/mapping/attribute-utils.js";
import { gamBasketDimensionsFromDescription, gamBasketDimensionsFromRepeatedFragments } from "../../catalog/import/mapping/providers/gam/basket.js";
import { extractSpecs } from "../../scraping/providers/gam/specifications.js";
import { normalizeSpace } from "../../scraping/providers/gam/text.js";
import { unrelatedDetails } from "../../scraping/providers/gam/selectors.js";

type FieldPart = {
  readonly tag: string;
  readonly text: string;
  readonly html: string;
};

type FieldEvidence = {
  readonly location: "definition" | "table" | "product-feature";
  readonly rawText: string;
  readonly rawHtml: string;
  readonly parts: readonly FieldPart[];
};

export type BasketDomEvidence = {
  readonly extractedValue: SpecValue | null;
  readonly fields: readonly FieldEvidence[];
};

export const pendingGamBasketRecords = (products: readonly ProductRecord[]): readonly ProductRecord[] => products.filter((record) => {
  if (record.providerId !== "gam" || !record.reference) return false;
  const raw = record.specs?.["Dimensiones Cesta"];
  return typeof raw === "string" && basketDimensions(raw) === null &&
    gamBasketDimensionsFromDescription(record, raw) === null && gamBasketDimensionsFromRepeatedFragments(raw) === null;
});

export const inspectGamBasketDom = (html: string): BasketDomEvidence => {
  const $ = cheerio.load(html);
  const fields: FieldEvidence[] = [];
  const append = (location: FieldEvidence["location"], node: ReturnType<typeof $>): void => {
    const parts: FieldPart[] = [];
    node.find("*").each((_, element) => {
      const item = $(element);
      if (item.children().length !== 0 || item.is("script, style")) return;
      const text = normalizeSpace(item.text());
      if (text) parts.push({ tag: element.tagName, text, html: $.html(element) });
    });
    fields.push({ location, rawText: normalizeSpace(node.text()), rawHtml: $.html(node), parts });
  };

  $("dl dt").each((_, element) => {
    const term = $(element);
    if (term.closest(unrelatedDetails).length || fold(term.text()) !== "dimensiones cesta") return;
    const definition = term.next();
    if (definition.is("dd")) append("definition", definition);
  });

  $("table tr").each((_, element) => {
    const row = $(element);
    if (row.closest(unrelatedDetails).length) return;
    const cells = row.children("th, td");
    if (cells.length === 2 && fold($(cells[0]).text()) === "dimensiones cesta") {
      append("table", $(cells[1]));
    }
  });

  $(".product-features .data-sheet li, .product-features .product-feature").each((_, element) => {
    const feature = $(element);
    if (feature.closest(unrelatedDetails).length) return;
    const name = feature.find(".name, .feature-name, strong").first().text();
    if (fold(name) !== "dimensiones cesta") return;
    const value = feature.find(".value, .feature-value").first();
    if (value.length) append("product-feature", value);
  });

  return { extractedValue: extractSpecs($)["Dimensiones Cesta"] ?? null, fields };
};
