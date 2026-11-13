import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { fold } from "../../classification/mapping/attribute-utils.js";

type SupportedUnitYear = Readonly<{ year: string; fromTitle: boolean }>;

const identity = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

const mentionsIdentity = (text: string, value: string): boolean => {
  const words = fold(value).split(/[\s.\-]+/u).filter(Boolean);
  if (words.length === 0) return false;
  const expression = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("[\\s.\\-]*");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${expression}(?=$|[^\\p{L}\\p{N}])`, "iu")
    .test(fold(text));
};

const verifiedUnit = (source: ProductRecord): boolean => {
  const specs = source.specs;
  if (source.categoryKey !== "manutencion" || source.condition !== "Segunda mano" ||
    !source.reference || !source.brand || !source.model || !source.serialNumber ||
    !source.title || !source.longDescription || !specs ||
    typeof specs.Marca !== "string" || typeof specs.Modelo !== "string" ||
    typeof specs["Nº de serie"] !== "string" ||
    specs["Nº de serie"] !== source.serialNumber) return false;
  const brand = identity(source.brand);
  const model = identity(source.model);
  if (!brand || !model || identity(specs.Marca) !== brand || identity(specs.Modelo) !== model) return false;
  return [source.title, source.longDescription].every((text) =>
    mentionsIdentity(text, source.brand ?? "") && mentionsIdentity(text, source.model ?? ""));
};

const verifiedYear = (source: ProductRecord, urlYear: string | null): SupportedUnitYear | null => {
  if (!urlYear || !/^(?:19|20)\d{2}$/u.test(urlYear) ||
    source.specs?.["Año de fabricación"] !== undefined && source.specs["Año de fabricación"] !== urlYear) {
    return null;
  }
  if (source.year === urlYear && source.yearSource === "url") return { year: urlYear, fromTitle: false };
  if (source.yearSource !== "titulo" || !source.year || source.year === urlYear || !source.image ||
    /\b(?:a[nñ]o|fabricad[ao])\s*(?:de\s+fabricaci[oó]n\s*)?[:–-]?\s*(?:19|20)\d{2}\b/iu.test(source.title ?? "")) return null;
  try {
    const image = new URL(source.image);
    if (image.protocol !== "https:" || image.hostname !== new URL(source.url).hostname) return null;
    const basename = decodeURIComponent(image.pathname.split("/").at(-1) ?? "");
    if (!basename.toLowerCase().endsWith(".jpg") ||
      !basename.startsWith(`${urlYear}-`) ||
      !mentionsIdentity(basename, source.brand ?? "") ||
      !mentionsIdentity(basename, source.model ?? "")) return null;
  } catch {
    return null;
  }
  return { year: urlYear, fromTitle: true };
};

const replaceManufacturingYear = (description: string, year: string): string => {
  const pattern = /\bfabricad[ao]\s+en(?:\s+el\s+a[nñ]o)?\s+((?:19|20)\d{2})\b/giu;
  const matches = [...description.matchAll(pattern)];
  const match = matches.length === 1 ? matches[0] : undefined;
  if (!match?.[0] || !match[1] || match.index === undefined || match[1] === year) return description;
  const replacement = match[0].replace(match[1], year);
  return `${description.slice(0, match.index)}${replacement}${description.slice(match.index + match[0].length)}`;
};

const liftingMetres = (specs: SpecsMap | undefined): number | null => {
  const fields = [specs?.["Altura de elevación (mm)"], specs?.["Altura de elevación (m)"]];
  const found = fields.flatMap((raw, index) => {
    if (typeof raw !== "string") return [];
    const match = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|m|metros?)\s*$/iu.exec(raw);
    if (!match?.[1] || !match[2] || (index === 0 ? match[2].toLowerCase() !== "mm" : match[2].toLowerCase() === "mm")) return [];
    const value = Number(match[1].replace(",", ".")) / (index === 0 ? 1000 : 1);
    return value >= 1 && value <= 25 ? [value] : [];
  });
  return found.length === 1 ? found[0] ?? null : null;
};

const normalizeLiftingHeight = (description: string, source: ProductRecord, urlYear: string | null): string => {
  const metres = liftingMetres(source.specs);
  if (metres === null) return description;
  const announced = /\baltura de elevaci[oó]n (?:de )?(\d+(?:[.,]\d+)?)\s*(?:m|metros?)\b/iu.exec(source.shortDescription ?? "");
  const summaryHeight = announced?.[1] === undefined ? null : Number(announced[1].replace(",", "."));
  const sourceVerified = source.yearSource === "url" && source.year === urlYear ||
    summaryHeight !== null && Math.abs(summaryHeight - metres) <= 0.01;
  if (!sourceVerified) return description;
  const pattern = /\baltura de elevaci[oó]n de\s+(\d+(?:[.,]\d+)?)\s+metros\b/giu;
  const matches = [...description.matchAll(pattern)];
  const match = matches.length === 1 ? matches[0] : undefined;
  if (!match?.[0] || !match[1] || match.index === undefined) return description;
  const sourceValue = Number(match[1].replace(",", "."));
  if (!Number.isFinite(sourceValue) || sourceValue < 1 || sourceValue > 25 || Math.abs(sourceValue - metres) <= 0.1) return description;
  const value = Number(metres.toFixed(3)).toString().replace(".", ",");
  let corrected = description.slice(0, match.index) + match[0].replace(match[1], value) +
    description.slice(match.index + match[0].length);
  const generic = /\baltura de\s+(\d+(?:[.,]\d+)?)\s+metros\b/giu;
  const others = [...corrected.matchAll(generic)];
  const other = others.length === 1 ? others[0] : undefined;
  if (other?.[0] && other[1] && other.index !== undefined &&
    Math.abs(Number(other[1].replace(",", ".")) - sourceValue) <= 0.01) {
    corrected = corrected.slice(0, other.index) + other[0].replace(other[1], value) +
      corrected.slice(other.index + other[0].length);
  }
  return corrected;
};

const normalizeCapacity = (description: string, source: ProductRecord): string => {
  const raw = source.specs?.["Capacidad de carga (kg)"];
  if (typeof raw !== "string") return description;
  const technical = /^\s*(\d{3,5})\s*kg\s*$/iu.exec(raw)?.[1];
  if (!technical || !new RegExp(`\\b${technical}\\s*kg\\b`, "iu").test(source.title ?? "") ||
    !new RegExp(`\\b${technical}\\s*kg\\b`, "iu").test(source.shortDescription ?? "")) return description;
  const pattern = /\bcapacidad de carga (?:indicada )?de\s+(\d{3,5})\s+kg\b/giu;
  const matches = [...description.matchAll(pattern)];
  const match = matches.length === 1 ? matches[0] : undefined;
  if (!match?.[0] || !match[1] || match.index === undefined || match[1] === technical) return description;
  return description.slice(0, match.index) + match[0].replace(match[1], technical) +
    description.slice(match.index + match[0].length);
};

export const reconcileCorroboratedUsedHandlingSource = (
  source: ProductRecord, urlYear: string | null
): ProductRecord => {
  if (!verifiedUnit(source) || !source.longDescription) return source;
  const supportedYear = verifiedYear(source, urlYear);
  const year = supportedYear?.year ?? null;
  let description = source.longDescription;
  if (year) description = replaceManufacturingYear(description, year);
  const recoveredYear = Boolean(supportedYear?.fromTitle && description !== source.longDescription);
  description = normalizeLiftingHeight(description, source, urlYear);
  description = normalizeCapacity(description, source);
  if (description === source.longDescription) return source;
  return {
    ...source, longDescription: description,
    ...(recoveredYear && supportedYear ? {
      year: supportedYear.year, yearSource: "url" as const
    } : {})
  };
};
