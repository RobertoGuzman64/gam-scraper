import type { SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import { fold, normalizeSpace } from "./text.js";

const expressions: readonly { readonly key: string; readonly pattern: RegExp }[] = [
  { key: "Altura de trabajo", pattern: /\baltura\s+(?:m[aá]xima\s+)?de\s+trabajo\s*[:：]\s*(\d+(?:[.,]\d+)?\s*(?:m|metros?|mm))\b/gi },
  { key: "Altura de elevación", pattern: /\baltura\s+de\s+elevaci[oó]n\s*[:：]\s*(\d+(?:[.,]\d+)?\s*(?:m|metros?|mm))\b/gi },
  { key: "Tipo de mástil", pattern: /\btipo\s+de\s+m[aá]stil\s*[:：]\s*(simple|d[uú]plex|tr[ií]plex|cu[aá]druplex)\b/gi },
  { key: "Dimensiones Cesta", pattern: /\b(?:dimensiones\s+(?:de\s+la\s+)?cesta|medidas\s+de\s+la\s+cesta)\s*[:：]\s*(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(?:mm|cm|metros?|m))(?=\s*(?:[.;]|$))/gi },
  { key: "Rotación de torreta", pattern: /\brotaci[oó]n\s+(?:de\s+(?:la\s+)?)?torreta\s*[:：]\s*(\d+(?:[.,]\d+)?\s*[º°])(?=\s*(?:[.;]|$))/gi }
];

export const extractExplicitTechnicalSpecValues = (text: string): SpecsMap => {
  const found: Record<string, SpecValue> = {};
  for (const { key, pattern } of expressions) {
    const matches = [...text.matchAll(pattern)].map((match) => normalizeSpace(match[1] ?? ""));
    if (matches.length && matches.every((value) => fold(value) === fold(matches[0] ?? ""))) {
      found[key] = matches[0]!;
    }
  }
  return found;
};
