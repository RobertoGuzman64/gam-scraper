import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { fold } from "../classification/category-utils.js";
import { basketDimensions } from "../classification/attribute-utils.js";
import { hasUnconditionalEditorialClaim } from "../editorial/claims/editorial-claim-evidence.js";
import { sameEditorialUnit } from "../editorial/core/editorial-source-contract.js";
import { editorialFamilyOf } from "../editorial/core/editorial-families.js";
import { resolveEditorialSource } from "../editorial/core/editorial-source.js";
import { containsEditorialBrandModel } from "../editorial/identity/editorial-identity-match.js";
import { containsEditorialSourceSlugModel } from "../editorial/source/editorial-source-url.js";
import { resolvedEditorialUnitFamilies } from "../editorial/identity/editorial-unit-provenance.js";
import { editorialMetricOf, editorialQuantity, formatEditorialQuantity } from "../editorial/measurements/editorial-measurements.js";
import type { TechnicalRecoveryObservation } from "../provenance/technical-recovery-observation.js";

const number = String.raw`(?:\d{1,3}(?:[. ]\d{3})+|\d+(?:[.,]\d{1,3})?)`;
const measure = String.raw`(${number})\s*(mm|m|metros?)\b`;
const basketNumber = String.raw`\d+(?:[.,]\d{1,3})?`;
const basketMeasure = String.raw`${basketNumber}\s*[x×]\s*${basketNumber}(?:\s*[x×]\s*${basketNumber})?\s*(?:mm|cm|m|metros?)`;
const basketSubject = String.raw`\bcesta(?:\s+(?:de\s+(?:trabajo|fibra|aluminio)))*`;
const basketPattern = new RegExp(String.raw`(?:${basketSubject}\s*,?\s+(?:de|con dimensiones de)\s+|${basketSubject}\s+(?:admite|ofrece|dispone de)\s+una capacidad(?: máxima)? de\s+${number}\s*kg\s+y\s+(?:tiene\s+)?unas dimensiones de\s+|${basketSubject}(?:\s+antideslizante)?\s*\(\s*)(${basketMeasure})\b`, "giu");
const platformPattern = new RegExp(String.raw`\bplataforma(?:\s+principal)?\s+presenta\s+(?:unas\s+)?dimensiones\s+de\s+${measure}\s+de\s+longitud\s+y\s+${measure}\s+de\s+anchura\b`, "giu");
const confirmedExtensionPattern = new RegExp(String.raw`\bplataforma extensible de\s+${measure}\s*,?\s*(?:diseñada para|permite)\s+ampliar\b`, "giu");
const extensionPattern = new RegExp(String.raw`\b(?:plataforma extensible de|extensi[oó]n de (?:la\s+)?plataforma(?:\s+de)?)\s+${measure}`, "giu");

const metric = (raw: string | undefined, unit: string | undefined): number | null => {
  if (!raw || !unit) return null;
  const millimetres = unit.toLowerCase() === "mm";
  const value = editorialQuantity(`${raw} ${unit}`, millimetres ? "mm" : "m");
  return value === null ? null : millimetres ? value / 1000 : value;
};

const consistentClaim = <T>(text: string, pattern: RegExp, parse: (match: RegExpMatchArray) => T | null): T | null => {
  const matches = [...text.matchAll(pattern)];
  if (!matches.length || !hasUnconditionalEditorialClaim(text, pattern)) return null;
  for (const match of matches) {
    const start = match.index ?? 0;
    const prefix = text.slice(Math.max(0, start - 100), start).split(/(?<!\d)[.!?;\n]|[.!?;\n](?!\d)|,\s+|\s+y\s+(?:un|una|su)\s+/u).at(-1) ?? "";
    const suffix = text.slice(start + match[0].length, start + match[0].length + 100).replace(/^\s*\)/u, "");
    if (/\b(?:no|sin|aproximad[oa]|aproximadamente|entre|seg[uú]n|alternativ[ao]|dependiendo)\b/iu.test(prefix) ||
      /^(?:\s*[/–-]\s*|\s*,?\s+(?:o|u|y|hasta)\s+(?:otr[oa]\s+)?(?:de\s+)?)\d|^\s*[,;(]?\s*(?:seg[uú]n|dependiendo|aproximadamente|opcional)/iu.test(suffix)) return null;
  }
  const values = matches.map(parse);
  const first = values[0];
  return first != null && values.every((value) => value !== null && JSON.stringify(value) === JSON.stringify(first)) ? first : null;
};

const dimensions = (raw: string | undefined): string | null => {
  const millimetres = raw?.match(/^(.*?)\s+mm$/iu);
  const normalized = millimetres?.[1] ? `${millimetres[1].split(/\s*[x×]\s*/u).map((part) =>
    /^\d{1,3}\.\d{3}$/u.test(part) ? part.replace(".", "") : part).join(" x ")} mm` : raw;
  const result = normalized ? basketDimensions(normalized) : null;
  if (!result) return null;
  const values = result.slice(0, -2).split(" x ").map((value) => Number(value.replace(",", ".")));
  return values.length >= 2 && values.every((value, index) => value >= 0.4 && value <= (index === 0 ? 12 : index === 1 ? 6 : 3)) ? result : null;
};

const explicitlyTruckMounted = (record: ProductRecord): boolean => {
  const mounted = /\bplataforma(?:\s+(?:aerea|elevadora|articulada|telescopica)){0,3}\s+sobre\s+camion\b/u;
  return fold(record.title ?? "").startsWith("plataforma ") && mounted.test(fold(record.title ?? "")) &&
    mounted.test(fold(new URL(record.url).pathname.replace(/-/gu, " "))) &&
    mounted.test(fold(record.longDescription ?? ""));
};

const declaredMetres = (value: number): string => `${formatEditorialQuantity(value)} m`;

export const recoverSourcePlatformGeometry = (
  original: ProductRecord, recovered: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): SpecsMap => {
  const text = original.longDescription;
  const identity = resolveEditorialSource(original);
  const families = resolvedEditorialUnitFamilies(original, recovered);
  if (!text || text !== recovered.longDescription || !sameEditorialUnit(original, recovered) ||
    original.providerId !== recovered.providerId || !identity || !families || families[0] !== families[1] ||
    !containsEditorialSourceSlugModel(new URL(original.url).pathname.split("/").filter(Boolean).at(-1) ?? "", identity.model, original.specs?.Motor) ||
    !containsEditorialBrandModel(text, identity.brand, identity.model) ||
    original.shortDescription?.trim() && !containsEditorialBrandModel(original.shortDescription, identity.brand, identity.model)) return specs;
  const claim = <T>(pattern: RegExp, parse: (match: RegExpMatchArray) => T | null): T | null => {
    const value = consistentClaim(text, pattern, parse);
    const short = original.shortDescription ?? "";
    if (value === null || [...short.matchAll(pattern)].length && JSON.stringify(consistentClaim(short, pattern, parse)) !== JSON.stringify(value)) return null;
    return value;
  };
  const urlFamily = editorialFamilyOf(new URL(original.url).pathname);
  if (urlFamily && !urlFamily.startsWith("plataforma-") && urlFamily !== "camion-cesta") return specs;
  const family = families[0] ?? (explicitlyTruckMounted(original) && explicitlyTruckMounted(recovered) ? "camion-cesta" : null);
  if (!family || (!family.startsWith("plataforma-") && family !== "camion-cesta")) return specs;
  const absent = (pattern: RegExp): boolean => ![...Object.keys(original.specs ?? {}), ...Object.keys(specs)].some((key) => pattern.test(key));
  const additions: Record<string, string> = {};
  const fitsExterior = (length: number, width: number): boolean => {
    const exteriorLength = editorialMetricOf(specs, ["Longitud", "Longitud total", "Largo", "Longitud (mm)"]);
    const exteriorWidth = editorialMetricOf(specs, ["Anchura", "Ancho", "Anchura total", "Anchura (mm)"]);
    return (exteriorLength === null || length <= exteriorLength) && (exteriorWidth === null || width <= exteriorWidth);
  };
  if (absent(/(?:dimensiones|medidas|longitud|anchura|ancho|alto)\s+(?:de\s+)?(?:la\s+)?(?:cesta|plataforma)\b/iu)) {
    const basket = claim(basketPattern, (match) => {
      const capacity = new RegExp(String.raw`\bcapacidad(?: máxima)? de\s+(${number})\s*kg\b`, "iu").exec(match[0]);
      if (capacity && identity.loadCapacity !== undefined &&
        editorialQuantity(`${capacity[1]} kg`, "kg") !== editorialQuantity(identity.loadCapacity, "kg")) return null;
      if (match[0].includes("(") && !/^\s*\)/u.test((match.input ?? "").slice((match.index ?? 0) + match[0].length))) return null;
      return dimensions(match[1]);
    });
    if (basket !== null) {
      const [length, width] = basket.slice(0, -2).split(" x ").map((value) => Number(value.replace(",", ".")));
      if (family !== "plataforma-tijera" || length !== undefined && width !== undefined && fitsExterior(length, width)) additions["Dimensiones de cesta"] = basket;
    }
    else if (family === "plataforma-tijera" && ![...text.matchAll(basketPattern)].length) {
      const pair = claim(platformPattern, (match) => {
        const length = metric(match[1], match[2]);
        const width = metric(match[3], match[4]);
        return length !== null && width !== null && length >= 0.5 && length <= 12 && width >= 0.4 && width <= 6 ? [length, width] as const : null;
      });
      if (pair !== null) {
        if (fitsExterior(pair[0], pair[1])) {
          additions["Longitud de plataforma"] = declaredMetres(pair[0]);
          additions["Anchura de plataforma"] = declaredMetres(pair[1]);
        }
      }
    }
  }
  if (family === "plataforma-tijera" && absent(/extensi[oó]n|plataforma extensible/iu)) {
    const extension = claim(extensionPattern, (match) => metric(match[1], match[2]));
    const platformLength = editorialMetricOf({ ...specs, ...additions }, ["Longitud plataforma", "Longitud de plataforma"]);
    const explicitlyExtended = [...text.matchAll(extensionPattern)].some((match) => /^extensi[oó]n/iu.test(match[0])) ||
      consistentClaim(text, confirmedExtensionPattern, (match) => metric(match[1], match[2])) === extension;
    if (explicitlyExtended && extension !== null && platformLength !== null && extension >= 0.1 && extension <= Math.min(platformLength, 5)) {
      additions["Extensión de plataforma"] = declaredMetres(extension);
    }
  }
  if (!Object.keys(additions).length) return specs;
  const result = { ...specs, ...additions };
  observe?.(specs, result, "src/preparation/technical/platform-geometry-recovery.ts", "longDescription");
  return result;
};
