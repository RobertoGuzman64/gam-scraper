import type { ProductRecord } from "../../../contracts/catalog.js";
import { editorialMetricOf, editorialQuantity, editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { resolvedEditorialUnitFamilies } from "../identity/editorial-unit-provenance.js";
import { verifiedEditorialIdentity } from "../core/editorial-source-contract.js";
import { editorialFamilyName, editorialFamilyOf } from "../core/editorial-families.js";
import { containsEditorialBrandModel } from "../identity/editorial-identity-match.js";
import { hasUnconditionalEditorialClaim } from "../claims/editorial-claim-evidence.js";
import { resolveVerifiedEditorialCondition } from "../identity/editorial-condition.js";

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
  const sourceCondition = resolveVerifiedEditorialCondition(source);
  const condition = sourceCondition && sourceCondition === resolveVerifiedEditorialCondition(prepared) ?
    sourceCondition === "Segunda mano" ? " de ocasión" : ", unidad nueva" : "";
  const noun = family && family === preparedFamily ? editorialFamilyName(family) : "equipo";
  const named = `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)}`;
  return `${named} ${source.brand} ${source.model}${condition}, con ${details.join(" y ")}.`;
};

export const enrichVerifiedTechnicalBrief = (
  source: ProductRecord, prepared: ProductRecord, short: string | null
): string | null => {
  if (!short || short.trim().split(/\s+/u).length >= 10 || source.shortDescription?.trim() ||
    !source.brand || !source.model ||
    !containsEditorialBrandModel(short, source.brand, source.model) ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared)) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  const family = families?.[0];
  if (!family || family !== families?.[1] || editorialFamilyOf(short) !== family ||
    !["carretilla-elevadora", "carretilla-retractil", "apilador"].includes(family)) return null;
  const connector = /,\s*con\b/iu.test(short) ? " y " : ", con ";
  const stem = short.trim().replace(/[.!?]$/u, "");
  const height = corroborated(source, prepared, ["Altura máxima de elevación", "Altura de elevación (mm)", "Altura de elevación (m)"], "m", 0.5, 20);
  const heightPattern = /\baltura\s+(?:m[aá]xima\s+)?de\s+elevaci[oó]n\s*(?:es\s+de\s+|de\s+|:\s*)?(?:hasta\s+)?(\d[\d.,]*)\s*(mm|m|metros?)\b/giu;
  const heightTextAgrees = [source.title ?? "", source.longDescription ?? ""].every((text) => {
    const matches = [...text.matchAll(heightPattern)];
    return matches.length === 0 || hasUnconditionalEditorialClaim(text, heightPattern) && matches.every((match) =>
      editorialMetricOf({ Altura: `${match[1] ?? ""} ${match[2] ?? ""}` }, ["Altura"]) === height);
  });
  if (height !== null && heightTextAgrees && !/\b(?:altura|elevaci[oó]n de)\b/iu.test(short)) {
    return `${stem}${connector}altura de elevación declarada de ${formatEditorialQuantity(height)} m.`;
  }
  const capacity = editorialQuantityOf(prepared.specs, ["Capacidad nominal de carga", "Capacidad máxima de elevación",
    "Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"], "kg");
  const loadPattern = /\b(\d[\d.,]*)\s*kg\b/giu;
  const title = source.title ?? "";
  const general = source.longDescription ?? "";
  const explicitLoad = /\b(?:apilador\s+(?:el[eé]ctrico\s+)?|capacidad(?:\s+nominal)?\s+de\s+carga(?:\s+de)?\s+)(\d[\d.,]*)\s*kg\b/giu;
  const loadsIn = (text: string): boolean => {
    const matches = [...text.matchAll(loadPattern)];
    return matches.length === 1 && editorialQuantity(matches[0]?.[0], "kg") === capacity &&
      hasUnconditionalEditorialClaim(text, explicitLoad);
  };
  if (family !== "apilador" || prepared.specs?.["Capacidad nominal de carga"] === undefined || capacity === null || capacity < 100 || capacity > 50000 ||
    /\b(?:capacidad|kg)\b/iu.test(short) || !containsEditorialBrandModel(general, source.brand, source.model) ||
    !loadsIn(title) || !loadsIn(general)) return null;
  return `${stem}${connector}capacidad nominal declarada de ${formatEditorialQuantity(capacity)} kg.`;
};
