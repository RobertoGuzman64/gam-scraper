import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../../mapping/attribute-utils.js";
import { gamHandlingModelEvidence, relevantGamHandlingRecord } from "../../../mapping/providers/gam/handling.js";

const modelCapacity = (brand: string, model: string): number | null => {
  const patterns: readonly { brand: string; pattern: RegExp; multiplier: number }[] = [
    { brand: "hyster", pattern: /^(?:r|p|j)(\d\.\d)(?:utt|utl)?$/, multiplier: 1000 },
    { brand: "hyster", pattern: /^h(\d{1,2})(?:\.0ft|xd-12)$/, multiplier: 1000 },
    { brand: "yale", pattern: /^(?:erp\d{2}vll|erc\d{2}va|mp\d{2})$/, multiplier: 100 },
    { brand: "yale", pattern: /^gdp\d{3}ef12$/, multiplier: 100 }
  ];
  for (const entry of patterns) {
    if (brand !== entry.brand) continue;
    const matched = model.match(entry.pattern);
    if (!matched) continue;
    const part = matched[1] ?? model.match(/\d{2,3}/)?.[0];
    const numeric = part ? Number(part) : NaN;
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 320) return numeric * entry.multiplier;
  }
  return null;
};

const capacityReading = (value: string, unit: string): number | null => {
  const numeric = numberToken(value);
  if (numeric === null) return null;
  const mass = numeric * (unit === "t" || unit.startsWith("tonelada") ? 1000 : 1);
  return mass >= 50 && mass <= 100000 ? mass : null;
};

const singleMention = (text: string, pattern: RegExp): number | null => {
  const readings = new Set<number>();
  for (const match of fold(text).matchAll(pattern)) {
    if (!match[1] || !match[2]) continue;
    const value = capacityReading(match[1], match[2]);
    if (value === null) continue;
    const trailing = fold(text).slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 25);
    if (/^\s*(?:\/|-|(?:a|o|y)\b)\s*\d[\d.,]*\s*(?:kg|kilogramos?|toneladas?|t)\b/.test(trailing)) return null;
    readings.add(value);
  }
  return readings.size === 1 ? [...readings][0] ?? null : null;
};

const titlePattern = /\b(\d[\d.,]*)\s*(kg|kilogramos?)\b/g;
const descriptionPattern = /\b(?:capacidad\s+(?:(?:nominal\s+)?(?:de\s+)?carga|nominal)|cargas?)\s+(?:de\s+)?(?:hasta\s+)?(\d[\d.,]*)\s*(kg|kilogramos?|toneladas?|t)\b/g;

export const gamHandlingReconciledCapacity = (record: ProductRecord): number | null => {
  if (!relevantGamHandlingRecord(record)) return null;
  const brand = fold(record.brand ?? "");
  const model = fold(record.model ?? "");
  const sourceModel = fold(typeof record.specs?.["Modelo"] === "string" ? record.specs["Modelo"] : "");
  if (!model || model !== sourceModel ||
    ![record.title, record.shortDescription, record.longDescription].every((text) =>
      typeof text === "string" && gamHandlingModelEvidence(record, text))) return null;
  const expected = modelCapacity(brand, model);
  if (expected === null) return null;
  const raw = record.specs?.["Capacidad de carga (kg)"];
  if (typeof raw !== "string") return null;
  const specMatch = raw.trim().match(/^(\d[\d.,]*)\s*(kg|kilogramos?)$/i);
  const spec = specMatch?.[1] && specMatch[2] ? capacityReading(specMatch[1], fold(specMatch[2])) : null;
  if (spec === null) return null;
  const readings = [
    spec,
    singleMention(record.title ?? "", titlePattern),
    singleMention(record.shortDescription ?? "", descriptionPattern),
    singleMention(record.longDescription ?? "", descriptionPattern)
  ];
  const compatible = readings.filter((value) => value === expected).length;
  const contradictory = readings.filter((value) => value !== null && value !== expected).length;
  if (compatible < 2 || contradictory !== 1 ||
    (readings[0] !== expected && readings[3] !== expected && compatible < 3 &&
      !(brand === "yale" && /^erp\d{2}vll$/.test(model) && readings[1] === expected &&
        readings[2] === expected && readings[3] === null))) return null;
  return expected;
};
