import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";
import { resolvedEditorialUnitFamilies } from "./editorial-unit-provenance.js";

type TechnicalDetail = Readonly<{
  key: string;
  label: string;
  unit: "m" | "kg" | "mm";
  min: number;
  max: number;
}>;

const technicalDetails: readonly TechnicalDetail[] = [
  { key: "Altura de trabajo", label: "altura de trabajo", unit: "m", min: 1, max: 100 },
  { key: "Altura de elevación (mm)", label: "altura de elevación", unit: "m", min: 0.3, max: 50 },
  { key: "Altura almacenaje", label: "altura de almacenaje", unit: "m", min: 0.3, max: 20 },
  { key: "Longitud", label: "longitud", unit: "m", min: 0.2, max: 50 },
  { key: "Anchura", label: "anchura", unit: "m", min: 0.2, max: 20 },
  { key: "Altura", label: "altura exterior", unit: "m", min: 0.2, max: 20 },
  { key: "Peso", label: "peso declarado", unit: "kg", min: 10, max: 500000 },
  { key: "Capacidad", label: "capacidad de carga declarada", unit: "kg", min: 10, max: 100000 },
  { key: "Capacidad de carga (kg)", label: "capacidad de carga declarada", unit: "kg", min: 10, max: 100000 },
  { key: "Centro de carga", label: "centro de carga", unit: "mm", min: 100, max: 3000 },
  { key: "Radio de giro", label: "radio de giro", unit: "mm", min: 100, max: 15000 }
];

const measureOf = (record: ProductRecord, detail: TechnicalDetail): number | null => {
  if (detail.unit === "m") return editorialMetricOf(record.specs, [detail.key]);
  return editorialQuantityOf(record.specs, [detail.key], detail.unit);
};

const sourcingIsSafe = (source: ProductRecord, prepared: ProductRecord): boolean => {
  if (!sameEditorialUnit(source, prepared) ||
    !source.title?.trim() || !prepared.title?.trim() ||
    source.specs?.Marca !== prepared.specs?.Marca || source.specs?.Modelo !== prepared.specs?.Modelo) return false;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  return families === null || !families[0] || !families[1] || families[0] === families[1];
};

const shortSourceContext = (source: ProductRecord, general: string): string | null => {
  const short = source.shortDescription?.replace(/\s+/gu, " ").trim() ?? "";
  const sourceGeneral = source.longDescription?.trim() ?? "";
  const model = source.model?.trim();
  if (!model || short.length < 155 || short.length > 600 ||
    short.split(/\s+/u).length < sourceGeneral.split(/\s+/u).length + 9 ||
    /<[^>]+>|https?:\/\/|@|\b(?:precio|descuento|oferta)\b/iu.test(short) ||
    !short.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    !source.title?.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    general.toLocaleLowerCase("es").includes(short.toLocaleLowerCase("es"))) return null;
  return `La descripción breve del mismo anuncio precisa: ${short}${/[.!?]$/u.test(short) ? "" : "."}`;
};

const sourcedMeasures = (source: ProductRecord, prepared: ProductRecord, general: string): readonly string[] => {
  const described = new Set<string>();
  const additions: string[] = [];
  for (const detail of technicalDetails) {
    if (source.specs?.[detail.key] === undefined || source.specs[detail.key] !== prepared.specs?.[detail.key] ||
      described.has(detail.label)) continue;
    const value = measureOf(source, detail);
    if (value === null || value !== measureOf(prepared, detail) || value < detail.min || value > detail.max) continue;
    const formatted = `${formatEditorialQuantity(value)} ${detail.unit}`;
    const ungrouped = formatted.replace(/(?<=\d)\.(?=\d{3}\b)/gu, "");
    if (general.includes(formatted) || general.includes(ungrouped) ||
      detail.unit === "mm" && general.includes(`${formatEditorialQuantity(value / 1000)} m`)) continue;
    described.add(detail.label);
    additions.push(`${detail.label} de ${formatted}`);
  }
  const sourcePower = source.specs?.Potencia;
  if (typeof sourcePower === "string" && sourcePower === prepared.specs?.Potencia) {
    const match = /^([1-9]|1[0-2])\s*[x×]\s*([1-9]\d{1,3})\s*W$/iu.exec(sourcePower.trim());
    if (match?.[1] && match[2] && Number(match[2]) <= 5000 &&
      !/\bpotencia\b/iu.test(general) &&
      !general.replace(/\s+/gu, "").replace(/x/giu, "×").includes(`${match[1]}×${match[2]}W`)) additions.push(`potencia declarada de ${match[1]} × ${Number(match[2]).toLocaleString("es-ES")} W`);
  }
  return additions;
};

export const resolveSourcedTechnicalContext = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || !source.longDescription?.trim() ||
    general.trim().split(/\s+/u).length >= 60 || source.longDescription.trim().split(/\s+/u).length >= 60 ||
    !sourcingIsSafe(source, prepared)) return null;
  const additions: string[] = [];
  const short = shortSourceContext(source, general);
  if (short !== null) additions.push(short);
  const measures = sourcedMeasures(source, prepared, `${general} ${short ?? ""}`);
  if (measures.length >= 2) {
    additions.push(`En la ficha técnica de esta misma referencia constan además ${measures.join(", ")}. Estas magnitudes describen el equipo anunciado y son útiles para comprobar dimensiones, capacidades y condiciones de utilización.`);
  } else if (measures.length === 1 && /^altura (?:de|exterior)/u.test(measures[0] ?? "") &&
    general.trim().split(/\s+/u).length >= 45) {
    additions.push(`La ficha técnica de esta misma referencia añade ${measures[0]}, una cota útil para comprobar las dimensiones y condiciones de acceso del equipo anunciado.`);
  }
  if (additions.length === 0) return null;
  return `${general.trim()}${/[.!?]$/u.test(general.trim()) ? "" : "."} ${additions.join(" ")}`;
};
