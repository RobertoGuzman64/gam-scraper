import type { ProductRecord, SpecValue } from "../../../../contracts/catalog.js";
import { containsEditorialIdentity } from "./editorial-identity-match.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";

const folded = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

const corroboratedMeasure = (
  source: ProductRecord, prepared: ProductRecord, key: string,
  read: (record: ProductRecord) => number | null, minimum: number, maximum: number
): number | null => {
  const original = source.specs?.[key];
  if (original === undefined || original !== prepared.specs?.[key]) return null;
  const value = read(source);
  return value !== null && value >= minimum && value <= maximum && value === read(prepared) ? value : null;
};

const corroboratedBasket = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const value: SpecValue | undefined = source.specs?.["Dimensiones Cesta"];
  if (typeof value !== "string" || value !== prepared.specs?.["Dimensiones Cesta"]) return null;
  const match = /^(\d{1,2}(?:[.,]\d{1,2})?)\s*[x×]\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:m|metros?)$/iu.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const length = Number(match[1].replace(",", "."));
  const width = Number(match[2].replace(",", "."));
  return length >= 0.5 && length <= 12 && width >= 0.4 && width <= 6 ?
    `dimensiones de cesta de ${formatEditorialQuantity(length)} × ${formatEditorialQuantity(width)} m` : null;
};

const verifiedHeaderIdentity = (source: ProductRecord, prepared: ProductRecord): boolean => {
  if (!sameEditorialUnit(source, prepared) ||
    !source.model || !source.title || !prepared.title ||
    !containsEditorialIdentity(source.title, source.model) ||
    !containsEditorialIdentity(prepared.title, source.model)) return false;
  const originalModel = source.specs?.Modelo;
  if (typeof originalModel !== "string" || folded(originalModel) !== folded(source.model) ||
    prepared.specs?.Modelo !== originalModel) return false;
  const compared = ["Altura de trabajo (m)", "Capacidad de carga (kg)", "Longitud",
    "Anchura", "Peso", "Altura Plataforma", "Dimensiones Cesta"];
  if (compared.some((key) => source.specs?.[key] !== prepared.specs?.[key])) return false;
  const brand = source.specs?.Marca;
  if (source.brand ? typeof brand !== "string" || folded(brand) !== folded(source.brand) ||
    prepared.specs?.Marca !== brand : brand !== undefined) return false;
  try {
    const url = new URL(source.url);
    const slug = url.pathname.split("/").filter(Boolean).at(-1);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash &&
      Boolean(source.reference && slug?.startsWith(`${source.reference}-`));
  } catch {
    return false;
  }
};

export const resolveHeaderOnlyEditorialGeneral = (
  source: ProductRecord, prepared: ProductRecord
): string | null => {
  const sourceShort = source.shortDescription?.trim();
  if (!sourceShort || sourceShort.length < 60 || sourceShort !== prepared.shortDescription?.trim() ||
    !/^equipamiento\s+est[aá]ndar\s*:\s*$/iu.test(source.longDescription?.trim() ?? "") ||
    !verifiedHeaderIdentity(source, prepared)) return null;
  const measures: string[] = [];
  const append = (label: string, value: number | null, unit: string): void => {
    if (value !== null) measures.push(`${label} de ${formatEditorialQuantity(value)} ${unit}`);
  };
  append("altura de trabajo declarada", corroboratedMeasure(source, prepared, "Altura de trabajo (m)",
    (record) => editorialMetricOf(record.specs, ["Altura de trabajo (m)"]), 1, 70), "m");
  append("capacidad de carga declarada", corroboratedMeasure(source, prepared, "Capacidad de carga (kg)",
    (record) => editorialQuantityOf(record.specs, ["Capacidad de carga (kg)"], "kg"), 50, 100000), "kg");
  append("longitud", corroboratedMeasure(source, prepared, "Longitud",
    (record) => editorialMetricOf(record.specs, ["Longitud"]), 0.5, 30), "m");
  append("anchura", corroboratedMeasure(source, prepared, "Anchura",
    (record) => editorialMetricOf(record.specs, ["Anchura"]), 0.3, 10), "m");
  append("peso declarado", corroboratedMeasure(source, prepared, "Peso",
    (record) => editorialQuantityOf(record.specs, ["Peso"], "kg"), 50, 100000), "kg");
  append("altura de plataforma", corroboratedMeasure(source, prepared, "Altura Plataforma",
    (record) => editorialMetricOf(record.specs, ["Altura Plataforma"]), 0.3, 50), "m");
  const basket = corroboratedBasket(source, prepared);
  if (basket) measures.push(basket);
  if (measures.length < 3) return null;
  return `El texto original presenta ${source.title} con las siguientes características: ${sourceShort} ` +
    `La tabla de especificaciones de esta misma referencia registra ${measures.join(", ")}. ` +
    "El encabezado «Equipamiento Estándar» no trae un desglose de accesorios; no se atribuye equipamiento adicional no documentado.";
};
