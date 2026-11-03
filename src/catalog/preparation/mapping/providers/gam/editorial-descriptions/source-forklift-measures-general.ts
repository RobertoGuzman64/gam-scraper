import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../../../evidence/providers/gam/identity/source-variant-identity.js";

const millimetres = /^(\d{3,4})\s*mm$/iu;
const statedLoadCenter = /\bcentro\s+(?:de\s+)?(?:carga|gravedad)\b/iu;
const statedTurningRadius = /\bradio\s+(?:(?:m[ií]nimo|exterior)\s+)?(?:de\s+)?(?:giro|viraje)\b/iu;

const declaredMeasure = (
  record: ProductRecord, specs: SpecsMap, key: "Centro de carga" | "Radio de giro",
  minimum: number, maximum: number
): number | null => {
  const original = record.specs?.[key];
  if (typeof original !== "string" || original !== specs[key]) return null;
  const match = millimetres.exec(original.trim());
  const value = match?.[1] ? Number(match[1]) : NaN;
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
};

const formatMillimetres = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ".");

export const includeGamSourceForkliftMeasuresInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  if (!general?.trim() || record.condition !== "Nuevo" ||
    record.categoryKey !== "carretillas-nuevas" || !verifiedGamSourceVariant(record)) return general;

  const additions: string[] = [];
  if (!statedLoadCenter.test(general)) {
    const loadCenter = declaredMeasure(record, specs, "Centro de carga", 350, 1500);
    if (loadCenter !== null) {
      additions.push(`El centro de carga declarado en la ficha técnica es de ${formatMillimetres(loadCenter)} mm, referencia para interpretar la capacidad nominal de elevación.`);
    }
  }
  if (!statedTurningRadius.test(general)) {
    const turningRadius = declaredMeasure(record, specs, "Radio de giro", 1000, 7500);
    if (turningRadius !== null) {
      additions.push(`El radio de giro indicado por el proveedor es de ${formatMillimetres(turningRadius)} mm, dato útil para comprobar el espacio disponible para maniobrar.`);
    }
  }
  if (additions.length === 0) return general;
  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} ${additions.join(" ")}`;
};
