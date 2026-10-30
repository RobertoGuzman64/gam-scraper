import type { ProductRecord } from "../../../contracts/catalog.js";
import { fold, numberToken } from "../mapping/attribute-utils.js";
import { verifiedGomarizPlatformHeight } from "../../normalization/providers/gomariz/technical.js";

const sourceHost = (record: ProductRecord, host: string): boolean => {
  try {
    const url = new URL(record.url);
    return url.protocol === "https:" && url.hostname === host && !url.search && !url.hash;
  } catch {
    return false;
  }
};

const sourceGomariz = (record: ProductRecord): boolean =>
  record.providerId === "gomariz" && record.categoryKey === "venta" &&
  (sourceHost(record, "www.gomarizrent.com") || sourceHost(record, "gomarizrent.com")) &&
  Boolean(record.reference?.trim());

const sourceMercaeleva = (record: ProductRecord): boolean => {
  if (record.providerId !== "mercaeleva" || !sourceHost(record, "sales.mercaeleva.com") ||
    !record.reference?.trim()) return false;
  const path = new URL(record.url).pathname;
  return /^\/(?:es|en)\/for-sale\/machine\/[^/]+\/?$/u.test(path) &&
    path.toLowerCase().endsWith(`-${record.reference.toLowerCase()}`);
};

const metres = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:[.,]\d{1,2})?)\s*m$/iu.exec(value.trim());
  const number = match?.[1] ? Number(match[1].replace(",", ".")) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
};

const gomarizIssues = (record: ProductRecord): readonly string[] => {
  if (!sourceGomariz(record)) return [];
  const issues: string[] = [];
  const platform = metres(record.specs?.["Altura plataforma"]);
  const working = metres(record.specs?.["Altura de trabajo"]);
  if (platform !== null && working !== null && platform > working &&
    verifiedGomarizPlatformHeight(record) === null) {
    issues.push("Alturas contradictorias: la altura de plataforma supera la altura de trabajo publicada");
  }
  const motor = record.specs?.Motor;
  const general = fold(record.longDescription ?? "");
  if (typeof motor === "string" && fold(motor) === "electrico" &&
    /^las articuladas diesel\b/u.test(general) &&
    /\/brazo-articulado(?:-boom-lift)?\//u.test(new URL(record.url).pathname)) {
    issues.push("Motorización contradictoria: la ficha técnica indica eléctrico y la descripción dice diésel");
  }
  return issues;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const mercaModelVersionConflict = (record: ProductRecord, general: string): boolean => {
  const model = fold(record.model ?? "");
  const match = /^(.+?)\s+(sii|siii|siv)$/u.exec(model);
  if (!match?.[1] || !match[2] || !record.brand?.trim()) return false;
  const brand = fold(record.brand);
  const fullModel = `${match[1]} ${match[2]}`;
  if (!fold(record.title ?? "").includes(`${brand} ${fullModel}`) ||
    fold(String(record.specs?.Modelo ?? "")) !== model) return false;
  const source = fold(new URL(record.url).pathname.replace(/[-_/]/gu, " "));
  if (!source.includes(`${brand} ${fullModel}`)) return false;
  const variant = new RegExp(`\\b${escapeRegex(`${brand} ${match[1]}`)}\\s+(sii|siii|siv)\\b`, "u").exec(general)?.[1];
  return variant !== undefined && variant !== match[2];
};

const mercaFamilyConflict = (record: ProductRecord, general: string): boolean => {
  const title = fold(record.title ?? "");
  const addition = fold(String(record.specs?.["Título adicional"] ?? ""));
  if (!/\bcarretilla\s+(?:elevadora\s+)?retractil\b/u.test(title) ||
    !/\bcarretilla\s+(?:elevadora\s+)?retractil\b/u.test(addition)) return false;
  return /\btranspalet(?:a)?\s+electric[oa]\b/u.test(general) &&
    !/\bcarretilla\s+(?:elevadora\s+)?retractil\b/u.test(general);
};

const kilograms = (text: string): number | null => {
  const values = [...text.matchAll(/(?<!\w)(\d{1,3}(?:[ .]\d{3})+|\d{3,5})\s*kg\b/giu)]
    .map((match) => match[1] ? numberToken(match[1]) : null)
    .filter((value): value is number => value !== null);
  return values.length === 1 ? values[0] ?? null : null;
};

const mercaCapacityConflict = (record: ProductRecord, general: string): boolean => {
  const additional = fold(String(record.specs?.["Título adicional"] ?? ""));
  const title = fold(record.title ?? "");
  const titleCapacity = kilograms(title);
  const addedCapacity = kilograms(additional);
  const describedCapacity = kilograms(general);
  return titleCapacity !== null && addedCapacity === titleCapacity && describedCapacity !== null &&
    titleCapacity !== describedCapacity;
};

const mercaelevaIssues = (record: ProductRecord): readonly string[] => {
  if (!sourceMercaeleva(record) || !record.brand?.trim() || !record.model?.trim() ||
    fold(String(record.specs?.Marca ?? "")) !== fold(record.brand) ||
    fold(String(record.specs?.Modelo ?? "")) !== fold(record.model)) return [];
  const general = fold(record.longDescription ?? "");
  if (!general) return [];
  const article = record.specs?.["Artículo No."];
  const describedArticle = /^ref\.\s*([\p{L}\d/-]+)/iu.exec(general)?.[1];
  if (typeof article !== "string" || !describedArticle || fold(article) !== fold(describedArticle)) return [];
  const issues: string[] = [];
  if (mercaModelVersionConflict(record, general)) {
    issues.push("Versión contradictoria: el modelo de la descripción no coincide con título y ficha técnica");
  }
  if (mercaFamilyConflict(record, general)) {
    issues.push("Familia contradictoria: el título indica carretilla retráctil y la descripción transpaleta");
  }
  if (mercaCapacityConflict(record, general)) {
    issues.push("Capacidad contradictoria: título y ficha técnica no coinciden con la descripción en kg");
  }
  return issues;
};

export const sourceSemanticQualityIssues = (record: ProductRecord): readonly string[] =>
  record.providerId === "gomariz" ? gomarizIssues(record) : mercaelevaIssues(record);
