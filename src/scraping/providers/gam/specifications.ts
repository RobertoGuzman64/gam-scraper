import * as cheerio from "cheerio";
import type { SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import { normalizeSpace, fold } from "./text.js";
import { unrelatedDetails } from "./selectors.js";

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

export const extractSpecs = ($: cheerio.CheerioAPI): SpecsMap => {
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

export const extractExplicitTechnicalSpecs = ($: cheerio.CheerioAPI): SpecsMap => {
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

