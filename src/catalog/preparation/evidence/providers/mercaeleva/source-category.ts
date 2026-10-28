import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../../mapping/category-utils.js";

export const mercaelevaDocumentedSourceType = (record: ProductRecord, path: readonly string[]): boolean => {
  if (path.length !== 4 || path[0] !== "es" || path[1] !== "for-sale" || path[2] !== "machine") return false;
  if (!path[3]?.endsWith(record.reference ?? "__sin_referencia__")) return false;
  const title = fold(record.title ?? "");
  const brand = fold(record.brand ?? "");
  const model = fold(record.model ?? "");
  if (brand && (!title.includes(brand) || !fold(path[3]).includes(brand))) return false;
  if (model && !title.includes(model)) return false;
  const extra = record.specs?.["Título adicional"];
  if (typeof extra !== "string") return false;
  const additional = fold(extra);
  if (/\bcamion porta-vehiculos\b/.test(title)) return /\bcamion porta-vehiculos\b/.test(additional);
  if (/\bapilador electrico\b/.test(title)) return /\bapilador electrico\b/.test(additional);
  if (/\bmodulo caseta\b/.test(title)) return /\bmodulo caseta\b/.test(additional);
  return false;
};
