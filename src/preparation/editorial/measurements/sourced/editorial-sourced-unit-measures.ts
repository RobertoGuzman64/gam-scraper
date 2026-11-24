import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "../editorial-measurements.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";

type UnitMeasure = Readonly<{
  key: string;
  label: string;
  unit: "m" | "kg" | "kVA";
  minimum: number;
  maximum: number;
}>;

const measures: readonly UnitMeasure[] = [
  { key: "Altura de trabajo", label: "altura de trabajo indicada", unit: "m", minimum: 1, maximum: 100 },
  { key: "Altura plataforma", label: "altura de plataforma", unit: "m", minimum: 0.3, maximum: 80 },
  { key: "Altura almacenaje", label: "altura de almacenaje", unit: "m", minimum: 0.3, maximum: 20 },
  { key: "Alcance lateral", label: "alcance lateral", unit: "m", minimum: 0.1, maximum: 60 },
  { key: "Longitud", label: "longitud", unit: "m", minimum: 0.2, maximum: 50 },
  { key: "Anchura", label: "anchura", unit: "m", minimum: 0.2, maximum: 20 },
  { key: "Peso", label: "peso declarado", unit: "kg", minimum: 10, maximum: 500000 },
  { key: "Capacidad", label: "capacidad declarada", unit: "kg", minimum: 10, maximum: 100000 },
  { key: "Potencia", label: "potencia aparente indicada", unit: "kVA", minimum: 1, maximum: 20000 }
];

const corroborated = (source: ProductRecord, prepared: ProductRecord, measure: UnitMeasure): number | null => {
  const original = source.specs?.[measure.key];
  if (original === undefined || original !== prepared.specs?.[measure.key]) return null;
  const read = (record: ProductRecord): number | null => measure.unit === "m" ?
    editorialMetricOf(record.specs, [measure.key]) :
    editorialQuantityOf(record.specs, [measure.key], measure.unit);
  const value = read(source);
  return value !== null && value === read(prepared) && value >= measure.minimum && value <= measure.maximum ?
    value : null;
};

export const resolveSourcedUnitMeasuresGeneral = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const originalGeneral = source.longDescription?.trim();
  if (!authenticatedOrigin || !originalGeneral || source.shortDescription?.trim() || !general?.trim() ||
    general.trim().split(/\s+/u).length >= 60 || originalGeneral.split(/\s+/u).length >= 60 ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !sameEditorialUnit(source, prepared) ||
    measures.some((measure) => source.specs?.[measure.key] !== prepared.specs?.[measure.key])) return null;
  const details = measures.flatMap((measure) => {
    const value = corroborated(source, prepared, measure);
    if (value === null) return [];
    const formatted = `${formatEditorialQuantity(value)} ${measure.unit}`;
    if (general.includes(formatted)) return [];
    return [`${measure.label} de ${formatted}`];
  });
  if (details.length < 2) return null;
  return `${general.trim()} La ficha técnica de esta misma referencia declara ${details.join(", ")}. ` +
    "Estas medidas corresponden al equipo anunciado y deben contrastarse con la unidad ofrecida.";
};
