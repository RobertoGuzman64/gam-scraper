import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { resolvedEditorialUnitFamilies } from "./editorial-unit-provenance.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { editorialFamilyName } from "./editorial-families.js";

const corroborated = (
  source: ProductRecord,
  prepared: ProductRecord,
  keys: readonly string[],
  unit: "kg" | "kVA" | "m",
  minimum: number,
  maximum: number
): number | null => {
  const measure = unit === "m" ? editorialMetricOf :
    (record: ProductRecord["specs"], names: readonly string[]) => editorialQuantityOf(record, names, unit);
  const original = measure(source.specs, keys);
  const reconciled = measure(prepared.specs, keys);
  return original !== null && original === reconciled && original >= minimum && original <= maximum ? original : null;
};

export const resolveVerifiedTechnicalBrief = (
  source: ProductRecord,
  prepared: ProductRecord
): string | null => {
  if (!verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !source.brand || !source.model) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families) return null;
  const [family, preparedFamily] = families;
  if (family && preparedFamily && family !== preparedFamily) return null;
  const measures = [
    { value: corroborated(source, prepared, ["Peso"], "kg", 10, 500000), label: "peso declarado", unit: "kg" },
    { value: corroborated(source, prepared, ["Longitud"], "m", 0.2, 50), label: "longitud", unit: "m" },
    { value: corroborated(source, prepared, ["Anchura"], "m", 0.2, 20), label: "anchura", unit: "m" },
    { value: corroborated(source, prepared, ["Potencia"], "kVA", 1, 20000), label: "potencia aparente", unit: "kVA" }
  ].filter((item): item is { value: number; label: string; unit: string } => item.value !== null);
  if (measures.length < 2) return null;
  const details = measures.slice(0, 2).map((item) => `${item.label} de ${formatEditorialQuantity(item.value)} ${item.unit}`);
  const condition = source.condition === "Segunda mano" ? " de ocasión" : source.condition === "Nuevo" ? ", unidad nueva" : "";
  const noun = family && family === preparedFamily ? editorialFamilyName(family) : "equipo";
  const named = `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)}`;
  return `${named} ${source.brand} ${source.model}${condition}, con ${details.join(" y ")}.`;
};
