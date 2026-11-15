import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyName } from "./editorial-families.js";
import { containsEditorialBrandModel } from "./editorial-identity-match.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolvedEditorialUnitFamilies, verifiedEditorialUnitPair } from "./editorial-unit-provenance.js";

export const resolveDocumentedModelDimensions = (
  source: ProductRecord, prepared: ProductRecord, general: string | null
): string | null => {
  if (!verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !verifiedEditorialUnitPair(source, prepared) || !source.brand || !source.model) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families || families[0] !== families[1] ||
    (families[0] !== "carretilla-elevadora" && families[0] !== "carretilla-retractil")) return null;
  if (source.longDescription?.trim() &&
    !containsEditorialBrandModel(source.longDescription, source.brand, source.model)) return null;
  const text = general ?? source.longDescription ?? "";
  if (/\b(?:longitud|anchura|dimensiones|medidas\s+(?:totales|exteriores))\b/iu.test(text)) return null;
  const definitions = [
    { key: "Longitud", minimum: 2, maximum: 15 },
    { key: "Anchura", minimum: 0.6, maximum: 3.5 },
    { key: "Altura", minimum: 1, maximum: 6 }
  ] as const;
  const dimensions = definitions.map(({ key, minimum, maximum }) => {
    if (source.specs?.[key] === undefined || source.specs[key] !== prepared.specs?.[key]) return null;
    const value = editorialMetricOf(source.specs, [key]);
    return value !== null && value >= minimum && value <= maximum ? value : null;
  });
  if (dimensions.some((value) => value === null)) return null;
  if (source.specs?.Peso === undefined || source.specs.Peso !== prepared.specs?.Peso) return null;
  const weight = editorialQuantityOf(source.specs, ["Peso"], "kg");
  if (weight === null || weight < 2000 || weight > 90000) return null;
  const [lengthMeters, widthMeters, heightMeters] = dimensions;
  if (lengthMeters === undefined || lengthMeters === null || widthMeters === undefined ||
    widthMeters === null || heightMeters === undefined || heightMeters === null) return null;
  const length = formatEditorialQuantity(lengthMeters);
  const width = formatEditorialQuantity(widthMeters);
  const height = formatEditorialQuantity(heightMeters);
  const values = [lengthMeters, widthMeters, heightMeters].map((value) =>
    String(Math.round(value * 1000))).concat(String(weight));
  if (source.longDescription?.trim() && values.some((value) =>
    value !== null && new RegExp(`(^|\\D)${value}(\\D|$)`, "u").test(text))) return null;
  const family = editorialFamilyName(families[0]);
  return `La ficha técnica de ${family} ${source.brand} ${source.model} declara ` +
    `${length} m de longitud, ${width} m de anchura, ${height} m de altura del equipo ` +
    `y ${formatEditorialQuantity(weight)} kg de peso para la configuración anunciada.`;
};
