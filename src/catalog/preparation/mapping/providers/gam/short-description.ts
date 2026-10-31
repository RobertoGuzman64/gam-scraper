import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { resolveGamGeneralDescription } from "./general-description.js";

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const wordCount = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;

const numericTokens = (value: string): ReadonlySet<string> =>
  new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);

const ownIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || !record.reference || !record.title ||
    !record.shortDescription) return false;

  const model = normalize(record.model ?? "");
  const brand = normalize(record.brand ?? "");
  const title = normalize(record.title);
  const short = normalize(record.shortDescription);
  if (model && (!title.includes(model) || !short.includes(model))) return false;
  if (brand && (!title.includes(brand) || !short.includes(brand))) return false;
  if (record.externalReference && record.model &&
    normalize(record.externalReference) !== model) return false;

  const specModel = record.specs?.Modelo;
  const specBrand = record.specs?.Marca;
  if (specModel !== undefined && (typeof specModel !== "string" ||
    !model || normalize(specModel) !== model)) return false;
  if (specBrand !== undefined && (typeof specBrand !== "string" ||
    !brand || normalize(specBrand) !== brand)) return false;

  try {
    const url = new URL(record.url);
    const slug = url.pathname.split("/").at(-1) ?? "";
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      slug.startsWith(`${record.reference}-`) && !url.search && !url.hash &&
      (!model || normalize(slug).includes(model));
  } catch {
    return false;
  }
};

const missingFacts = (original: string, summary: string, general: string): boolean => {
  const retained = `${summary} ${general}`;
  const remaining = original.slice(summary.length);
  const keptNumbers = numericTokens(retained);
  if ([...numericTokens(remaining)].some((value) => !keptNumbers.has(value))) return true;

  const keywords = /\b(?:el[eé]ctric[oa]s?|di[eé]sel|glp|gasolina|h[ií]brid[oa]s?|litio|hepa|hidr[aá]ulic[oa]s?)\b/giu;
  const kept = normalize(retained);
  return [...remaining.matchAll(keywords)].some((match) => !kept.includes(normalize(match[0])));
};

const conciseLongShort = (record: ProductRecord): string | null => {
  const original = record.shortDescription?.trim();
  const general = record.longDescription?.trim();
  if (!original || !general || wordCount(original) <= 45 || !ownIdentity(record)) return null;

  const sentences = original.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u);
  if (sentences.length < 2) return null;
  const first = sentences[0]?.trim();
  if (!first || wordCount(first) < 12 || wordCount(first) > 45) return null;

  const second = sentences[1]?.trim();
  const summary = wordCount(original) >= 75 && wordCount(first) <= 25 ? first :
    second && wordCount(`${first} ${second}`) <= 45 ? `${first} ${second}` : first;
  const normalizedSummary = normalize(summary);
  if (record.model && !normalizedSummary.includes(normalize(record.model))) return null;
  if (record.brand && !normalizedSummary.includes(normalize(record.brand))) return null;
  if ([...numericTokens(summary)].some((value) => !numericTokens(general).has(value)) ||
    missingFacts(original, summary, general)) return null;

  return summary;
};

const conciseCompactTranspaleta = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !record.title || !record.brand || !record.model || !record.reference ||
    !/transpaleta/iu.test(record.title) ||
    normalize(record.title).includes(normalize(record.brand)) === false ||
    normalize(record.title).includes(normalize(record.model)) === false ||
    (typeof record.specs?.Marca !== "string" || normalize(record.specs.Marca) !== normalize(record.brand)) ||
    (typeof record.specs?.Modelo !== "string" || normalize(record.specs.Modelo) !== normalize(record.model))) return null;

  try {
    const url = new URL(record.url);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.pathname.split("/")[2] !== "transpaletas-yale" ||
      !url.pathname.split("/").at(-1)?.startsWith(`${record.reference}-`) ||
      !normalize(url.pathname.split("/").at(-1) ?? "").includes(normalize(record.model)) ||
      url.search || url.hash) return null;
  } catch {
    return null;
  }

  const original = record.shortDescription?.trim();
  const general = record.longDescription?.trim();
  if (!original || !general || wordCount(original) < 40 || wordCount(original) > 45 ||
    wordCount(general) < 150 || !/transpaleta motorizada/iu.test(original)) return null;
  const summary = original.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u)[0]?.trim();
  const match = summary ? /^Transpaleta S[uú]per Compacta con transporte f[aá]cil de cargas de hasta (\d{1,2}(?:[.,]\d{1,2})?) toneladas? Transpaleta motorizada s[uú]per compacta de operario a pie que ofrece una maniobrabilidad excelente en espacios confinados\.$/iu.exec(summary) : null;
  const capacity = record.specs?.["Capacidad de carga (kg)"];
  const capacityMatch = typeof capacity === "string" ? /^(\d{3,5}) KG$/u.exec(capacity) : null;
  if (!match?.[1] || !capacityMatch?.[1] ||
    Math.round(Number(match[1].replace(",", ".")) * 1000) !== Number(capacityMatch[1])) return null;
  const concise = `La transpaleta ${record.brand} ${record.model} es motorizada y compacta, de operario a pie, ` +
    `para transportar cargas de hasta ${match[1]} toneladas y maniobrar en espacios confinados.`;
  const missingNumbers = [...numericTokens(original)].some((number) =>
    !numericTokens(`${concise} ${general}`).has(number));
  return missingNumbers ? null : concise;
};

const conciseModule = (record: ProductRecord): string | null => {
  if (!record.title || record.shortDescription?.trim() !== record.title.trim() ||
    wordCount(record.title) >= 10) return null;
  const height = record.specs?.Altura;
  const heightMm = typeof height === "string" && /^(\d+) mm$/u.test(height)
    ? Number(height.split(" ")[0]) : null;
  if (heightMm === null || heightMm < 1800 || heightMm > 4000) return null;
  const general = resolveGamGeneralDescription(record);
  if (!general || !/^El m[oó]dulo de ba[nñ]o /iu.test(general)) return null;
  const first = general.split(/(?<=[.!?])\s+/u)[0]?.trim();
  return first && wordCount(first) <= 45 ? first : null;
};

export const resolveGamShortDescription = (record: ProductRecord): string | null =>
  record.providerId === "gam" ? conciseModule(record) ?? conciseCompactTranspaleta(record) ?? conciseLongShort(record) : null;

const rebalancedIdentity = (record: ProductRecord): boolean => {
  if (!record.title || !record.reference) return false;
  const typed = Boolean(record.model && record.brand &&
    typeof record.specs?.Marca === "string" && normalize(record.specs.Marca) === normalize(record.brand) &&
    typeof record.specs?.Modelo === "string" && normalize(record.specs.Modelo) === normalize(record.model));
  const noTechnicalIdentity = record.categoryKey === "maquinaria" &&
    record.condition === "Segunda mano" && !record.model && !record.brand &&
    Object.keys(record.specs ?? {}).length === 0;
  if (!typed && !noTechnicalIdentity) return false;
  if (typed && (!normalize(record.title).includes(normalize(record.brand ?? "")) ||
    !normalize(record.title).includes(normalize(record.model ?? "")))) return false;
  if (record.externalReference && !/^INQ-\d+$/iu.test(record.externalReference) &&
    normalize(record.externalReference) !== normalize(record.model ?? "")) return false;
  try {
    const url = new URL(record.url);
    const slug = url.pathname.split("/").at(-1) ?? "";
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      slug.startsWith(`${record.reference}-`) &&
      normalize(slug).includes(normalize(typed ? record.model ?? "" : record.title)) &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
};

export type RebalancedGamDescriptions = {
  readonly short: string;
  readonly general: string;
};

export const rebalanceGamOverlongShort = (record: ProductRecord, preparedGeneral: string | null): RebalancedGamDescriptions | null => {
  const short = record.shortDescription?.trim();
  const general = preparedGeneral?.trim();
  if (record.providerId !== "gam" || !short || !general ||
    wordCount(short) <= 45 || wordCount(general) < 60 ||
    !(/[.!?]$/u.test(short) || record.categoryKey === "maquinaria" && /zonas de bajas emisiones$/iu.test(short)) ||
    !record.title || !record.reference || !rebalancedIdentity(record)) return null;

  const sentences = short.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u).map((part) => part.trim());
  const first = sentences[0];
  if (!first || wordCount(first) < 12 || wordCount(first) > 45 ||
    (record.brand && !normalize(first).includes(normalize(record.brand))) ||
    (record.model && !normalize(first).includes(normalize(record.model)))) return null;

  const isUsedMobility = record.categoryKey === "maquinaria" &&
    record.condition === "Segunda mano" && sentences.length === 2 &&
    normalize(first).includes(normalize(record.title));
  const trailer = record.condition === "Nuevo" && record.categoryKey === "marcas-nuevas" &&
    sentences.length === 2 && /^Remolque Tecnacar /iu.test(first) &&
    record.longDescription?.trim() !== general &&
    /plataforma doble de elevaci[oó]n hidr[aá]ulica/iu.test(general) &&
    /sistema de tipo madre-hija/iu.test(general) &&
    [...numericTokens(short)].every((number) => numericTokens(`${first} ${general}`).has(number));
  if (trailer) return { short: first, general };
  if (!isUsedMobility) return null;

  const remainder = sentences.slice(1).filter((sentence) => !general.includes(sentence));
  if (remainder.length === 0) return { short: first, general };
  const moved = remainder.join(" ");
  const merged = `${/[.!?]$/u.test(moved) ? moved : `${moved}.`}\n\n${general}`;
  if (wordCount(merged) > 800) return null;
  const combined = `${first} ${merged}`;
  if ([...numericTokens(short)].some((number) => !numericTokens(combined).has(number))) return null;
  return { short: first, general: merged };
};


export const resolveGamResidualConciseShort = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  const original = record.shortDescription?.trim();
  const general = preparedGeneral?.trim();
  const title = record.title?.trim();
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (record.providerId !== "gam" || !record.reference || !original || !general ||
    !title || !brand || !model || wordCount(original) <= 45 || wordCount(general) < 60 ||
    !normalize(title).includes(normalize(model)) ||
    (!normalize(title).includes(normalize(brand)) && !normalize(original).includes(normalize(brand))) ||
    !normalize(general).includes(normalize(model)) ||
    (record.specs?.Marca !== undefined && (typeof record.specs.Marca !== "string" || normalize(record.specs.Marca) !== normalize(brand))) ||
    (record.specs?.Modelo !== undefined && (typeof record.specs.Modelo !== "string" || normalize(record.specs.Modelo) !== normalize(model))) ||
    (normalize(brand) === "yale" && /\bhyster\b/iu.test(`${original} ${general}`)) ||
    (normalize(brand) === "hyster" && /\byale\b/iu.test(`${original} ${general}`)) ||
    (record.categoryKey === "carretillas-nuevas" && /plataformas? elevadoras?/iu.test(title))) return null;

  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts.at(-1) ?? "";
    const family = parts[1] ?? "";
    const verifiedFamily = /^(?:apiladores-yale|transpaletas-yale|tennant)$/u.test(family);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      !slug.startsWith(`${record.reference}-`) ||
      (!normalize(slug).includes(normalize(model)) &&
        !(verifiedFamily && normalize(original).includes(normalize(model)) &&
          normalize(general).includes(normalize(model)))) ||
      url.search || url.hash) return null;
  } catch {
    return null;
  }

  const firstSentence = (text: string): string | null => {
    const match = /^(.*?[.!?])(?:\s|$)/u.exec(text);
    return match?.[1]?.trim() ?? null;
  };
  const preferred = general.startsWith("Cambio de titularidad y transporte no incluidos ") ?
    firstSentence(original) : firstSentence(general);
  if (!preferred || wordCount(preferred) < 12 || wordCount(preferred) > 40 ||
    (!normalize(preferred).includes(normalize(model)) &&
      !normalize(original).includes(normalize(model)))) return null;

  const concise = normalize(preferred).includes(normalize(brand)) &&
    normalize(preferred).includes(normalize(model)) ? preferred : `${title}. ${preferred}`;
  if (wordCount(concise) > 45 ||
    [...numericTokens(original)].some((value) => !numericTokens(`${concise} ${general}`).has(value))) return null;
  return concise;
};
