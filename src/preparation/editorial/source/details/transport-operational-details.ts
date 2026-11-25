import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFamily } from "../../core/editorial-families.js";
import { formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { resolvedEditorialUnitFamilies } from "../../identity/editorial-unit-provenance.js";
import { matchingMetric } from "./equipment-detail-values.js";

export const resolveTransportOperationalDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily, heightAlreadyIncluded: boolean
): readonly string[] => {
  const handling = ["carretilla-elevadora", "carretilla-retractil", "apilador", "manipulador-telescopico"].includes(family);
  const exterior = ["excavadora", "miniexcavadora", "cargadora", "compactadora", "grupo-electrogeno"].includes(family);
  if (!handling && !exterior) return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const text = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  if (exterior && !heightAlreadyIncluded && !/\b(?:altura|alto)\b/iu.test(text)) {
    const keys = ["Altura", "Alto", "Altura total", "Altura exterior"];
    const height = matchingMetric(source, prepared, keys);
    const competing = ["Altura almacenaje", "Altura replegada", "Altura de trabajo", "Altura trabajo",
      ...(family === "compactadora" ? ["Ancho bandeja", "Largo bandeja", "Potencia"] : [])];
    if (height !== null && height >= 0.3 && height <= 8 &&
      !competing.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined)) {
      details.push(`altura exterior declarada de ${formatEditorialQuantity(height)} m`);
    }
  }
  if (family === "manipulador-telescopico" && !heightAlreadyIncluded &&
    !/\b(?:altura\s+(?:total|exterior|del equipo|de transporte|de almacenaje|replegada)|alto)\b/iu.test(text)) {
    const competing = ["Altura", "Alto", "Altura exterior", "Altura almacenaje", "Altura replegada", "Altura transporte", "Altura de transporte"];
    const height = matchingMetric(source, prepared, ["Altura total"]);
    if (height !== null && height >= 1 && height <= 5 &&
      !competing.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined)) {
      details.push(`altura total declarada de ${formatEditorialQuantity(height)} m`);
    }
  }
  if (handling && !/\b(?:longitud|largo)\b/iu.test(text)) {
    const forkKeys = ["Longitud sin horquillas", "Largo sin horquillas"];
    const boardKeys = ["Longitud al tablero", "Largo al tablero"];
    const keys = family === "manipulador-telescopico" ? boardKeys : forkKeys;
    const competing = family === "manipulador-telescopico" ? forkKeys : boardKeys;
    const generic = ["Longitud", "Longitud total", "Largo"];
    const length = matchingMetric(source, prepared, keys);
    const hasGeneric = generic.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    const overall = matchingMetric(source, prepared, generic);
    if (length !== null && length >= 0.5 && length <= 15 &&
      !competing.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined) &&
      (!hasGeneric || overall !== null && overall > length)) {
      details.push(`${family === "manipulador-telescopico" ? "longitud al tablero" : "longitud sin horquillas"} declarada de ${formatEditorialQuantity(length)} m`);
    }
  }
  return details;
};
